import React, { useState } from "react";
import { X, Check, History } from "lucide-react";
import { apiFetch } from "../services/api";
import { useUser } from "../context/UserContext";

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskToEdit?: any | null;
  onSaved: () => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  taskToEdit,
  onSaved,
}) => {
  const { currentUser } = useUser();
  const isAdmin = currentUser.role === "ADMIN";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [taskType, setTaskType] = useState("COMMERCIAL_FOLLOWUP");
  const [priority, setPriority] = useState("MEDIUM");
  const [status, setStatus] = useState("NOT_STARTED");
  const [assignedToId, setAssignedToId] = useState("");
  const [dueAt, setDueAt] = useState("");

  const [users, setUsers] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const [dealOutcome, setDealOutcome] = useState("");
  const [outcomeReason, setOutcomeReason] = useState("");
  const [managementDate, setManagementDate] = useState("");

  React.useEffect(() => {
    if (isOpen) {
      if (isAdmin) {
        apiFetch<{ data: any[] }>("/api/users").then((res) => setUsers(res.data || []));
      }

      if (taskToEdit) {
        setTitle(taskToEdit.title || "");
        setDescription(taskToEdit.description || "");
        setTaskType(taskToEdit.task_type || "COMMERCIAL_FOLLOWUP");
        setPriority(taskToEdit.priority || "MEDIUM");
        setStatus(taskToEdit.status || "NOT_STARTED");
        setAssignedToId(taskToEdit.assigned_to_id || currentUser.id);
        setDueAt(taskToEdit.due_at ? taskToEdit.due_at.substring(0, 10) : "");
        setDealOutcome(taskToEdit.deal_outcome_status || "ACTIVE");
        setOutcomeReason("");
        const baseDt = taskToEdit.deal_last_activity_at || taskToEdit.created_at || new Date().toISOString();
        setManagementDate(new Date(baseDt).toISOString().slice(0, 10));
        apiFetch<{ data: any[] }>(`/api/tasks/${taskToEdit.id}/history`)
          .then((res) => setHistory(res.data || []))
          .catch(() => setHistory([]));
      } else {
        setTitle("");
        setDescription("");
        setTaskType("COMMERCIAL_FOLLOWUP");
        setPriority("MEDIUM");
        setStatus("NOT_STARTED");
        setAssignedToId(currentUser.id);
        setDueAt("");
        setDealOutcome("");
        setOutcomeReason("");
        setManagementDate(new Date().toISOString().slice(0, 10));
        setHistory([]);
      }
    }
  }, [isOpen, taskToEdit, isAdmin, currentUser.id]);

  if (!isOpen) return null;

  const hasLinkedDeal = Boolean(taskToEdit?.deal_id);
  const dealOutcomeChanged = Boolean(hasLinkedDeal && dealOutcome && dealOutcome !== (taskToEdit?.deal_outcome_status || "ACTIVE"));

  const handleReactivateDeal = async () => {
    if (!taskToEdit?.deal_id) return;
    setSaving(true);
    try {
      await apiFetch(`/api/deals/${taskToEdit.deal_id}/reactivate`, {
        method: "POST",
        body: JSON.stringify({
          source_task_id: taskToEdit.id,
          reason: outcomeReason.trim() || "Oportunidad reactivada desde tarea de recuperación",
        }),
      });
      onSaved();
      onClose();
    } catch (err: any) {
      alert("Error al reactivar oportunidad: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (dealOutcomeChanged) {
      const warn =
        dealOutcome === "DO_NOT_CONTACT"
          ? "Esto bloqueará la empresa/contacto como No Contactar, cancelará todas sus tareas pendientes y retirará sus negocios de los pipelines. ¿Continuar?"
          : dealOutcome === "LOST_DEFINITIVE"
          ? "Esto cancelará las tareas pendientes de este negocio y lo retirará del pipeline. ¿Continuar?"
          : "Esto retirará la oportunidad del pipeline y programará automáticamente la tarea de recuperación. ¿Continuar?";
      if (!confirm(warn)) return;
    }

    setSaving(true);
    try {
      if (taskToEdit) {
        const res = await apiFetch<{ data: any; dealOutcomeResult?: any }>(`/api/tasks/${taskToEdit.id}`, {
          method: "PUT",
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || null,
            task_type: taskType,
            priority,
            status,
            assigned_to_id: isAdmin ? assignedToId || null : currentUser.id,
            due_at: dueAt ? new Date(dueAt).toISOString() : null,
            ...(dealOutcomeChanged
              ? {
                  deal_outcome: dealOutcome,
                  outcome_reason: outcomeReason.trim() || undefined,
                  management_date: managementDate || undefined,
                }
              : {}),
          }),
        });
        if (res.dealOutcomeResult?.recoveryDate) {
          alert(`Tarea de recuperación creada automáticamente para el ${res.dealOutcomeResult.recoveryDate}.`);
        }
      } else {
        await apiFetch("/api/tasks", {
          method: "POST",
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || null,
            task_type: taskType,
            priority,
            assigned_to_id: isAdmin ? assignedToId || currentUser.id : currentUser.id,
            due_at: dueAt ? new Date(dueAt).toISOString() : null,
          }),
        });
      }

      onSaved();
      onClose();
    } catch (err: any) {
      alert("Error al guardar tarea: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-2xl border border-slate-200 dark:border-neutral-800 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-neutral-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {taskToEdit ? "Modificar Tarea de Seguimiento" : "Agregar Nueva Tarea"}
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Título de la Tarea *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Seguimiento llamada cotización 4463"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Detalles / Instrucciones (Opcional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Anota detalles o acuerdos previos..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Tipo de Tarea
              </label>
              <select
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
              >
                <option value="COMMERCIAL_FOLLOWUP">Seguimiento Comercial</option>
                <option value="COMMERCIAL_RECOVERY">Recuperación de Cliente</option>
                <option value="CALL">Llamada</option>
                <option value="EMAIL">Correo Electrónico</option>
                <option value="MEETING">Reunión / Demo</option>
                <option value="INTERNAL_ACTION">Acción Interna</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Prioridad
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
              >
                <option value="LOW">Baja</option>
                <option value="MEDIUM">Media</option>
                <option value="HIGH">Alta</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Asignado a
              </label>
              {isAdmin ? (
                <select
                  value={assignedToId}
                  onChange={(e) => setAssignedToId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#151515] border border-slate-200 dark:border-neutral-700 rounded-lg text-xs"
                >
                  <option value="">Seleccionar responsable...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.role})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  disabled
                  value={currentUser.full_name}
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-[#222222] border border-slate-200 dark:border-neutral-700 rounded-lg text-xs opacity-80"
                />
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Fecha de Vencimiento
              </label>
              <input
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#151515] border border-slate-200 dark:border-neutral-700 rounded-lg text-xs"
              />
            </div>
          </div>

          {taskToEdit && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Estado Actual
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#151515] border border-slate-200 dark:border-neutral-700 rounded-lg text-xs font-semibold"
              >
                <option value="NOT_STARTED">Sin iniciar</option>
                <option value="IN_PROGRESS">En curso</option>
                <option value="COMPLETED">Completada</option>
                <option value="CANCELLED">Cancelada</option>
              </select>
            </div>
          )}

          {hasLinkedDeal && (
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#151515] border border-slate-200 dark:border-neutral-700 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
                    Resultado en Flujo Comercial ({taskToEdit.deal_title})
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Define si el negocio continúa, se programa recuperación o el cliente desiste.
                  </span>
                </div>
                {taskToEdit.deal_is_archived && !taskToEdit.company_do_not_contact && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleReactivateDeal}
                    className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold flex-shrink-0"
                  >
                    Reactivar negocio
                  </button>
                )}
              </div>

              <select
                value={dealOutcome}
                onChange={(e) => setDealOutcome(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-[#1c1c1c] border border-slate-200 dark:border-neutral-700 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-100"
              >
                <option value="ACTIVE">En gestión / Activo en pipeline</option>
                <option value="POSTPONED_RECOVERY">No interesado por el momento (retirar y programar recuperación)</option>
                <option value="LOST_DEFINITIVE">Desiste definitivamente (solo este negocio)</option>
                <option value="DO_NOT_CONTACT">No desea ser contactado nuevamente (bloquear y cancelar tareas)</option>
              </select>

              {dealOutcomeChanged && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      Fecha de última gestión (base)
                    </label>
                    <input
                      type="date"
                      value={managementDate}
                      onChange={(e) => setManagementDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-[#1c1c1c] border border-slate-200 dark:border-neutral-700 rounded text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      Motivo / Observación
                    </label>
                    <input
                      type="text"
                      value={outcomeReason}
                      onChange={(e) => setOutcomeReason(e.target.value)}
                      placeholder="Ej: Revisar presupuesto próximo mes"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-[#1c1c1c] border border-slate-200 dark:border-neutral-700 rounded text-xs"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {taskToEdit && history.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-neutral-800">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                <History className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>Histórico de pasos y cambios</span>
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                {history.map((h) => (
                  <div
                    key={h.id}
                    className="p-2 rounded-lg bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/40 text-[11px]"
                  >
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-0.5">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {h.author_name || "Sistema"}
                      </span>
                      <span>{new Date(h.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-200">{h.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-md"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-brand-900 hover:bg-brand-800 text-white rounded-md text-xs font-semibold shadow-sm disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{saving ? "Guardando..." : "Guardar Tarea"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
