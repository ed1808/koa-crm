import { NativeRouter, jsonResponse, parseBody } from "../../shared/infrastructure/Router";
import { sql } from "../../database/db";
import { eventBus } from "../../shared/infrastructure/EventBus";
import { MockLlmService } from "./MockLlmService";
import { resolveAuthUser } from "../../shared/presentation/authMiddleware";
import { recordStepHistory } from "../../shared/application/WorkflowService";
import { applyDealOutcome, DealOutcomeStatus, getRecoverySettings } from "../../shared/application/RecoveryService";

const llmService = new MockLlmService();

export function registerAiCopilotRoutes(router: NativeRouter) {
  // 1. Endpoint principal de chat contextual del Copiloto
  router.post("/api/copilot/chat", async (req) => {
    const body = await parseBody(req);
    const { ticket_id, deal_id, user_message } = body;

    let systemContext: any = {};

    // Si viene contexto de ticket, consultar datos de la empresa, contacto y asesor comercial asignado
    if (ticket_id) {
      const ticketData = await sql`
        SELECT 
          t.id, t.ticket_number, t.subject, t.description, t.category, t.priority,
          c.id as company_id, c.name as company_name,
          ct.id as contact_id, ct.full_name as contact_name,
          u_owner.id as commercial_owner_id, u_owner.full_name as commercial_owner_name,
          ps.name as stage_name
        FROM tickets t
        LEFT JOIN companies c ON t.company_id = c.id
        LEFT JOIN users u_owner ON c.commercial_owner_id = u_owner.id
        LEFT JOIN contacts ct ON t.requester_contact_id = ct.id
        LEFT JOIN pipeline_stages ps ON t.stage_id = ps.id
        WHERE t.id = ${ticket_id}
        LIMIT 1;
      `;

      if (ticketData.length > 0) {
        const td = ticketData[0];
        systemContext = {
          mode: "TICKET",
          ticketId: td.id,
          ticketNumber: td.ticket_number,
          subject: td.subject,
          description: td.description,
          companyId: td.company_id,
          companyName: td.company_name,
          contactId: td.contact_id,
          contactName: td.contact_name,
          commercialOwnerId: td.commercial_owner_id,
          commercialOwnerName: td.commercial_owner_name,
          stageName: td.stage_name,
        };
      }
    } else if (deal_id) {
      const dealData = await sql`
        SELECT
          d.id, d.title, d.amount, d.last_activity_at, d.created_at, d.outcome_status,
          c.id as company_id, c.name as company_name, c.do_not_contact as company_do_not_contact,
          ct.full_name as contact_name,
          ps.name as stage_name,
          u.full_name as owner_name
        FROM deals d
        LEFT JOIN companies c ON d.company_id = c.id
        LEFT JOIN contacts ct ON d.primary_contact_id = ct.id
        LEFT JOIN pipeline_stages ps ON d.stage_id = ps.id
        LEFT JOIN users u ON d.owner_id = u.id
        WHERE d.id = ${deal_id}
        LIMIT 1;
      `;

      if (dealData.length > 0) {
        const dd = dealData[0];
        const settings = await getRecoverySettings();
        const unitLabel = settings.interval_unit === "DAYS" ? "día(s)" : settings.interval_unit === "WEEKS" ? "semana(s)" : "mes(es)";
        const lastActivity = dd.last_activity_at || dd.created_at;
        systemContext = {
          mode: "DEAL",
          dealId: dd.id,
          dealTitle: dd.title,
          amount: dd.amount,
          stageName: dd.stage_name,
          companyId: dd.company_id,
          companyName: dd.company_name,
          companyDoNotContact: Boolean(dd.company_do_not_contact),
          contactName: dd.contact_name,
          ownerName: dd.owner_name,
          lastActivityDate: lastActivity ? new Date(lastActivity).toISOString().slice(0, 10) : "Hoy",
          recoveryIntervalText: `${settings.interval_value} ${unitLabel}`,
        };
      }
    }

    const aiResponse = await llmService.processChat(
      {
        ticket_id,
        deal_id,
        user_message: user_message || "Hola copiloto",
      },
      systemContext
    );

    return jsonResponse({ data: aiResponse });
  });

  // 2. Ejecutar acción de derivación o gestión comercial mediante Copiloto
  router.post("/api/copilot/execute-action", async (req) => {
    const authUser = await resolveAuthUser(req);
    const body = await parseBody(req);
    const { action, ticket_id, deal_id, payload = {} } = body;

    if (action === "APPLY_DEAL_OUTCOME") {
      try {
        const targetDealId = deal_id || payload.deal_id;
        if (!targetDealId) {
          return jsonResponse({ error: "deal_id es requerido para ejecutar esta acción" }, 400);
        }
        const outcome = String(payload.outcome || "").toUpperCase() as DealOutcomeStatus;
        if (!["POSTPONED_RECOVERY", "LOST_DEFINITIVE", "DO_NOT_CONTACT", "ACTIVE"].includes(outcome)) {
          return jsonResponse({ error: "outcome inválido" }, 400);
        }

        const result = await applyDealOutcome({
          dealId: targetDealId,
          outcome,
          user: authUser,
          reason: payload.reason,
          managementDate: payload.management_date || null,
        });

        await sql`
          INSERT INTO interactions_comments (target_type, target_id, author_id, interaction_type, is_internal, body)
          VALUES ('DEAL', ${targetDealId}, ${authUser.id}, 'AI_SUMMARY', TRUE, ${`✨ Copiloto IA ejecutó resultado "${outcome}"${result.recoveryDate ? ` con recuperación programada para ${result.recoveryDate}` : ""}.`});
        `;

        const msgMap: Record<DealOutcomeStatus, string> = {
          ACTIVE: "Oportunidad reactivada en el pipeline Comercial.",
          POSTPONED_RECOVERY: `Oportunidad retirada del pipeline y tarea de recuperación programada para el ${result.recoveryDate}.`,
          LOST_DEFINITIVE: "Negocio marcado como desistido definitivamente, retirado del pipeline y tareas vinculadas canceladas.",
          DO_NOT_CONTACT: "Empresa/contacto marcados como No Contactar, tareas pendientes canceladas y oportunidades retiradas de los pipelines.",
        };

        return jsonResponse({
          success: true,
          message: msgMap[outcome],
          data: result,
        });
      } catch (err: any) {
        return jsonResponse({ error: err.message }, 400);
      }
    }

    if (action === "CREATE_COMMERCIAL_TASK") {
      // 1. Obtener datos del ticket y propietario comercial de la empresa
      const ticket = await sql`
        SELECT t.*, c.commercial_owner_id, c.name as company_name
        FROM tickets t
        LEFT JOIN companies c ON t.company_id = c.id
        WHERE t.id = ${ticket_id}
        LIMIT 1;
      `;

      if (!ticket || ticket.length === 0) {
        return jsonResponse({ error: "Ticket not found" }, 404);
      }

      const assignedOwnerId = payload.assigned_to_id || ticket[0].commercial_owner_id;
      const title = payload.title || `Oportunidad detectada por IA en Ticket #${ticket[0].ticket_number}`;

      // 2. Crear Tarea comercial asignada al asesor
      const taskRes = await sql`
        INSERT INTO tasks (
          title, description, task_type, priority, queue_name,
          assigned_to_id, ticket_id, company_id, due_at
        )
        VALUES (
          ${title}, 
          ${'Generada automáticamente por Copiloto IA desde soporte: ' + ticket[0].subject},
          'COMMERCIAL_FOLLOWUP',
          ${payload.priority || 'HIGH'},
          'Comercial',
          ${assignedOwnerId},
          ${ticket_id},
          ${ticket[0].company_id},
          ${new Date(Date.now() + 24 * 3600 * 1000)}
        )
        RETURNING *;
      `;

      // 3. Registrar nota interna en el Ticket
      await sql`
        INSERT INTO interactions_comments (target_type, target_id, interaction_type, is_internal, body)
        VALUES ('TICKET', ${ticket_id}, 'AI_SUMMARY', TRUE, ${`✨ Copiloto IA generó tarea comercial vinculada para el asesor comercial encargado.`});
      `;

      // 4. Publicar evento en RabbitMQ
      await eventBus.publish(
        "support.commercial_lead.delegated",
        {
          ticketId: ticket_id,
          ticketNumber: ticket[0].ticket_number,
          taskId: taskRes[0].id,
          commercialOwnerId: assignedOwnerId,
          companyId: ticket[0].company_id,
        },
        "Ticket",
        ticket_id
      );

      return jsonResponse({
        success: true,
        message: "Tarea comercial generada con éxito y asesor notificado",
        data: taskRes[0],
      });
    }

    if (action === "CREATE_DEAL_FROM_TICKET") {
      const ticket = await sql`
        SELECT t.*, c.commercial_owner_id, c.name as company_name, c.do_not_contact as company_do_not_contact
        FROM tickets t
        LEFT JOIN companies c ON t.company_id = c.id
        WHERE t.id = ${ticket_id}
        LIMIT 1;
      `;

      if (ticket[0]?.company_do_not_contact) {
        return jsonResponse({ error: `La empresa "${ticket[0].company_name}" está marcada como No Contactar.` }, 400);
      }

      // Obtener el primer pipeline de CRM y su primera etapa
      const stage = await sql`
        SELECT ps.id as stage_id, ps.name as stage_name, ps.pipeline_id
        FROM pipeline_stages ps
        JOIN pipelines p ON ps.pipeline_id = p.id
        WHERE p.module_type = 'CRM'
        ORDER BY p.is_default DESC, ps.position ASC
        LIMIT 1;
      `;

      if (stage.length === 0) {
        return jsonResponse({ error: "No CRM pipeline stage available" }, 400);
      }

      const dealRes = await sql`
        INSERT INTO deals (
          pipeline_id, stage_id, company_id, owner_id,
          source_ticket_id, title, amount, currency, expected_close_date
        )
        VALUES (
          ${stage[0].pipeline_id},
          ${stage[0].stage_id},
          ${ticket[0].company_id},
          ${ticket[0].commercial_owner_id},
          ${ticket_id},
          ${payload.title || `Oportunidad Ticket #${ticket[0].ticket_number}`},
          ${payload.amount || 1000000},
          'COP',
          ${new Date(Date.now() + 15 * 24 * 3600 * 1000)}
        )
        RETURNING *;
      `;

      await recordStepHistory(
        "DEAL",
        dealRes[0].id,
        authUser.id,
        `Oportunidad creada por Copiloto IA desde Ticket #${ticket[0].ticket_number} en etapa "${stage[0].stage_name}".`
      );

      return jsonResponse({
        success: true,
        message: "Negocio creado en el pipeline comercial a partir del ticket",
        data: dealRes[0],
      });
    }

    return jsonResponse({ error: "Unsupported action" }, 400);
  });
}
