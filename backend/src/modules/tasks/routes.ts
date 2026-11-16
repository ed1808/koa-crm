import { NativeRouter, jsonResponse, parseBody } from "../../shared/infrastructure/Router";
import { sql } from "../../database/db";
import { resolveAuthUser } from "../../shared/presentation/authMiddleware";
import { recordStepHistory } from "../../shared/application/WorkflowService";
import { applyDealOutcome, DealOutcomeStatus } from "../../shared/application/RecoveryService";

export function registerTasksRoutes(router: NativeRouter) {
  // 1. Bandeja unificada de Tareas (Solo ADMIN ve todas; los demás solo ven sus tareas asignadas)
  router.get("/api/tasks", async (req) => {
    const user = await resolveAuthUser(req);
    const url = new URL(req.url);
    const filter = url.searchParams.get("filter") || "all";
    const assignedTo = url.searchParams.get("assigned_to");
    const queue = url.searchParams.get("queue");
    const search = url.searchParams.get("search");

    let tasks = await sql`
      SELECT 
        t.*,
        u_ass.full_name as assigned_to_name,
        u_cre.full_name as created_by_name,
        d.title as deal_title, d.amount as deal_amount,
        d.outcome_status as deal_outcome_status, d.is_archived as deal_is_archived,
        d.last_activity_at as deal_last_activity_at, d.recovery_due_at as deal_recovery_due_at,
        tk.ticket_number as source_ticket_number, tk.subject as source_ticket_subject,
        c.name as company_name, c.do_not_contact as company_do_not_contact,
        ct.full_name as contact_name
      FROM tasks t
      LEFT JOIN users u_ass ON t.assigned_to_id = u_ass.id
      LEFT JOIN users u_cre ON t.created_by_id = u_cre.id
      LEFT JOIN deals d ON t.deal_id = d.id
      LEFT JOIN tickets tk ON t.ticket_id = tk.id
      LEFT JOIN companies c ON t.company_id = c.id
      LEFT JOIN contacts ct ON t.contact_id = ct.id
      ORDER BY t.due_at ASC NULLS LAST;
    `;

    // Punto 6: Solo ADMIN puede ver tareas de todos; cualquier otro rol ve únicamente sus tareas asignadas
    if (user.role !== "ADMIN") {
      tasks = tasks.filter((t: any) => t.assigned_to_id === user.id);
    } else if (assignedTo) {
      tasks = tasks.filter((t: any) => t.assigned_to_id === assignedTo);
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    if (queue) {
      tasks = tasks.filter((t: any) => t.queue_name === queue);
    }
    if (search) {
      const q = search.toLowerCase();
      tasks = tasks.filter((t: any) => t.title.toLowerCase().includes(q) || (t.company_name && t.company_name.toLowerCase().includes(q)));
    }

    if (filter === "today") {
      tasks = tasks.filter((t: any) => t.due_at && new Date(t.due_at) >= startOfToday && new Date(t.due_at) <= endOfToday);
    } else if (filter === "overdue") {
      tasks = tasks.filter((t: any) => t.due_at && new Date(t.due_at) < startOfToday && t.status !== "COMPLETED");
    } else if (filter === "upcoming") {
      tasks = tasks.filter((t: any) => t.due_at && new Date(t.due_at) > endOfToday && t.status !== "COMPLETED");
    }

    return jsonResponse({
      data: tasks,
      counts: {
        all: tasks.length,
      },
    });
  });

  // 2. Crear nueva Tarea
  router.post("/api/tasks", async (req) => {
    const user = await resolveAuthUser(req);
    const body = await parseBody(req);
    const {
      title,
      description,
      task_type,
      priority,
      queue_name,
      assigned_to_id,
      created_by_id,
      deal_id,
      ticket_id,
      company_id,
      contact_id,
      due_at,
    } = body;

    if (!title) {
      return jsonResponse({ error: "El título de la tarea es obligatorio" }, 400);
    }

    // Non-ADMIN solo crea tareas asignadas a sí mismo
    const effectiveAssignedToId = user.role === "ADMIN" ? (assigned_to_id || user.id || null) : user.id;
    const effectiveCreatedById = created_by_id || user.id || null;

    const res = await sql`
      INSERT INTO tasks (
        title, description, task_type, priority, queue_name,
        assigned_to_id, created_by_id, deal_id, ticket_id,
        company_id, contact_id, due_at
      )
      VALUES (
        ${title}, ${description || null}, ${task_type || 'COMMERCIAL_FOLLOWUP'}, ${priority || 'MEDIUM'},
        ${queue_name || 'General'}, ${effectiveAssignedToId}, ${effectiveCreatedById},
        ${deal_id || null}, ${ticket_id || null}, ${company_id || null}, ${contact_id || null},
        ${due_at || null}
      )
      RETURNING *;
    `;

    await recordStepHistory(
      "TASK",
      res[0].id,
      user.id,
      `Tarea creada en estado "${res[0].status}" con prioridad ${res[0].priority}.`
    );

    if (deal_id && due_at) {
      await sql`UPDATE deals SET next_activity_at = ${due_at} WHERE id = ${deal_id};`;
    }
    if (ticket_id && due_at) {
      await sql`UPDATE tickets SET next_activity_at = ${due_at} WHERE id = ${ticket_id};`;
    }

    return jsonResponse({ data: res[0] }, 201);
  });

  // 3. Modificar tarea completa
  router.put("/api/tasks/:id", async (req, params) => {
    const user = await resolveAuthUser(req);
    const existing = await sql`SELECT * FROM tasks WHERE id = ${params.id} LIMIT 1;`;
    if (!existing || existing.length === 0) {
      return jsonResponse({ error: "Tarea no encontrada" }, 404);
    }
    if (user.role !== "ADMIN" && existing[0].assigned_to_id !== user.id && existing[0].created_by_id !== user.id) {
      return jsonResponse({ error: "No tiene permisos para modificar esta tarea" }, 403);
    }

    const body = await parseBody(req);
    const {
      title,
      description,
      task_type,
      priority,
      status,
      assigned_to_id,
      due_at,
      deal_outcome,
      outcome_reason,
      management_date,
    } = body;

    const nextAssignedTo = user.role === "ADMIN" ? (assigned_to_id !== undefined ? (assigned_to_id || null) : existing[0].assigned_to_id) : existing[0].assigned_to_id;
    const nextStatus = status || existing[0].status;
    const nextPriority = priority || existing[0].priority;
    const completedAt = nextStatus === "COMPLETED" ? new Date() : null;

    const res = await sql`
      UPDATE tasks
      SET title = COALESCE(${title}, title),
          description = ${description !== undefined ? description : existing[0].description},
          task_type = COALESCE(${task_type}, task_type),
          priority = ${nextPriority},
          status = ${nextStatus},
          assigned_to_id = ${nextAssignedTo},
          due_at = ${due_at !== undefined ? (due_at || null) : existing[0].due_at},
          completed_at = ${completedAt},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${params.id}
      RETURNING *;
    `;

    const changes: string[] = [];
    if (nextStatus !== existing[0].status) changes.push(`Estado: ${existing[0].status} → ${nextStatus}`);
    if (nextPriority !== existing[0].priority) changes.push(`Prioridad: ${existing[0].priority} → ${nextPriority}`);
    if (nextAssignedTo !== existing[0].assigned_to_id) changes.push(`Reasignada`);
    if (changes.length > 0) {
      await recordStepHistory("TASK", params.id, user.id, `Actualización de tarea (${changes.join(" · ")}).`);
    }

    let dealOutcomeResult: any = null;
    if (deal_outcome && existing[0].deal_id) {
      const normalizedOutcome = String(deal_outcome).toUpperCase() as DealOutcomeStatus;
      if (["ACTIVE", "POSTPONED_RECOVERY", "LOST_DEFINITIVE", "DO_NOT_CONTACT"].includes(normalizedOutcome)) {
        try {
          dealOutcomeResult = await applyDealOutcome({
            dealId: existing[0].deal_id,
            outcome: normalizedOutcome,
            user,
            reason: outcome_reason,
            managementDate: management_date || null,
            sourceTaskId: params.id,
          });
        } catch (err: any) {
          return jsonResponse({ error: err.message }, 400);
        }
      }
    }

    const latestTask = await sql`SELECT * FROM tasks WHERE id = ${params.id} LIMIT 1;`;
    return jsonResponse({ data: latestTask[0] || res[0], dealOutcomeResult });
  });

  // 4. Cambiar estado de una tarea (Completar / Reabrir)
  router.patch("/api/tasks/:id/status", async (req, params) => {
    const user = await resolveAuthUser(req);
    const existing = await sql`SELECT * FROM tasks WHERE id = ${params.id} LIMIT 1;`;
    if (!existing || existing.length === 0) {
      return jsonResponse({ error: "Tarea no encontrada" }, 404);
    }
    if (user.role !== "ADMIN" && existing[0].assigned_to_id !== user.id && existing[0].created_by_id !== user.id) {
      return jsonResponse({ error: "No tiene permisos para actualizar esta tarea" }, 403);
    }

    const body = await parseBody(req);
    const { status } = body;

    const completedAt = status === "COMPLETED" ? new Date() : null;

    const res = await sql`
      UPDATE tasks
      SET status = ${status},
          completed_at = ${completedAt},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${params.id}
      RETURNING *;
    `;

    if (status !== existing[0].status) {
      await recordStepHistory(
        "TASK",
        params.id,
        user.id,
        `Estado de tarea cambiado de "${existing[0].status}" a "${status}".`
      );
    }

    return jsonResponse({ data: res[0] });
  });

  // 4b. Histórico de pasos de una tarea
  router.get("/api/tasks/:id/history", async (req, params) => {
    const user = await resolveAuthUser(req);
    const existing = await sql`SELECT assigned_to_id, created_by_id FROM tasks WHERE id = ${params.id} LIMIT 1;`;
    if (!existing || existing.length === 0) {
      return jsonResponse({ error: "Tarea no encontrada" }, 404);
    }
    if (user.role !== "ADMIN" && existing[0].assigned_to_id !== user.id && existing[0].created_by_id !== user.id) {
      return jsonResponse({ error: "No tiene permisos para ver el historial de esta tarea" }, 403);
    }

    const history = await sql`
      SELECT i.*, u.full_name as author_name, u.role as author_role
      FROM interactions_comments i
      LEFT JOIN users u ON i.author_id = u.id
      WHERE i.target_type = 'TASK' AND i.target_id = ${params.id}
      ORDER BY i.created_at DESC;
    `;

    return jsonResponse({ data: history });
  });

  // 5. Eliminar tarea
  router.delete("/api/tasks/:id", async (req, params) => {
    const user = await resolveAuthUser(req);
    const existing = await sql`SELECT assigned_to_id, created_by_id FROM tasks WHERE id = ${params.id} LIMIT 1;`;
    if (!existing || existing.length === 0) {
      return jsonResponse({ error: "Tarea no encontrada" }, 404);
    }
    if (user.role !== "ADMIN" && existing[0].assigned_to_id !== user.id && existing[0].created_by_id !== user.id) {
      return jsonResponse({ error: "No tiene permisos para eliminar esta tarea" }, 403);
    }

    await sql`DELETE FROM tasks WHERE id = ${params.id};`;
    return jsonResponse({ success: true });
  });
}
