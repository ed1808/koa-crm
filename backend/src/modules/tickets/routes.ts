import { NativeRouter, jsonResponse, parseBody } from "../../shared/infrastructure/Router";
import { sql } from "../../database/db";
import { eventBus } from "../../shared/infrastructure/EventBus";
import { resolveAuthUser } from "../../shared/presentation/authMiddleware";
import { recordStepHistory, finalizeAndHandoffRecord } from "../../shared/application/WorkflowService";

export function registerTicketsRoutes(router: NativeRouter) {
  // 1. Tablero Kanban de Tickets (con filtros por pipeline, asignado, cliente o interno)
  router.get("/api/tickets/kanban", async (req) => {
    const url = new URL(req.url);
    const pipelineId = url.searchParams.get("pipeline_id");
    const agentId = url.searchParams.get("agent_id");
    const unassigned = url.searchParams.get("unassigned") === "true";
    const scope = url.searchParams.get("scope"); // CUSTOMER o INTERNAL
    const search = url.searchParams.get("search");

    const user = await resolveAuthUser(req);

    if (!pipelineId) {
      return jsonResponse({ error: "pipeline_id is required" }, 400);
    }

    const pipelineRows = await sql`
      SELECT id, is_internal_only FROM pipelines WHERE id = ${pipelineId} LIMIT 1;
    `;
    if (user.role === "CLIENTE" && pipelineRows[0]?.is_internal_only) {
      return jsonResponse({ error: "No tiene permisos para ver este flujo interno" }, 403);
    }

    const stages = await sql`
      SELECT id, name, position, status_category, default_sla_hours, color_hex
      FROM pipeline_stages
      WHERE pipeline_id = ${pipelineId}
      ORDER BY position ASC;
    `;
    const maxStagePosition = stages.reduce((max: number, s: any) => Math.max(max, Number(s.position || 0)), 0);

    // Filtros de RBAC
    let tickets = await sql`
      SELECT 
        t.id, t.ticket_number, t.ticket_scope, t.pipeline_id, t.stage_id,
        t.queue_name, t.category, t.priority, t.subject, t.description,
        t.is_finalized, t.finalized_at, t.handoff_target_type, t.handoff_target_id,
        t.source_deal_id, t.requester_user_id, t.external_provider_id,
        t.sla_due_at, t.sla_breached, t.closed_at, t.last_activity_at, t.next_activity_at, t.created_at,
        ps.position as stage_position,
        c.name as company_name, c.id as company_id,
        ct.full_name as contact_name, ct.id as contact_id,
        u.full_name as assigned_agent_name, u.id as assigned_agent_id,
        prov.full_name as external_provider_name
      FROM tickets t
      LEFT JOIN pipeline_stages ps ON t.stage_id = ps.id
      LEFT JOIN companies c ON t.company_id = c.id
      LEFT JOIN contacts ct ON t.requester_contact_id = ct.id
      LEFT JOIN users u ON t.assigned_agent_id = u.id
      LEFT JOIN users prov ON t.external_provider_id = prov.id
      WHERE t.pipeline_id = ${pipelineId}
      ORDER BY t.created_at DESC;
    `;

    // RBAC por rol
    if (user.role === "CLIENTE") {
      tickets = user.linked_company_id
        ? tickets.filter((t: any) => t.company_id === user.linked_company_id && t.ticket_scope === "CUSTOMER")
        : [];
    } else if (user.role === "PROVEEDOR") {
      tickets = tickets.filter((t: any) => t.external_provider_id === user.id);
    } else if (user.role === "COMERCIAL" || user.role === "EMPLEADO_INTERNO") {
      tickets = tickets.filter(
        (t: any) =>
          t.ticket_scope === "INTERNAL" &&
          (t.requester_user_id === user.id || t.assigned_agent_id === user.id)
      );
    }

    const columns = stages.map((stage: any) => {
      let stageTickets = tickets
        .filter((t: any) => t.stage_id === stage.id)
        .map((t: any) => ({ ...t, max_stage_position: maxStagePosition }));

      if (agentId) {
        stageTickets = stageTickets.filter((t: any) => t.assigned_agent_id === agentId);
      }
      if (unassigned) {
        stageTickets = stageTickets.filter((t: any) => !t.assigned_agent_id);
      }
      if (scope) {
        stageTickets = stageTickets.filter((t: any) => t.ticket_scope === scope);
      }
      if (search) {
        const q = search.toLowerCase();
        stageTickets = stageTickets.filter(
          (t: any) =>
            t.subject.toLowerCase().includes(q) ||
            t.ticket_number.toString().includes(q) ||
            (t.company_name && t.company_name.toLowerCase().includes(q))
        );
      }

      return {
        stage,
        tickets: stageTickets,
        count: stageTickets.length,
      };
    });

    return jsonResponse({
      data: {
        columns,
        totalTickets: tickets.length,
        maxStagePosition,
      },
    });
  });

  // 2. Mover Ticket de etapa (Drag & Drop)
  router.patch("/api/tickets/:id/stage", async (req, params) => {
    const user = await resolveAuthUser(req);
    const body = await parseBody(req);
    const { target_stage_id } = body;

    if (!target_stage_id) {
      return jsonResponse({ error: "target_stage_id is required" }, 400);
    }

    const currentTicket = await sql`
      SELECT t.id, t.stage_id, ps.name as current_stage_name
      FROM tickets t
      LEFT JOIN pipeline_stages ps ON t.stage_id = ps.id
      WHERE t.id = ${params.id}
      LIMIT 1;
    `;
    if (!currentTicket || currentTicket.length === 0) {
      return jsonResponse({ error: "Ticket not found" }, 404);
    }

    const targetStage = await sql`
      SELECT id, name, status_category
      FROM pipeline_stages
      WHERE id = ${target_stage_id}
      LIMIT 1;
    `;

    if (!targetStage || targetStage.length === 0) {
      return jsonResponse({ error: "Target stage not found" }, 404);
    }

    const isClosed = targetStage[0].status_category === "WON_RESOLVED" || targetStage[0].status_category === "LOST_CLOSED";
    const closedAt = isClosed ? new Date() : null;

    const updated = await sql`
      UPDATE tickets
      SET stage_id = ${target_stage_id},
          closed_at = ${closedAt},
          last_activity_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${params.id}
      RETURNING *;
    `;

    if (currentTicket[0].stage_id !== target_stage_id) {
      await recordStepHistory(
        "TICKET",
        params.id,
        user.id,
        `Etapa actualizada de "${currentTicket[0].current_stage_name || "Etapa"}" a "${targetStage[0].name}".`
      );
    }

    await eventBus.publish(
      "tickets.stage_changed",
      {
        ticketId: params.id,
        targetStageId: target_stage_id,
        stageName: targetStage[0].name,
      },
      "Ticket",
      params.id
    );

    return jsonResponse({ data: updated[0] });
  });

  // 3. Crear nuevo Ticket (con restricciones estrictas por rol)
  router.post("/api/tickets", async (req) => {
    const user = await resolveAuthUser(req);
    const body = await parseBody(req);
    const {
      ticket_scope,
      pipeline_id,
      stage_id,
      company_id,
      requester_contact_id,
      requester_user_id,
      assigned_agent_id,
      external_provider_id,
      queue_name,
      category,
      priority,
      subject,
      description,
      sla_hours,
    } = body;

    if (!pipeline_id || !stage_id || !subject || !description) {
      return jsonResponse({ error: "pipeline_id, stage_id, subject, and description are required" }, 400);
    }

    const pipelineRows = await sql`
      SELECT id, is_internal_only FROM pipelines WHERE id = ${pipeline_id} LIMIT 1;
    `;
    if (user.role === "CLIENTE" && pipelineRows[0]?.is_internal_only) {
      return jsonResponse({ error: "Los clientes no pueden crear tickets en flujos internos" }, 403);
    }

    // Reglas por rol (Punto 5):
    // - COMERCIAL / EMPLEADO_INTERNO: siempre INTERNAL, sin asignar, prioridad MEDIUM (la define soporte), requester = usuario actual
    // - CLIENTE: siempre CUSTOMER, sin asignar, prioridad MEDIUM, empresa tomada automáticamente de users.linked_company_id
    let effectiveScope = ticket_scope || "CUSTOMER";
    let effectiveAssignedAgentId: string | null = assigned_agent_id || null;
    let effectivePriority = priority || "MEDIUM";
    let effectiveCompanyId: string | null = company_id || null;
    let effectiveRequesterUserId: string | null = requester_user_id || user.id || null;
    let effectiveExternalProviderId: string | null = external_provider_id || null;

    if (user.role === "COMERCIAL" || user.role === "EMPLEADO_INTERNO") {
      effectiveScope = "INTERNAL";
      effectiveAssignedAgentId = null;
      effectivePriority = "MEDIUM";
      effectiveRequesterUserId = user.id;
      effectiveExternalProviderId = null;
    } else if (user.role === "CLIENTE") {
      effectiveScope = "CUSTOMER";
      effectiveAssignedAgentId = null;
      effectivePriority = "MEDIUM";
      effectiveCompanyId = user.linked_company_id || null;
      effectiveRequesterUserId = user.id;
      effectiveExternalProviderId = null;
    }

    const slaDue = sla_hours ? new Date(Date.now() + sla_hours * 3600 * 1000) : null;

    const res = await sql`
      INSERT INTO tickets (
        ticket_scope, pipeline_id, stage_id, company_id, requester_contact_id,
        requester_user_id, assigned_agent_id, external_provider_id, queue_name,
        category, priority, subject, description, sla_due_at
      )
      VALUES (
        ${effectiveScope}, ${pipeline_id}, ${stage_id}, ${effectiveCompanyId},
        ${requester_contact_id || null}, ${effectiveRequesterUserId}, ${effectiveAssignedAgentId},
        ${effectiveExternalProviderId}, ${queue_name || (effectiveScope === "INTERNAL" ? "Soporte Interno" : "General")},
        ${category || "Soporte General"}, ${effectivePriority}, ${subject}, ${description}, ${slaDue}
      )
      RETURNING *;
    `;

    const stageRows = await sql`SELECT name FROM pipeline_stages WHERE id = ${stage_id} LIMIT 1;`;
    const stageName = stageRows[0]?.name || "Inicial";
    await recordStepHistory(
      "TICKET",
      res[0].id,
      user.id,
      `Ticket #${res[0].ticket_number} creado en etapa "${stageName}" (${effectiveScope === "INTERNAL" ? "Soporte Interno" : "Atención a Cliente"}).`
    );

    return jsonResponse({ data: res[0] }, 201);
  });

  // 3b. Triaje de Ticket (Asignar responsable y prioridad - solo ADMIN o SOPORTE)
  router.patch("/api/tickets/:id", async (req, params) => {
    const user = await resolveAuthUser(req);
    if (user.role !== "ADMIN" && user.role !== "SOPORTE") {
      return jsonResponse({ error: "Solo el equipo de Soporte o Administradores pueden modificar prioridad o responsable" }, 403);
    }

    const body = await parseBody(req);
    const { priority, assigned_agent_id } = body;

    const existing = await sql`
      SELECT t.id, t.priority, t.assigned_agent_id, u.full_name as prev_agent_name
      FROM tickets t
      LEFT JOIN users u ON t.assigned_agent_id = u.id
      WHERE t.id = ${params.id}
      LIMIT 1;
    `;
    if (!existing || existing.length === 0) {
      return jsonResponse({ error: "Ticket not found" }, 404);
    }

    const nextPriority = priority !== undefined ? priority : existing[0].priority;
    const nextAgentId =
      assigned_agent_id !== undefined ? (assigned_agent_id ? assigned_agent_id : null) : existing[0].assigned_agent_id;

    const updated = await sql`
      UPDATE tickets
      SET priority = ${nextPriority},
          assigned_agent_id = ${nextAgentId},
          last_activity_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${params.id}
      RETURNING *;
    `;

    const changes: string[] = [];
    if (priority !== undefined && priority !== existing[0].priority) {
      changes.push(`Prioridad ajustada de ${existing[0].priority} a ${nextPriority}`);
    }
    if (assigned_agent_id !== undefined && nextAgentId !== existing[0].assigned_agent_id) {
      let nextAgentName = "Sin asignar";
      if (nextAgentId) {
        const agentRows = await sql`SELECT full_name FROM users WHERE id = ${nextAgentId} LIMIT 1;`;
        nextAgentName = agentRows[0]?.full_name || "Agente";
      }
      changes.push(`Responsable asignado: ${nextAgentName}`);
    }
    if (changes.length > 0) {
      await recordStepHistory("TICKET", params.id, user.id, `Triaje de Soporte: ${changes.join(" · ")}.`);
    }

    return jsonResponse({ data: updated[0] });
  });

  // 4. Detalle completo de un Ticket (Drawer 360°)
  router.get("/api/tickets/:id", async (req, params) => {
    const user = await resolveAuthUser(req);

    const ticket = await sql`
      SELECT 
        t.*,
        c.name as company_name, c.tax_id as company_tax_id, c.commercial_owner_id,
        u_owner.full_name as commercial_owner_name, u_owner.email as commercial_owner_email,
        ct.full_name as requester_contact_name, ct.email as requester_contact_email, ct.phone as requester_contact_phone,
        u_agent.full_name as assigned_agent_name, u_agent.email as assigned_agent_email,
        u_req.full_name as requester_user_name,
        prov.full_name as external_provider_name,
        p.name as pipeline_name,
        ps.name as stage_name, ps.position as stage_position, ps.status_category as stage_status, ps.color_hex as stage_color,
        d_src.title as source_deal_title
      FROM tickets t
      LEFT JOIN companies c ON t.company_id = c.id
      LEFT JOIN users u_owner ON c.commercial_owner_id = u_owner.id
      LEFT JOIN contacts ct ON t.requester_contact_id = ct.id
      LEFT JOIN users u_agent ON t.assigned_agent_id = u_agent.id
      LEFT JOIN users u_req ON t.requester_user_id = u_req.id
      LEFT JOIN users prov ON t.external_provider_id = prov.id
      LEFT JOIN pipelines p ON t.pipeline_id = p.id
      LEFT JOIN pipeline_stages ps ON t.stage_id = ps.id
      LEFT JOIN deals d_src ON t.source_deal_id = d_src.id
      WHERE t.id = ${params.id}
      LIMIT 1;
    `;

    if (!ticket || ticket.length === 0) {
      return jsonResponse({ error: "Ticket not found" }, 404);
    }

    const stages = await sql`
      SELECT id, name, position, status_category, color_hex
      FROM pipeline_stages
      WHERE pipeline_id = ${ticket[0].pipeline_id}
      ORDER BY position ASC;
    `;
    const maxStagePosition = stages.reduce((max: number, s: any) => Math.max(max, Number(s.position || 0)), 0);

    // Comentarios, notas y timeline de pasos
    let commentsQuery;
    if (user.role === "CLIENTE") {
      // Clientes no ven notas internas
      commentsQuery = await sql`
        SELECT i.*, u.full_name as author_name, u.role as author_role
        FROM interactions_comments i
        LEFT JOIN users u ON i.author_id = u.id
        WHERE i.target_type = 'TICKET' AND i.target_id = ${params.id} AND i.is_internal = FALSE
        ORDER BY i.created_at DESC;
      `;
    } else {
      commentsQuery = await sql`
        SELECT i.*, u.full_name as author_name, u.role as author_role
        FROM interactions_comments i
        LEFT JOIN users u ON i.author_id = u.id
        WHERE i.target_type = 'TICKET' AND i.target_id = ${params.id}
        ORDER BY i.created_at DESC;
      `;
    }

    // Tareas vinculadas a este ticket
    const tasks = await sql`
      SELECT t.*, u.full_name as assigned_to_name
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to_id = u.id
      WHERE t.ticket_id = ${params.id}
      ORDER BY t.due_at ASC;
    `;

    return jsonResponse({
      data: {
        ticket: { ...ticket[0], max_stage_position: maxStagePosition },
        stages,
        comments: commentsQuery,
        tasks,
      },
    });
  });

  // 5. Agregar comentario o nota interna a un Ticket (con "Siguiente paso" opcional)
  router.post("/api/tickets/:id/comments", async (req, params) => {
    const user = await resolveAuthUser(req);
    const body = await parseBody(req);
    const { author_id, body: commentBody, is_internal, next_stage_id } = body;

    if (!commentBody) {
      return jsonResponse({ error: "body is required" }, 400);
    }

    const effectiveAuthorId = author_id || user.id;
    let movedToStage: any = null;

    if (next_stage_id && user.role !== "CLIENTE") {
      const currentTicket = await sql`
        SELECT t.id, t.stage_id, ps.name as current_stage_name
        FROM tickets t
        LEFT JOIN pipeline_stages ps ON t.stage_id = ps.id
        WHERE t.id = ${params.id}
        LIMIT 1;
      `;
      const targetStage = await sql`
        SELECT id, name, status_category
        FROM pipeline_stages
        WHERE id = ${next_stage_id}
        LIMIT 1;
      `;
      if (currentTicket.length > 0 && targetStage.length > 0 && currentTicket[0].stage_id !== next_stage_id) {
        const isClosed = targetStage[0].status_category === "WON_RESOLVED" || targetStage[0].status_category === "LOST_CLOSED";
        const closedAt = isClosed ? new Date() : null;
        await sql`
          UPDATE tickets
          SET stage_id = ${next_stage_id},
              closed_at = ${closedAt},
              last_activity_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${params.id};
        `;
        await recordStepHistory(
          "TICKET",
          params.id,
          effectiveAuthorId,
          `Siguiente paso aplicado: "${currentTicket[0].current_stage_name || "Etapa"}" → "${targetStage[0].name}".`
        );
        await eventBus.publish(
          "tickets.stage_changed",
          {
            ticketId: params.id,
            targetStageId: next_stage_id,
            stageName: targetStage[0].name,
          },
          "Ticket",
          params.id
        );
        movedToStage = targetStage[0];
      }
    }

    const effectiveIsInternal = user.role === "CLIENTE" ? false : Boolean(is_internal);

    const res = await sql`
      INSERT INTO interactions_comments (target_type, target_id, author_id, interaction_type, is_internal, body)
      VALUES ('TICKET', ${params.id}, ${effectiveAuthorId}, ${effectiveIsInternal ? 'INTERNAL_NOTE' : 'COMMENT'}, ${effectiveIsInternal}, ${commentBody})
      RETURNING *;
    `;

    await sql`
      UPDATE tickets
      SET last_activity_at = CURRENT_TIMESTAMP
      WHERE id = ${params.id};
    `;

    return jsonResponse({ data: res[0], movedToStage }, 201);
  });

  // 5b. Finalizar Ticket en última etapa y opcionalmente generar siguiente flujo
  router.post("/api/tickets/:id/finalize", async (req, params) => {
    try {
      const user = await resolveAuthUser(req);
      const body = await parseBody(req);
      const result = await finalizeAndHandoffRecord({
        sourceType: "TICKET",
        sourceId: params.id,
        user,
        note: body.body || body.note,
        nextPipelineId: body.next_pipeline_id || null,
      });
      return jsonResponse({ data: result });
    } catch (err: any) {
      const status = err.message === "RECORD_NOT_FOUND" ? 404 : 400;
      return jsonResponse({ error: err.message }, status);
    }
  });
}
