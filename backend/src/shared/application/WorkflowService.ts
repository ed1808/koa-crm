import { sql } from "../../database/db";
import { eventBus } from "../infrastructure/EventBus";
import { AuthenticatedUser } from "../presentation/authMiddleware";

export async function recordStepHistory(
  targetType: "DEAL" | "TICKET" | "TASK",
  targetId: string,
  authorId: string | null,
  body: string,
  interactionType: "STAGE_HISTORY" | "FLOW_HANDOFF" = "STAGE_HISTORY"
) {
  const validAuthor = authorId && /^[0-9a-f-]{36}$/i.test(authorId) ? authorId : null;
  await sql`
    INSERT INTO interactions_comments (target_type, target_id, author_id, interaction_type, is_internal, body)
    VALUES (${targetType}, ${targetId}, ${validAuthor}, ${interactionType}, TRUE, ${body});
  `;
}

export async function finalizeAndHandoffRecord(params: {
  sourceType: "DEAL" | "TICKET";
  sourceId: string;
  user: AuthenticatedUser;
  note?: string;
  nextPipelineId?: string | null;
}) {
  const { sourceType, sourceId, user, note, nextPipelineId } = params;
  const validUserId = user.id && /^[0-9a-f-]{36}$/i.test(user.id) ? user.id : null;

  let sourceRecord: any;
  if (sourceType === "DEAL") {
    const rows = await sql`
      SELECT d.*, p.name as pipeline_name, ps.name as stage_name, c.commercial_owner_id as company_commercial_owner_id
      FROM deals d
      LEFT JOIN pipelines p ON d.pipeline_id = p.id
      LEFT JOIN pipeline_stages ps ON d.stage_id = ps.id
      LEFT JOIN companies c ON d.company_id = c.id
      WHERE d.id = ${sourceId}
      LIMIT 1;
    `;
    sourceRecord = rows[0];
  } else {
    const rows = await sql`
      SELECT t.*, p.name as pipeline_name, ps.name as stage_name, c.commercial_owner_id as company_commercial_owner_id
      FROM tickets t
      LEFT JOIN pipelines p ON t.pipeline_id = p.id
      LEFT JOIN pipeline_stages ps ON t.stage_id = ps.id
      LEFT JOIN companies c ON t.company_id = c.id
      WHERE t.id = ${sourceId}
      LIMIT 1;
    `;
    sourceRecord = rows[0];
  }

  if (!sourceRecord) {
    throw new Error(sourceType === "DEAL" ? "Oportunidad no encontrada" : "Ticket no encontrado");
  }

  if (sourceRecord.is_finalized) {
    throw new Error("Esta tarjeta ya fue finalizada anteriormente");
  }

  const sourceLabel = sourceType === "DEAL" ? sourceRecord.title : `#${sourceRecord.ticket_number} - ${sourceRecord.subject}`;
  let createdHandoff: { type: "DEAL" | "TICKET"; id: string; label: string; pipelineName: string } | null = null;

  if (nextPipelineId) {
    const targetPipelines = await sql`
      SELECT id, module_type, name, is_internal_only
      FROM pipelines
      WHERE id = ${nextPipelineId}
      LIMIT 1;
    `;
    if (!targetPipelines || targetPipelines.length === 0) {
      throw new Error("El flujo destino seleccionado no existe");
    }
    const targetPipeline = targetPipelines[0];

    const targetStages = await sql`
      SELECT id, name, default_sla_hours
      FROM pipeline_stages
      WHERE pipeline_id = ${targetPipeline.id}
      ORDER BY position ASC
      LIMIT 1;
    `;
    if (!targetStages || targetStages.length === 0) {
      throw new Error("El flujo destino no tiene etapas configuradas");
    }
    const firstStage = targetStages[0];

    if (targetPipeline.module_type === "TICKETS") {
      const scope = targetPipeline.is_internal_only ? "INTERNAL" : "CUSTOMER";
      const contactId = sourceRecord.primary_contact_id || sourceRecord.requester_contact_id || null;
      const slaDue = firstStage.default_sla_hours
        ? new Date(Date.now() + firstStage.default_sla_hours * 3600 * 1000)
        : null;
      const subject = `${targetPipeline.name}: ${sourceType === "DEAL" ? sourceRecord.title : sourceRecord.subject}`;
      const descParts = [
        note ? `Observación de transferencia:\n${note}` : null,
        `Originado automáticamente al finalizar "${sourceRecord.pipeline_name}" (${sourceLabel}) por ${user.full_name}.`,
      ].filter(Boolean);

      const newTickets = await sql`
        INSERT INTO tickets (
          ticket_scope, pipeline_id, stage_id, company_id, requester_contact_id,
          requester_user_id, assigned_agent_id, source_deal_id, queue_name,
          category, priority, subject, description, sla_due_at
        )
        VALUES (
          ${scope}, ${targetPipeline.id}, ${firstStage.id}, ${sourceRecord.company_id || null},
          ${contactId}, ${validUserId}, ${null}, ${sourceType === "DEAL" ? sourceRecord.id : sourceRecord.source_deal_id || null},
          ${targetPipeline.name}, ${targetPipeline.name}, 'MEDIUM',
          ${subject}, ${descParts.join("\n\n")}, ${slaDue}
        )
        RETURNING *;
      `;
      const newTicket = newTickets[0];

      // Crear tarea operativa vinculada al flujo de soporte destino (asignada a soporte o primer agente de soporte)
      const supportAgents = await sql`
        SELECT id FROM users WHERE role = 'SOPORTE' AND is_active = TRUE ORDER BY full_name ASC LIMIT 1;
      `;
      const defaultSupportId = supportAgents[0]?.id || null;

      const taskRes = await sql`
        INSERT INTO tasks (
          title, description, task_type, priority, queue_name,
          assigned_to_id, created_by_id, ticket_id, deal_id, company_id, contact_id, due_at
        )
        VALUES (
          ${`${targetPipeline.name}: ${sourceType === "DEAL" ? sourceRecord.title : sourceRecord.subject}`},
          ${descParts.join("\n\n")},
          'INTERNAL_ACTION',
          'HIGH',
          ${targetPipeline.name},
          ${defaultSupportId},
          ${validUserId},
          ${newTicket.id},
          ${sourceType === "DEAL" ? sourceRecord.id : null},
          ${sourceRecord.company_id || null},
          ${contactId},
          ${new Date(Date.now() + 24 * 3600 * 1000)}
        )
        RETURNING id;
      `;

      await recordStepHistory(
        "TASK",
        taskRes[0].id,
        validUserId,
        `Tarea creada automáticamente en flujo "${targetPipeline.name}" desde ${sourceType === "DEAL" ? "Comercial" : "Soporte"} (${sourceLabel}).`
      );

      await recordStepHistory(
        "TICKET",
        newTicket.id,
        validUserId,
        `Caso creado desde "${sourceRecord.pipeline_name}" (${sourceLabel}) en etapa inicial: ${firstStage.name}.${note ? `\nObservación: ${note}` : ""}`,
        "FLOW_HANDOFF"
      );

      createdHandoff = {
        type: "TICKET",
        id: newTicket.id,
        label: `Ticket #${newTicket.ticket_number}`,
        pipelineName: targetPipeline.name,
      };
    } else {
      // Target is CRM (Comercial)
      const contactId = sourceRecord.primary_contact_id || sourceRecord.requester_contact_id || null;
      const commercialOwnerId = sourceRecord.owner_id || sourceRecord.company_commercial_owner_id || null;
      const dealTitle = `${targetPipeline.name}: ${sourceType === "DEAL" ? sourceRecord.title : sourceRecord.subject}`;

      const newDeals = await sql`
        INSERT INTO deals (
          pipeline_id, stage_id, company_id, primary_contact_id, owner_id,
          source_ticket_id, title, amount, currency
        )
        VALUES (
          ${targetPipeline.id}, ${firstStage.id}, ${sourceRecord.company_id || null},
          ${contactId}, ${commercialOwnerId}, ${sourceType === "TICKET" ? sourceRecord.id : null},
          ${dealTitle}, ${sourceRecord.amount || 0}, 'COP'
        )
        RETURNING *;
      `;
      const newDeal = newDeals[0];

      const taskRes = await sql`
        INSERT INTO tasks (
          title, description, task_type, priority, queue_name,
          assigned_to_id, created_by_id, deal_id, ticket_id, company_id, contact_id, due_at
        )
        VALUES (
          ${`Seguimiento ${dealTitle}`},
          ${note || `Derivado desde ${sourceRecord.pipeline_name}`},
          'COMMERCIAL_FOLLOWUP',
          'HIGH',
          'Comercial',
          ${commercialOwnerId},
          ${validUserId},
          ${newDeal.id},
          ${sourceType === "TICKET" ? sourceRecord.id : null},
          ${sourceRecord.company_id || null},
          ${contactId},
          ${new Date(Date.now() + 24 * 3600 * 1000)}
        )
        RETURNING id;
      `;

      await recordStepHistory(
        "TASK",
        taskRes[0].id,
        validUserId,
        `Tarea comercial creada automáticamente en flujo "${targetPipeline.name}".`
      );

      await recordStepHistory(
        "DEAL",
        newDeal.id,
        validUserId,
        `Oportunidad creada desde "${sourceRecord.pipeline_name}" (${sourceLabel}) en etapa inicial: ${firstStage.name}.${note ? `\nObservación: ${note}` : ""}`,
        "FLOW_HANDOFF"
      );

      createdHandoff = {
        type: "DEAL",
        id: newDeal.id,
        label: newDeal.title,
        pipelineName: targetPipeline.name,
      };
    }

    await eventBus.publish(
      "workflow.handoff.created",
      {
        sourceType,
        sourceId,
        targetPipelineId: targetPipeline.id,
        targetPipelineName: targetPipeline.name,
        createdHandoff,
        byUser: user.full_name,
      },
      sourceType === "DEAL" ? "Deal" : "Ticket",
      sourceId
    );
  }

  // Marcar registro origen como finalizado
  if (sourceType === "DEAL") {
    await sql`
      UPDATE deals
      SET is_finalized = TRUE,
          finalized_at = CURRENT_TIMESTAMP,
          closed_at = COALESCE(closed_at, CURRENT_TIMESTAMP),
          handoff_target_type = ${createdHandoff ? createdHandoff.type : null},
          handoff_target_id = ${createdHandoff ? createdHandoff.id : null},
          last_activity_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${sourceId};
    `;
  } else {
    await sql`
      UPDATE tickets
      SET is_finalized = TRUE,
          finalized_at = CURRENT_TIMESTAMP,
          closed_at = COALESCE(closed_at, CURRENT_TIMESTAMP),
          handoff_target_type = ${createdHandoff ? createdHandoff.type : null},
          handoff_target_id = ${createdHandoff ? createdHandoff.id : null},
          last_activity_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${sourceId};
    `;
  }

  const originHistoryMsg = createdHandoff
    ? `Flujo finalizado y derivado a "${createdHandoff.pipelineName}" (${createdHandoff.label}) por ${user.full_name}.${note ? `\nObservación: ${note}` : ""}`
    : `Flujo finalizado por ${user.full_name}.${note ? `\nObservación: ${note}` : ""}`;

  await recordStepHistory(sourceType, sourceId, validUserId, originHistoryMsg, "FLOW_HANDOFF");

  return {
    finalized: true,
    handoff: createdHandoff,
  };
}
