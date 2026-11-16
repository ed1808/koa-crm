import { sql } from "../../database/db";
import { eventBus } from "../infrastructure/EventBus";
import { AuthenticatedUser } from "../presentation/authMiddleware";
import { recordStepHistory } from "./WorkflowService";

export type IntervalUnit = "DAYS" | "WEEKS" | "MONTHS";
export type DealOutcomeStatus = "ACTIVE" | "POSTPONED_RECOVERY" | "LOST_DEFINITIVE" | "DO_NOT_CONTACT";

export interface RecoverySettings {
  interval_value: number;
  interval_unit: IntervalUnit;
}

const UNIT_LABELS: Record<IntervalUnit, string> = {
  DAYS: "día(s)",
  WEEKS: "semana(s)",
  MONTHS: "mes(es)",
};

export async function getRecoverySettings(): Promise<RecoverySettings> {
  const rows = await sql`
    SELECT value_json
    FROM system_settings
    WHERE key = 'commercial_recovery'
    LIMIT 1;
  `;
  const val = rows[0]?.value_json;
  const intervalValue = Number(val?.interval_value);
  const intervalUnit = String(val?.interval_unit || "MONTHS").toUpperCase() as IntervalUnit;

  return {
    interval_value: Number.isFinite(intervalValue) && intervalValue >= 1 ? intervalValue : 1,
    interval_unit: ["DAYS", "WEEKS", "MONTHS"].includes(intervalUnit) ? intervalUnit : "MONTHS",
  };
}

/**
 * Adds a configured calendar interval (DAYS / WEEKS / MONTHS) to a management date.
 * Date-only strings (YYYY-MM-DD) are anchored at 12:00:00Z so timezone offsets never shift the calendar day.
 */
export function addConfiguredInterval(
  baseInput: string | Date,
  value: number,
  unit: IntervalUnit
): Date {
  let d: Date;
  if (typeof baseInput === "string" && /^\d{4}-\d{2}-\d{2}$/.test(baseInput.trim())) {
    d = new Date(`${baseInput.trim()}T12:00:00.000Z`);
  } else {
    const parsed = new Date(baseInput);
    const yyyy = parsed.getUTCFullYear();
    const mm = String(parsed.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(parsed.getUTCDate()).padStart(2, "0");
    d = new Date(`${yyyy}-${mm}-${dd}T12:00:00.000Z`);
  }

  if (unit === "DAYS") {
    d.setUTCDate(d.getUTCDate() + value);
    return d;
  }
  if (unit === "WEEKS") {
    d.setUTCDate(d.getUTCDate() + value * 7);
    return d;
  }

  // MONTHS: preserve day of month, clamping to last day of target month if needed
  const origDay = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + value);
  const daysInTargetMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(origDay, daysInTargetMonth));
  return d;
}

export function formatIsoDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function applyDealOutcome(params: {
  dealId: string;
  outcome: DealOutcomeStatus;
  user: AuthenticatedUser;
  reason?: string;
  managementDate?: string | null;
  sourceTaskId?: string | null;
}) {
  const { dealId, outcome, user, reason, managementDate, sourceTaskId } = params;

  const dealRows = await sql`
    SELECT d.*, c.name as company_name, c.do_not_contact as company_do_not_contact,
           ct.full_name as contact_name
    FROM deals d
    LEFT JOIN companies c ON d.company_id = c.id
    LEFT JOIN contacts ct ON d.primary_contact_id = ct.id
    WHERE d.id = ${dealId}
    LIMIT 1;
  `;

  if (!dealRows || dealRows.length === 0) {
    throw new Error("DEAL_NOT_FOUND");
  }

  const deal = dealRows[0];

  // Parse base management date: explicit managementDate > deal.last_activity_at > deal.created_at > now
  let baseDate: Date;
  if (managementDate && managementDate.trim()) {
    baseDate = /^\d{4}-\d{2}-\d{2}$/.test(managementDate.trim())
      ? new Date(`${managementDate.trim()}T12:00:00.000Z`)
      : new Date(managementDate);
  } else if (deal.last_activity_at) {
    baseDate = new Date(deal.last_activity_at);
  } else {
    baseDate = new Date(deal.created_at || Date.now());
  }

  if (Number.isNaN(baseDate.getTime())) {
    baseDate = new Date();
  }

  if (outcome === "ACTIVE") {
    if (deal.company_do_not_contact) {
      throw new Error("La empresa tiene restricción activa de No Contactar. Un administrador debe habilitarla primero en Configuración.");
    }

    const updated = await sql`
      UPDATE deals
      SET outcome_status = 'ACTIVE',
          is_archived = FALSE,
          archived_at = NULL,
          recovery_due_at = NULL,
          outcome_reason = ${reason || null},
          closed_at = NULL,
          last_activity_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${dealId}
      RETURNING *;
    `;

    await recordStepHistory(
      "DEAL",
      dealId,
      user.id,
      `Oportunidad reactivada en el pipeline Comercial.${reason ? ` Nota: ${reason}` : ""}`
    );

    if (sourceTaskId) {
      await sql`
        UPDATE tasks
        SET status = 'COMPLETED',
            completed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${sourceTaskId};
      `;
      await recordStepHistory(
        "TASK",
        sourceTaskId,
        user.id,
        `Tarea de recuperación completada: la oportunidad "${deal.title}" fue reactivada en el pipeline Comercial.`
      );
    }

    await eventBus.publish(
      "crm.deal.reactivated",
      { dealId, title: deal.title, companyId: deal.company_id, userId: user.id },
      "Deal",
      dealId
    );

    return { deal: updated[0], recoveryTask: null, recoveryDate: null };
  }

  if (outcome === "POSTPONED_RECOVERY") {
    const settings = await getRecoverySettings();
    const recoveryDate = addConfiguredInterval(baseDate, settings.interval_value, settings.interval_unit);
    const baseDateStr = formatIsoDateOnly(baseDate);
    const recoveryDateStr = formatIsoDateOnly(recoveryDate);
    const intervalDesc = `${settings.interval_value} ${UNIT_LABELS[settings.interval_unit]}`;

    const updated = await sql`
      UPDATE deals
      SET outcome_status = 'POSTPONED_RECOVERY',
          is_archived = TRUE,
          archived_at = CURRENT_TIMESTAMP,
          recovery_due_at = ${recoveryDate},
          outcome_reason = ${reason || null},
          last_activity_at = ${baseDate},
          next_activity_at = ${recoveryDate},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${dealId}
      RETURNING *;
    `;

    // Las tareas pendientes previas se dejan intactas por definición de negocio.
    const assignedToId = deal.owner_id || user.id;
    const recoveryDesc = [
      `Recuperación automática programada (${intervalDesc} desde gestión del ${baseDateStr}).`,
      reason ? `Motivo / observación: ${reason}` : null,
      "Si el cliente retoma interés, puede reactivar esta oportunidad al pipeline Comercial desde el detalle de la tarea o del negocio.",
    ]
      .filter(Boolean)
      .join("\n");

    const taskRes = await sql`
      INSERT INTO tasks (
        title, description, task_type, status, priority, queue_name,
        assigned_to_id, created_by_id, deal_id, company_id, contact_id, due_at
      )
      VALUES (
        ${`Recuperación cliente: ${deal.title}`},
        ${recoveryDesc},
        'COMMERCIAL_RECOVERY',
        'NOT_STARTED',
        'MEDIUM',
        'Recuperación',
        ${assignedToId},
        ${user.id},
        ${dealId},
        ${deal.company_id || null},
        ${deal.primary_contact_id || null},
        ${recoveryDate}
      )
      RETURNING *;
    `;

    await recordStepHistory(
      "DEAL",
      dealId,
      user.id,
      `Cliente no interesado por el momento (gestión base ${baseDateStr}). Retirado del pipeline y programada tarea de recuperación para ${recoveryDateStr} (+${intervalDesc}).${reason ? ` Motivo: ${reason}` : ""}`
    );

    await recordStepHistory(
      "TASK",
      taskRes[0].id,
      user.id,
      `Tarea de recuperación generada automáticamente para ${recoveryDateStr} (gestión ${baseDateStr} + ${intervalDesc}).`
    );

    await eventBus.publish(
      "crm.deal.postponed_recovery",
      {
        dealId,
        recoveryTaskId: taskRes[0].id,
        managementDate: baseDateStr,
        recoveryDueDate: recoveryDateStr,
        interval: settings,
        companyId: deal.company_id,
      },
      "Deal",
      dealId
    );

    return {
      deal: updated[0],
      recoveryTask: taskRes[0],
      recoveryDate: recoveryDateStr,
      managementDate: baseDateStr,
      interval: settings,
    };
  }

  if (outcome === "LOST_DEFINITIVE") {
    const updated = await sql`
      UPDATE deals
      SET outcome_status = 'LOST_DEFINITIVE',
          is_archived = TRUE,
          archived_at = CURRENT_TIMESTAMP,
          closed_at = CURRENT_TIMESTAMP,
          outcome_reason = ${reason || null},
          last_activity_at = ${baseDate},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${dealId}
      RETURNING *;
    `;

    // Cancelar solo tareas pendientes vinculadas a este negocio específico (no bloquea otros negocios de la empresa)
    const cancelledTasks = await sql`
      UPDATE tasks
      SET status = 'CANCELLED',
          updated_at = CURRENT_TIMESTAMP
      WHERE deal_id = ${dealId}
        AND status IN ('NOT_STARTED', 'IN_PROGRESS')
      RETURNING id;
    `;

    for (const t of cancelledTasks) {
      await recordStepHistory(
        "TASK",
        t.id,
        user.id,
        `Tarea cancelada porque el cliente desistió definitivamente del negocio "${deal.title}".`
      );
    }

    await recordStepHistory(
      "DEAL",
      dealId,
      user.id,
      `Negocio desistido definitivamente y retirado del pipeline (${cancelledTasks.length} tarea(s) pendiente(s) canceladas). La empresa continúa habilitada para otras oportunidades.${reason ? ` Motivo: ${reason}` : ""}`
    );

    await eventBus.publish(
      "crm.deal.lost_definitive",
      { dealId, companyId: deal.company_id, cancelledTaskCount: cancelledTasks.length },
      "Deal",
      dealId
    );

    return { deal: updated[0], recoveryTask: null, cancelledTaskCount: cancelledTasks.length };
  }

  // DO_NOT_CONTACT: activa bandera en empresa/contacto, cancela todas sus tareas pendientes y archiva todos sus negocios activos
  if (deal.company_id) {
    await sql`
      UPDATE companies
      SET do_not_contact = TRUE,
          do_not_contact_at = CURRENT_TIMESTAMP,
          do_not_contact_reason = ${reason || "Cliente solicitó no ser contactado nuevamente"},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${deal.company_id};
    `;
  }
  if (deal.primary_contact_id) {
    await sql`
      UPDATE contacts
      SET do_not_contact = TRUE,
          do_not_contact_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${deal.primary_contact_id};
    `;
  }

  const archivedDeals = deal.company_id
    ? await sql`
        UPDATE deals
        SET outcome_status = 'DO_NOT_CONTACT',
            is_archived = TRUE,
            archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP),
            closed_at = COALESCE(closed_at, CURRENT_TIMESTAMP),
            outcome_reason = COALESCE(outcome_reason, ${reason || "Cliente solicitó no ser contactado nuevamente"}),
            updated_at = CURRENT_TIMESTAMP
        WHERE company_id = ${deal.company_id} AND is_archived = FALSE
        RETURNING id;
      `
    : await sql`
        UPDATE deals
        SET outcome_status = 'DO_NOT_CONTACT',
            is_archived = TRUE,
            archived_at = CURRENT_TIMESTAMP,
            closed_at = CURRENT_TIMESTAMP,
            outcome_reason = ${reason || "Cliente solicitó no ser contactado nuevamente"},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${dealId}
        RETURNING id;
      `;

  const cancelledTasks = deal.company_id
    ? await sql`
        UPDATE tasks
        SET status = 'CANCELLED',
            updated_at = CURRENT_TIMESTAMP
        WHERE status IN ('NOT_STARTED', 'IN_PROGRESS')
          AND (
            company_id = ${deal.company_id}
            OR deal_id = ${dealId}
            OR deal_id IN (SELECT id FROM deals WHERE company_id = ${deal.company_id})
          )
        RETURNING id;
      `
    : await sql`
        UPDATE tasks
        SET status = 'CANCELLED',
            updated_at = CURRENT_TIMESTAMP
        WHERE status IN ('NOT_STARTED', 'IN_PROGRESS')
          AND (deal_id = ${dealId} OR (${deal.primary_contact_id || null}::uuid IS NOT NULL AND contact_id = ${deal.primary_contact_id || null}))
        RETURNING id;
      `;

  for (const d of archivedDeals) {
    await recordStepHistory(
      "DEAL",
      d.id,
      user.id,
      `Cliente marcó "No desea ser contactado nuevamente". Oportunidad retirada definitivamente del pipeline y bandera de bloqueo activada.${reason ? ` Motivo: ${reason}` : ""}`
    );
  }
  if (!archivedDeals.some((d: any) => d.id === dealId)) {
    await recordStepHistory(
      "DEAL",
      dealId,
      user.id,
      `Cliente marcó "No desea ser contactado nuevamente". Bandera de bloqueo activada y tareas canceladas.${reason ? ` Motivo: ${reason}` : ""}`
    );
  }
  for (const t of cancelledTasks) {
    await recordStepHistory(
      "TASK",
      t.id,
      user.id,
      `Tarea cancelada definitivamente por restricción "No contactar nuevamente" del cliente.`
    );
  }

  await eventBus.publish(
    "crm.client.do_not_contact",
    {
      dealId,
      companyId: deal.company_id,
      contactId: deal.primary_contact_id,
      archivedDealCount: archivedDeals.length,
      cancelledTaskCount: cancelledTasks.length,
    },
    "Deal",
    dealId
  );

  const refreshed = await sql`SELECT * FROM deals WHERE id = ${dealId} LIMIT 1;`;
  return {
    deal: refreshed[0],
    recoveryTask: null,
    archivedDealCount: archivedDeals.length,
    cancelledTaskCount: cancelledTasks.length,
  };
}
