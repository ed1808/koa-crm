import { NativeRouter, jsonResponse, parseBody } from "../../shared/infrastructure/Router";
import { sql } from "../../database/db";
import { eventBus } from "../../shared/infrastructure/EventBus";
import { resolveAuthUser } from "../../shared/presentation/authMiddleware";
import { recordStepHistory, finalizeAndHandoffRecord } from "../../shared/application/WorkflowService";
import { applyDealOutcome, DealOutcomeStatus } from "../../shared/application/RecoveryService";

export function registerCrmRoutes(router: NativeRouter) {
  // 1. Obtener tablero Kanban de Negocios para un Pipeline
  router.get("/api/deals/kanban", async (req) => {
    const url = new URL(req.url);
    const pipelineId = url.searchParams.get("pipeline_id");
    const ownerId = url.searchParams.get("owner_id");
    const search = url.searchParams.get("search");

    if (!pipelineId) {
      return jsonResponse({ error: "pipeline_id is required" }, 400);
    }

    // Obtener etapas del pipeline
    const stages = await sql`
      SELECT id, name, position, win_probability, status_category, color_hex
      FROM pipeline_stages
      WHERE pipeline_id = ${pipelineId}
      ORDER BY position ASC;
    `;

    const maxStagePosition = stages.reduce((max: number, s: any) => Math.max(max, Number(s.position || 0)), 0);

    // Obtener negocios con datos enriquecidos (empresa, contacto, propietario)
    const deals = await sql`
      SELECT 
        d.id, d.title, d.amount, d.currency, d.pipeline_id, d.stage_id,
        d.is_finalized, d.finalized_at, d.handoff_target_type, d.handoff_target_id,
        d.outcome_status, d.is_archived, d.recovery_due_at,
        d.expected_close_date, d.closed_at, d.last_activity_at, d.next_activity_at, d.created_at,
        ps.position as stage_position,
        c.name as company_name, c.id as company_id, c.do_not_contact as company_do_not_contact,
        ct.full_name as contact_name, ct.id as contact_id,
        u.full_name as owner_name, u.id as owner_id,
        t.ticket_number as source_ticket_number
      FROM deals d
      LEFT JOIN pipeline_stages ps ON d.stage_id = ps.id
      LEFT JOIN companies c ON d.company_id = c.id
      LEFT JOIN contacts ct ON d.primary_contact_id = ct.id
      LEFT JOIN users u ON d.owner_id = u.id
      LEFT JOIN tickets t ON d.source_ticket_id = t.id
      WHERE d.pipeline_id = ${pipelineId} AND d.is_archived = FALSE
      ORDER BY d.created_at DESC;
    `;

    // Agrupar negocios por columna y calcular totales / ponderados
    const columns = stages.map((stage: any) => {
      let stageDeals = deals
        .filter((d: any) => d.stage_id === stage.id)
        .map((d: any) => ({ ...d, max_stage_position: maxStagePosition }));

      if (ownerId) {
        stageDeals = stageDeals.filter((d: any) => d.owner_id === ownerId);
      }
      if (search) {
        const q = search.toLowerCase();
        stageDeals = stageDeals.filter(
          (d: any) =>
            d.title.toLowerCase().includes(q) ||
            (d.company_name && d.company_name.toLowerCase().includes(q)) ||
            (d.contact_name && d.contact_name.toLowerCase().includes(q))
        );
      }

      const totalAmount = stageDeals.reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);
      const weightedAmount = (totalAmount * (stage.win_probability || 0)) / 100;

      return {
        stage,
        deals: stageDeals,
        count: stageDeals.length,
        totalAmount,
        weightedAmount,
      };
    });

    const overallTotal = deals.reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);

    return jsonResponse({
      data: {
        columns,
        summary: {
          totalDeals: deals.length,
          overallAmount: overallTotal,
          maxStagePosition,
        },
      },
    });
  });

  // 2. Mover negocio de etapa (Drag & Drop) y emitir eventos
  router.patch("/api/deals/:id/stage", async (req, params) => {
    const authUser = await resolveAuthUser(req);
    const body = await parseBody(req);
    const { target_stage_id } = body;

    if (!target_stage_id) {
      return jsonResponse({ error: "target_stage_id is required" }, 400);
    }

    const currentDeal = await sql`
      SELECT d.*, ps.name as current_stage_name, ps.status_category as current_status
      FROM deals d
      JOIN pipeline_stages ps ON d.stage_id = ps.id
      WHERE d.id = ${params.id}
      LIMIT 1;
    `;

    if (!currentDeal || currentDeal.length === 0) {
      return jsonResponse({ error: "Deal not found" }, 404);
    }

    const targetStage = await sql`
      SELECT id, name, status_category, win_probability
      FROM pipeline_stages
      WHERE id = ${target_stage_id}
      LIMIT 1;
    `;

    if (!targetStage || targetStage.length === 0) {
      return jsonResponse({ error: "Target stage not found" }, 404);
    }

    const isWon = targetStage[0].status_category === "WON_RESOLVED" || targetStage[0].win_probability === 100 || targetStage[0].name.toLowerCase().includes("venta");
    const closedAt = isWon ? new Date() : null;

    const updated = await sql`
      UPDATE deals
      SET stage_id = ${target_stage_id},
          closed_at = ${closedAt},
          last_activity_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${params.id}
      RETURNING *;
    `;

    if (currentDeal[0].stage_id !== target_stage_id) {
      await recordStepHistory(
        "DEAL",
        params.id,
        authUser.id,
        `Etapa actualizada de "${currentDeal[0].current_stage_name}" a "${targetStage[0].name}".`
      );
    }

    await eventBus.publish(
      "crm.deal.stage_changed",
      {
        dealId: params.id,
        previousStageId: currentDeal[0].stage_id,
        targetStageId: target_stage_id,
        targetStageName: targetStage[0].name,
        amount: updated[0].amount,
        companyId: updated[0].company_id,
      },
      "Deal",
      params.id
    );

    if (isWon) {
      await eventBus.publish(
        "crm.deal.won",
        {
          dealId: params.id,
          title: updated[0].title,
          amount: updated[0].amount,
          currency: updated[0].currency,
          companyId: updated[0].company_id,
          timestamp: new Date().toISOString(),
        },
        "Deal",
        params.id
      );
    }

    return jsonResponse({ data: updated[0] });
  });

  // 3. Crear nuevo Negocio
  router.post("/api/deals", async (req) => {
    const authUser = await resolveAuthUser(req);
    const body = await parseBody(req);
    const {
      pipeline_id,
      stage_id,
      company_id,
      primary_contact_id,
      owner_id,
      source_ticket_id,
      title,
      amount,
      expected_close_date,
    } = body;

    if (!pipeline_id || !stage_id || !title) {
      return jsonResponse({ error: "pipeline_id, stage_id y title son requeridos" }, 400);
    }

    if (company_id) {
      const compRows = await sql`SELECT name, do_not_contact FROM companies WHERE id = ${company_id} LIMIT 1;`;
      if (compRows[0]?.do_not_contact) {
        return jsonResponse({ error: `La empresa "${compRows[0].name}" tiene restricción de No Contactar nuevamente.` }, 400);
      }
    }
    if (primary_contact_id) {
      const ctRows = await sql`SELECT full_name, do_not_contact FROM contacts WHERE id = ${primary_contact_id} LIMIT 1;`;
      if (ctRows[0]?.do_not_contact) {
        return jsonResponse({ error: `El contacto "${ctRows[0].full_name}" tiene restricción de No Contactar nuevamente.` }, 400);
      }
    }

    const res = await sql`
      INSERT INTO deals (
        pipeline_id, stage_id, company_id, primary_contact_id, owner_id,
        source_ticket_id, title, amount, currency, expected_close_date
      )
      VALUES (
        ${pipeline_id}, ${stage_id}, ${company_id || null}, ${primary_contact_id || null},
        ${owner_id || authUser.id || null}, ${source_ticket_id || null}, ${title},
        ${amount || 0.00}, 'COP', ${expected_close_date || null}
      )
      RETURNING *;
    `;

    const stageRows = await sql`SELECT name FROM pipeline_stages WHERE id = ${stage_id} LIMIT 1;`;
    const stageName = stageRows[0]?.name || "Inicial";
    await recordStepHistory(
      "DEAL",
      res[0].id,
      authUser.id,
      `Oportunidad comercial creada en etapa "${stageName}".`
    );

    return jsonResponse({ data: res[0] }, 201);
  });

  // 4. Detalle completo de un Negocio (Drawer 360°)
  router.get("/api/deals/:id", async (_, params) => {
    const deal = await sql`
      SELECT 
        d.*,
        c.name as company_name, c.tax_id as company_tax_id, c.industry as company_industry, c.do_not_contact as company_do_not_contact,
        ct.full_name as contact_name, ct.email as contact_email, ct.phone as contact_phone, ct.do_not_contact as contact_do_not_contact,
        u.full_name as owner_name, u.email as owner_email,
        p.name as pipeline_name,
        ps.name as stage_name, ps.position as stage_position, ps.win_probability, ps.color_hex as stage_color,
        t.ticket_number as source_ticket_number, t.subject as source_ticket_subject
      FROM deals d
      LEFT JOIN companies c ON d.company_id = c.id
      LEFT JOIN contacts ct ON d.primary_contact_id = ct.id
      LEFT JOIN users u ON d.owner_id = u.id
      LEFT JOIN pipelines p ON d.pipeline_id = p.id
      LEFT JOIN pipeline_stages ps ON d.stage_id = ps.id
      LEFT JOIN tickets t ON d.source_ticket_id = t.id
      WHERE d.id = ${params.id}
      LIMIT 1;
    `;

    if (!deal || deal.length === 0) {
      return jsonResponse({ error: "Deal not found" }, 404);
    }

    const stages = await sql`
      SELECT id, name, position, status_category, color_hex, win_probability
      FROM pipeline_stages
      WHERE pipeline_id = ${deal[0].pipeline_id}
      ORDER BY position ASC;
    `;
    const maxStagePosition = stages.reduce((max: number, s: any) => Math.max(max, Number(s.position || 0)), 0);

    const tasks = await sql`
      SELECT t.*, u.full_name as assigned_to_name
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to_id = u.id
      WHERE t.deal_id = ${params.id}
      ORDER BY t.due_at ASC;
    `;

    const timeline = await sql`
      SELECT i.*, u.full_name as author_name, u.role as author_role
      FROM interactions_comments i
      LEFT JOIN users u ON i.author_id = u.id
      WHERE i.target_type = 'DEAL' AND i.target_id = ${params.id}
      ORDER BY i.created_at DESC;
    `;

    return jsonResponse({
      data: {
        deal: { ...deal[0], max_stage_position: maxStagePosition },
        stages,
        tasks,
        timeline,
      },
    });
  });

  // 5. Agregar nota o interacción a un Negocio (con "Siguiente paso" opcional)
  router.post("/api/deals/:id/interactions", async (req, params) => {
    const authUser = await resolveAuthUser(req);
    const body = await parseBody(req);
    const { author_id, interaction_type, body: noteBody, next_stage_id } = body;

    if (!noteBody) {
      return jsonResponse({ error: "body is required" }, 400);
    }

    const effectiveAuthorId = author_id || authUser.id;
    let movedToStage: any = null;

    if (next_stage_id) {
      const currentDeal = await sql`
        SELECT d.id, d.stage_id, d.amount, d.currency, d.company_id, d.title, ps.name as current_stage_name
        FROM deals d
        LEFT JOIN pipeline_stages ps ON d.stage_id = ps.id
        WHERE d.id = ${params.id}
        LIMIT 1;
      `;
      const targetStage = await sql`
        SELECT id, name, status_category, win_probability
        FROM pipeline_stages
        WHERE id = ${next_stage_id}
        LIMIT 1;
      `;
      if (currentDeal.length > 0 && targetStage.length > 0 && currentDeal[0].stage_id !== next_stage_id) {
        const isWon = targetStage[0].status_category === "WON_RESOLVED" || targetStage[0].win_probability === 100;
        const closedAt = isWon ? new Date() : null;
        await sql`
          UPDATE deals
          SET stage_id = ${next_stage_id},
              closed_at = ${closedAt},
              last_activity_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${params.id};
        `;
        await recordStepHistory(
          "DEAL",
          params.id,
          effectiveAuthorId,
          `Siguiente paso aplicado: "${currentDeal[0].current_stage_name || "Etapa"}" → "${targetStage[0].name}".`
        );
        await eventBus.publish(
          "crm.deal.stage_changed",
          {
            dealId: params.id,
            previousStageId: currentDeal[0].stage_id,
            targetStageId: next_stage_id,
            targetStageName: targetStage[0].name,
            amount: currentDeal[0].amount,
            companyId: currentDeal[0].company_id,
          },
          "Deal",
          params.id
        );
        if (isWon) {
          await eventBus.publish(
            "crm.deal.won",
            {
              dealId: params.id,
              title: currentDeal[0].title,
              amount: currentDeal[0].amount,
              currency: currentDeal[0].currency,
              companyId: currentDeal[0].company_id,
              timestamp: new Date().toISOString(),
            },
            "Deal",
            params.id
          );
        }
        movedToStage = targetStage[0];
      }
    }

    const res = await sql`
      INSERT INTO interactions_comments (target_type, target_id, author_id, interaction_type, is_internal, body)
      VALUES ('DEAL', ${params.id}, ${effectiveAuthorId}, ${interaction_type || 'COMMENT'}, TRUE, ${noteBody})
      RETURNING *;
    `;

    await sql`
      UPDATE deals
      SET last_activity_at = CURRENT_TIMESTAMP
      WHERE id = ${params.id};
    `;

    return jsonResponse({ data: res[0], movedToStage }, 201);
  });

  // 5b. Finalizar oportunidad en última etapa y opcionalmente generar siguiente flujo
  router.post("/api/deals/:id/finalize", async (req, params) => {
    try {
      const authUser = await resolveAuthUser(req);
      const body = await parseBody(req);
      const result = await finalizeAndHandoffRecord({
        sourceType: "DEAL",
        sourceId: params.id,
        user: authUser,
        note: body.body || body.note,
        nextPipelineId: body.next_pipeline_id || null,
      });
      return jsonResponse({ data: result });
    } catch (err: any) {
      const status = err.message === "RECORD_NOT_FOUND" ? 404 : 400;
      return jsonResponse({ error: err.message }, status);
    }
  });

  // 5c. Actualizar resultado/estado de gestión comercial (En gestión, No por ahora -> Recuperación, Desiste, No contactar)
  router.post("/api/deals/:id/outcome", async (req, params) => {
    try {
      const authUser = await resolveAuthUser(req);
      if (authUser.role === "CLIENTE" || authUser.role === "PROVEEDOR") {
        return jsonResponse({ error: "No tiene permisos para modificar resultados comerciales" }, 403);
      }
      const body = await parseBody(req);
      const outcome = String(body.outcome || "").toUpperCase() as DealOutcomeStatus;
      if (!["ACTIVE", "POSTPONED_RECOVERY", "LOST_DEFINITIVE", "DO_NOT_CONTACT"].includes(outcome)) {
        return jsonResponse({ error: "outcome inválido" }, 400);
      }
      const result = await applyDealOutcome({
        dealId: params.id,
        outcome,
        user: authUser,
        reason: body.reason,
        managementDate: body.management_date || null,
        sourceTaskId: body.source_task_id || null,
      });
      return jsonResponse({ data: result });
    } catch (err: any) {
      const status = err.message === "DEAL_NOT_FOUND" ? 404 : 400;
      return jsonResponse({ error: err.message }, status);
    }
  });

  // 5d. Reactivar oportunidad al pipeline comercial (ej. desde tarea de recuperación)
  router.post("/api/deals/:id/reactivate", async (req, params) => {
    try {
      const authUser = await resolveAuthUser(req);
      if (authUser.role === "CLIENTE" || authUser.role === "PROVEEDOR") {
        return jsonResponse({ error: "No tiene permisos para reactivar oportunidades" }, 403);
      }
      const body = await parseBody(req);
      const result = await applyDealOutcome({
        dealId: params.id,
        outcome: "ACTIVE",
        user: authUser,
        reason: body.reason,
        sourceTaskId: body.source_task_id || null,
      });
      return jsonResponse({ data: result });
    } catch (err: any) {
      const status = err.message === "DEAL_NOT_FOUND" ? 404 : 400;
      return jsonResponse({ error: err.message }, status);
    }
  });

  // 5e. Habilitar / bloquear "No contactar" de una empresa (Solo ADMIN para levantar bloqueo)
  router.patch("/api/companies/:id/do-not-contact", async (req, params) => {
    const authUser = await resolveAuthUser(req);
    if (authUser.role !== "ADMIN") {
      return jsonResponse({ error: "Solo un administrador puede modificar la restricción No Contactar de la empresa" }, 403);
    }
    const body = await parseBody(req);
    const blocked = Boolean(body.do_not_contact);
    const res = await sql`
      UPDATE companies
      SET do_not_contact = ${blocked},
          do_not_contact_at = ${blocked ? new Date() : null},
          do_not_contact_reason = ${blocked ? (body.reason || "Bloqueo manual por administrador") : null},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${params.id}
      RETURNING *;
    `;
    if (!blocked) {
      await sql`
        UPDATE contacts
        SET do_not_contact = FALSE,
            do_not_contact_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE company_id = ${params.id};
      `;
    }
    return jsonResponse({ data: res[0] });
  });

  // 6. GESTIÓN COMPLETA DE EMPRESAS (CRUD)
  router.get("/api/companies", async () => {
    const companies = await sql`
      SELECT c.*, u.full_name as commercial_owner_name,
        (SELECT COUNT(*) FROM deals WHERE company_id = c.id) as deals_count,
        (SELECT COUNT(*) FROM tickets WHERE company_id = c.id) as tickets_count
      FROM companies c
      LEFT JOIN users u ON c.commercial_owner_id = u.id
      ORDER BY c.name ASC;
    `;
    return jsonResponse({ data: companies });
  });

  router.post("/api/companies", async (req) => {
    const body = await parseBody(req);
    const { name, tax_id, external_erp_id, industry, commercial_owner_id, phone, email, address } = body;

    if (!name) {
      return jsonResponse({ error: "El nombre de la empresa es obligatorio" }, 400);
    }

    const res = await sql`
      INSERT INTO companies (name, tax_id, external_erp_id, industry, commercial_owner_id, phone, email, address)
      VALUES (${name}, ${tax_id || null}, ${external_erp_id || null}, ${industry || null}, ${commercial_owner_id || null}, ${phone || null}, ${email || null}, ${address || null})
      RETURNING *;
    `;

    return jsonResponse({ data: res[0] }, 201);
  });

  router.put("/api/companies/:id", async (req, params) => {
    const body = await parseBody(req);
    const { name, tax_id, external_erp_id, industry, commercial_owner_id, phone, email, address } = body;

    const res = await sql`
      UPDATE companies
      SET name = COALESCE(${name}, name),
          tax_id = ${tax_id || null},
          external_erp_id = ${external_erp_id || null},
          industry = ${industry || null},
          commercial_owner_id = ${commercial_owner_id || null},
          phone = ${phone || null},
          email = ${email || null},
          address = ${address || null},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${params.id}
      RETURNING *;
    `;

    return jsonResponse({ data: res[0] });
  });

  router.delete("/api/companies/:id", async (_, params) => {
    await sql`DELETE FROM companies WHERE id = ${params.id};`;
    return jsonResponse({ success: true });
  });

  // 7. GESTIÓN COMPLETA DE CONTACTOS (CRUD)
  router.get("/api/contacts", async () => {
    const contacts = await sql`
      SELECT ct.*, c.name as company_name, u.full_name as commercial_owner_name
      FROM contacts ct
      LEFT JOIN companies c ON ct.company_id = c.id
      LEFT JOIN users u ON ct.commercial_owner_id = u.id
      ORDER BY ct.full_name ASC;
    `;
    return jsonResponse({ data: contacts });
  });

  router.post("/api/contacts", async (req) => {
    const body = await parseBody(req);
    const { company_id, commercial_owner_id, full_name, email, phone, position_title } = body;

    if (!full_name || !company_id) {
      return jsonResponse({ error: "Nombre y empresa son obligatorios para el contacto" }, 400);
    }

    const res = await sql`
      INSERT INTO contacts (company_id, commercial_owner_id, full_name, email, phone, position_title)
      VALUES (${company_id}, ${commercial_owner_id || null}, ${full_name}, ${email || null}, ${phone || null}, ${position_title || null})
      RETURNING *;
    `;

    return jsonResponse({ data: res[0] }, 201);
  });

  router.put("/api/contacts/:id", async (req, params) => {
    const body = await parseBody(req);
    const { company_id, commercial_owner_id, full_name, email, phone, position_title } = body;

    const res = await sql`
      UPDATE contacts
      SET company_id = COALESCE(${company_id}, company_id),
          commercial_owner_id = ${commercial_owner_id || null},
          full_name = COALESCE(${full_name}, full_name),
          email = ${email || null},
          phone = ${phone || null},
          position_title = ${position_title || null},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${params.id}
      RETURNING *;
    `;

    return jsonResponse({ data: res[0] });
  });

  router.delete("/api/contacts/:id", async (_, params) => {
    await sql`DELETE FROM contacts WHERE id = ${params.id};`;
    return jsonResponse({ success: true });
  });
}
