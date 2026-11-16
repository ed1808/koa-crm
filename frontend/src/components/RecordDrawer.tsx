import React, { useState, useEffect } from "react";
import { 
  X, 
  Sparkles, 
  Building2, 
  User, 
  Calendar, 
  Clock, 
  DollarSign, 
  CheckSquare, 
  Send, 
  MessageSquare, 
  AlertCircle,
  FileCheck,
  GitBranch,
  ArrowRightCircle,
  CheckCircle2,
  History
} from "lucide-react";
import { apiFetch } from "../services/api";
import { useUser } from "../context/UserContext";

interface RecordDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  recordType: "DEAL" | "TICKET";
  recordId: string | null;
  onOpenCopilotWithContext: (id: string, type: "DEAL" | "TICKET") => void;
  onRecordUpdated: () => void;
}

export const RecordDrawer: React.FC<RecordDrawerProps> = ({
  isOpen,
  onClose,
  recordType,
  recordId,
  onOpenCopilotWithContext,
  onRecordUpdated,
}) => {
  const { currentUser } = useUser();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [activeTab, setActiveTab] = useState<"timeline" | "tasks">("timeline");

  const [nextStageId, setNextStageId] = useState("");
  const [allPipelines, setAllPipelines] = useState<any[]>([]);
  const [nextPipelineId, setNextPipelineId] = useState("");
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [handoffSuccess, setHandoffSuccess] = useState<string | null>(null);
  const [supportAgents, setSupportAgents] = useState<any[]>([]);

  const [dealOutcome, setDealOutcome] = useState<string>("ACTIVE");
  const [outcomeReason, setOutcomeReason] = useState("");
  const [managementDate, setManagementDate] = useState("");
  const [outcomeNotice, setOutcomeNotice] = useState<string | null>(null);

  const reloadRecord = async () => {
    if (!recordId) return;
    const endpoint = recordType === "DEAL" ? `/api/deals/${recordId}` : `/api/tickets/${recordId}`;
    const res = await apiFetch<{ data: any }>(endpoint);
    setData(res.data);
    onRecordUpdated();
  };

  useEffect(() => {
    if (!isOpen || !recordId) {
      setData(null);
      setNextStageId("");
      setNextPipelineId("");
      setShowFinalizeConfirm(false);
      setHandoffSuccess(null);
      setOutcomeNotice(null);
      return;
    }

    setLoading(true);
    setNextStageId("");
    setNextPipelineId("");
    setShowFinalizeConfirm(false);
    setHandoffSuccess(null);
    setOutcomeNotice(null);
    setOutcomeReason("");

    const endpoint = recordType === "DEAL" ? `/api/deals/${recordId}` : `/api/tickets/${recordId}`;
    const requests: Promise<any>[] = [apiFetch<{ data: any }>(endpoint)];

    if (currentUser.role !== "CLIENTE") {
      requests.push(apiFetch<{ data: any[] }>("/api/pipelines?module=ALL").catch(() => ({ data: [] })));
    }
    if (recordType === "TICKET" && (currentUser.role === "ADMIN" || currentUser.role === "SOPORTE")) {
      requests.push(apiFetch<{ data: any[] }>("/api/users").catch(() => ({ data: [] })));
    }

    Promise.all(requests)
      .then(([recordRes, pipelinesRes, usersRes]) => {
        setData(recordRes.data);
        if (recordRes.data?.deal) {
          setDealOutcome(recordRes.data.deal.outcome_status || "ACTIVE");
          const baseDt = recordRes.data.deal.last_activity_at || recordRes.data.deal.created_at || new Date().toISOString();
          setManagementDate(new Date(baseDt).toISOString().slice(0, 10));
        }
        if (pipelinesRes?.data) setAllPipelines(pipelinesRes.data);
        if (usersRes?.data) {
          setSupportAgents(usersRes.data.filter((u: any) => u.role === "SOPORTE" || u.role === "ADMIN"));
        }
      })
      .catch((err) => console.error("Error fetching record details:", err))
      .finally(() => setLoading(false));
  }, [isOpen, recordId, recordType, currentUser.role]);

  if (!isOpen || !recordId) return null;

  const record = recordType === "DEAL" ? data?.deal : data?.ticket;
  const stages: any[] = data?.stages || [];
  const timeline = recordType === "DEAL" ? data?.timeline : data?.comments;
  const tasks = data?.tasks || [];

  const isFinalStage = Boolean(
    record &&
      record.max_stage_position !== undefined &&
      Number(record.stage_position) >= Number(record.max_stage_position) &&
      Number(record.max_stage_position) > 0
  );
  const isFinalized = Boolean(record?.is_finalized);
  const canTriageTicket = recordType === "TICKET" && (currentUser.role === "ADMIN" || currentUser.role === "SOPORTE");
  const targetPipelineObj = allPipelines.find((p) => p.id === nextPipelineId);

  const handleTicketTriage = async (field: "priority" | "assigned_agent_id", value: string) => {
    if (!canTriageTicket || !recordId) return;
    try {
      await apiFetch(`/api/tickets/${recordId}`, {
        method: "PATCH",
        body: JSON.stringify({ [field]: value || null }),
      });
      await reloadRecord();
    } catch (err: any) {
      alert("Error al actualizar ticket: " + err.message);
    }
  };

  const handleApplyDealOutcome = async () => {
    if (recordType !== "DEAL" || !recordId) return;
    if (dealOutcome === (record?.outcome_status || "ACTIVE")) return;

    const confirmText =
      dealOutcome === "DO_NOT_CONTACT"
        ? "¿Confirmas que el cliente solicitó NO ser contactado nuevamente? Se bloqueará la empresa/contacto, se cancelarán sus tareas pendientes y se retirarán sus negocios de los pipelines."
        : dealOutcome === "LOST_DEFINITIVE"
        ? "¿Confirmas que el cliente desiste definitivamente de este negocio? Se retirará del pipeline y se cancelarán sus tareas pendientes (otros negocios no se verán afectados)."
        : "¿Confirmas que el cliente no está interesado por el momento? Se retirará del pipeline y se creará la tarea de recuperación automática con base en la fecha de última gestión.";

    if (!confirm(confirmText)) return;

    setSubmitting(true);
    try {
      const res = await apiFetch<{ data: any }>(`/api/deals/${recordId}/outcome`, {
        method: "POST",
        body: JSON.stringify({
          outcome: dealOutcome,
          reason: outcomeReason.trim() || undefined,
          management_date: managementDate || undefined,
        }),
      });
      if (res.data?.recoveryDate) {
        setOutcomeNotice(
          `Oportunidad retirada del pipeline y tarea de recuperación creada automáticamente para el ${res.data.recoveryDate}.`
        );
      } else if (dealOutcome === "LOST_DEFINITIVE") {
        setOutcomeNotice("Negocio desistido definitivamente, retirado del pipeline y tareas vinculadas canceladas.");
      } else if (dealOutcome === "DO_NOT_CONTACT") {
        setOutcomeNotice("Empresa/contacto marcados como No Contactar, tareas canceladas y negocios retirados de los pipelines.");
      }
      setOutcomeReason("");
      await reloadRecord();
    } catch (err: any) {
      alert("Error al aplicar resultado comercial: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReactivateDeal = async () => {
    if (recordType !== "DEAL" || !recordId) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/deals/${recordId}/reactivate`, {
        method: "POST",
        body: JSON.stringify({ reason: "Oportunidad reactivada manualmente al pipeline Comercial." }),
      });
      setOutcomeNotice("Oportunidad reactivada al tablero Comercial.");
      await reloadRecord();
    } catch (err: any) {
      alert("Error al reactivar oportunidad: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const executeFinalize = async () => {
    if (!recordId) return;
    setSubmitting(true);
    try {
      const endpoint = recordType === "DEAL" ? `/api/deals/${recordId}/finalize` : `/api/tickets/${recordId}/finalize`;
      const res = await apiFetch<{ data: any }>(endpoint, {
        method: "POST",
        body: JSON.stringify({
          body: newComment.trim(),
          next_pipeline_id: nextPipelineId || null,
        }),
      });
      setShowFinalizeConfirm(false);
      setNewComment("");
      setNextPipelineId("");
      if (res.data?.handoff) {
        setHandoffSuccess(
          `Finalizado y generado "${res.data.handoff.label}" en el flujo "${res.data.handoff.pipelineName}" con su tarea vinculada.`
        );
      } else {
        setHandoffSuccess("Registro finalizado correctamente.");
      }
      await reloadRecord();
    } catch (err: any) {
      alert("Error al finalizar: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isFinalStage && !isFinalized && currentUser.role !== "CLIENTE") {
      if (nextPipelineId) {
        setShowFinalizeConfirm(true);
        return;
      }
      await executeFinalize();
      return;
    }

    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      if (recordType === "DEAL") {
        await apiFetch(`/api/deals/${recordId}/interactions`, {
          method: "POST",
          body: JSON.stringify({
            author_id: currentUser.id,
            interaction_type: "COMMENT",
            body: newComment,
            next_stage_id: nextStageId || undefined,
          }),
        });
      } else {
        await apiFetch(`/api/tickets/${recordId}/comments`, {
          method: "POST",
          body: JSON.stringify({
            author_id: currentUser.id,
            is_internal: isInternalNote,
            body: newComment,
            next_stage_id: nextStageId || undefined,
          }),
        });
      }

      setNewComment("");
      setNextStageId("");
      await reloadRecord();
    } catch (err: any) {
      alert("Error al agregar comentario: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-2xl bg-white dark:bg-[#151515] border-l border-slate-200 dark:border-neutral-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      
      {/* Header */}
      <div className="p-5 border-b border-slate-200 dark:border-neutral-800 flex items-start justify-between bg-slate-50/60 dark:bg-[#1b1b1b]">
        <div className="space-y-1">
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-brand-100 dark:bg-neutral-800 text-brand-900 dark:text-slate-200 border border-brand-200 dark:border-neutral-700">
              {recordType === "DEAL" ? "Comercial" : `Soporte #${record?.ticket_number || ""}`}
            </span>
            {isFinalized && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Finalizado
              </span>
            )}
            {record?.stage_name && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {record.stage_name}
              </span>
            )}
            {record?.priority && (
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                Prioridad: {record.priority}
              </span>
            )}
          </div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
            {recordType === "DEAL" ? record?.title : record?.subject}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {/* AI Copilot Shortcut Button (✨) */}
          <button
            onClick={() => onOpenCopilotWithContext(recordId, recordType)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/80 hover:bg-teal-100 text-teal-800 dark:text-teal-200 border border-teal-200 dark:border-teal-800 text-xs font-semibold shadow-2xs transition-all active:scale-95"
            title="Abrir Copiloto IA con contexto de este registro"
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
            <span>Copiloto IA</span>
          </button>
          
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
          Cargando detalle 360°...
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          
          {/* Key Properties Grid */}
          <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 block">Empresa</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {record?.company_name || "Sin empresa"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-[10px] text-slate-400 block">
                  {recordType === "DEAL" ? "Propietario Comercial" : "Agente Asignado"}
                </span>
                {canTriageTicket ? (
                  <select
                    value={record?.assigned_agent_id || ""}
                    onChange={(e) => handleTicketTriage("assigned_agent_id", e.target.value)}
                    className="mt-0.5 w-full px-2 py-1 bg-white dark:bg-[#1f1f1f] border border-slate-200 dark:border-neutral-700 rounded text-xs font-medium text-slate-800 dark:text-slate-100"
                  >
                    <option value="">Sin asignar</option>
                    {supportAgents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.full_name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {recordType === "DEAL" ? record?.owner_name || "No asignado" : record?.assigned_agent_name || "Sin asignar"}
                  </span>
                )}
              </div>
            </div>

            {recordType === "DEAL" ? (
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 block">Valor Oportunidad</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-300">
                    COP {Number(record?.amount || 0).toLocaleString("es-CO")}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] text-slate-400 block">Prioridad & SLA</span>
                  {canTriageTicket ? (
                    <select
                      value={record?.priority || "MEDIUM"}
                      onChange={(e) => handleTicketTriage("priority", e.target.value)}
                      className="mt-0.5 w-full px-2 py-1 bg-white dark:bg-[#1f1f1f] border border-slate-200 dark:border-neutral-700 rounded text-xs font-medium text-slate-800 dark:text-slate-100"
                    >
                      <option value="LOW">Baja</option>
                      <option value="MEDIUM">Media</option>
                      <option value="HIGH">Alta</option>
                      <option value="URGENT">Urgente</option>
                    </select>
                  ) : (
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {record?.priority || "MEDIUM"} · {record?.sla_due_at ? new Date(record.sla_due_at).toLocaleDateString() : "Sin SLA"}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 block">Fecha Creación</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {record?.created_at ? new Date(record.created_at).toLocaleDateString() : "N/A"}
                </span>
              </div>
            </div>
          </div>

          {handoffSuccess && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center gap-2 text-xs text-emerald-900 dark:text-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span>{handoffSuccess}</span>
            </div>
          )}

          {isFinalized && record?.handoff_target_type && (
            <div className="p-3 bg-slate-100 dark:bg-[#1f1f1f] rounded-lg border border-slate-200 dark:border-neutral-700 flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
              <GitBranch className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span>
                Flujo finalizado{record.finalized_at ? ` el ${new Date(record.finalized_at).toLocaleString()}` : ""}. Continuado hacia{" "}
                <strong>{record.handoff_target_type === "TICKET" ? "Soporte" : "Comercial"}</strong>.
              </span>
            </div>
          )}

          {/* Special Origin Banners */}
          {recordType === "DEAL" && record?.source_ticket_number && (
            <div className="p-3 bg-teal-50 dark:bg-neutral-800/80 rounded-lg border border-teal-200 dark:border-neutral-700 flex items-center gap-2 text-xs text-teal-800 dark:text-slate-200">
              <FileCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span>
                Esta oportunidad comercial fue originada desde el <strong>Ticket #{record.source_ticket_number}</strong>.
              </span>
            </div>
          )}
          {recordType === "TICKET" && record?.source_deal_title && (
            <div className="p-3 bg-teal-50 dark:bg-neutral-800/80 rounded-lg border border-teal-200 dark:border-neutral-700 flex items-center gap-2 text-xs text-teal-800 dark:text-slate-200">
              <FileCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span>
                Generado por continuidad desde Comercial: <strong>{record.source_deal_title}</strong>.
              </span>
            </div>
          )}

          {/* Commercial Outcome & Recovery Controls */}
          {recordType === "DEAL" && currentUser.role !== "CLIENTE" && (
            <div className="p-3.5 bg-slate-50 dark:bg-[#1b1b1b] rounded-xl border border-slate-200 dark:border-neutral-800 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                    Resultado / Estado Comercial con el Cliente
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Última gestión base:{" "}
                    <strong>
                      {record?.last_activity_at
                        ? new Date(record.last_activity_at).toISOString().slice(0, 10)
                        : "Hoy"}
                    </strong>
                    {record?.recovery_due_at
                      ? ` · Recuperación programada: ${new Date(record.recovery_due_at).toISOString().slice(0, 10)}`
                      : ""}
                  </span>
                </div>
                {record?.is_archived && record?.outcome_status === "POSTPONED_RECOVERY" && !record?.company_do_not_contact && (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleReactivateDeal}
                    className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold"
                  >
                    Reactivar en pipeline
                  </button>
                )}
              </div>

              {record?.company_do_not_contact && (
                <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-[11px] font-semibold text-rose-800 dark:text-rose-200">
                  Restricción activa: esta empresa solicitó NO volver a ser contactada.
                </div>
              )}

              {outcomeNotice && (
                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-900 dark:text-emerald-200">
                  {outcomeNotice}
                </div>
              )}

              {!record?.is_archived && (
                <div className="space-y-2">
                  <select
                    value={dealOutcome}
                    onChange={(e) => setDealOutcome(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#151515] border border-slate-200 dark:border-neutral-700 rounded-lg text-slate-800 dark:text-slate-100 font-medium"
                  >
                    <option value="ACTIVE">En gestión / Activo en pipeline</option>
                    <option value="POSTPONED_RECOVERY">No interesado por el momento (retirar y programar recuperación)</option>
                    <option value="LOST_DEFINITIVE">Desiste definitivamente (solo este negocio)</option>
                    <option value="DO_NOT_CONTACT">No desea ser contactado nuevamente (bloquear y cancelar tareas)</option>
                  </select>

                  {dealOutcome !== (record?.outcome_status || "ACTIVE") && dealOutcome !== "ACTIVE" && (
                    <div className="space-y-2 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                            Fecha de última gestión
                          </label>
                          <input
                            type="date"
                            value={managementDate}
                            onChange={(e) => setManagementDate(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#151515] border border-slate-200 dark:border-neutral-700 rounded-lg"
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
                            placeholder="Ej: Retomar en cierre fiscal"
                            className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#151515] border border-slate-200 dark:border-neutral-700 rounded-lg"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={handleApplyDealOutcome}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-xs font-semibold shadow-sm disabled:opacity-50"
                        >
                          {submitting ? "Aplicando..." : "Aplicar resultado y retirar del pipeline"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Description for Ticket */}
          {recordType === "TICKET" && (
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Descripción del Requerimiento
              </span>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg text-xs text-slate-700 dark:text-slate-300 leading-relaxed border border-slate-200 dark:border-slate-800 whitespace-pre-wrap">
                {record?.description || "Sin descripción"}
              </div>
            </div>
          )}

          {/* Tabs for Timeline / Linked Tasks */}
          <div>
            <div className="flex items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-2">
              <button
                onClick={() => setActiveTab("timeline")}
                className={`text-xs font-medium transition-colors ${
                  activeTab === "timeline"
                    ? "text-brand-900 dark:text-slate-100 border-b-2 border-brand-900 dark:border-emerald-400 pb-2 font-bold -mb-2.5"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                Línea de Tiempo & Comentarios ({timeline?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab("tasks")}
                className={`text-xs font-medium transition-colors ${
                  activeTab === "tasks"
                    ? "text-brand-900 dark:text-slate-100 border-b-2 border-brand-900 dark:border-emerald-400 pb-2 font-bold -mb-2.5"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                Tareas Vinculadas ({tasks?.length || 0})
              </button>
            </div>

            {/* Tab: Timeline */}
            {activeTab === "timeline" && (
              <div className="mt-4 space-y-4">
                {/* Comment Box + Siguiente paso / Siguiente flujo */}
                <form onSubmit={handleAddComment} className="space-y-2.5 p-3 rounded-xl bg-slate-50/70 dark:bg-[#1b1b1b] border border-slate-200 dark:border-neutral-800">
                  <textarea
                    rows={3}
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder={
                      isFinalStage && !isFinalized
                        ? "Agrega una observación final antes de cerrar o transferir al siguiente flujo..."
                        : "Escribe una actualización, observación o nota de seguimiento..."
                    }
                    className="w-full p-2.5 text-xs bg-white dark:bg-[#151515] border border-slate-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 text-slate-900 dark:text-slate-100"
                  />

                  {/* Selector de Siguiente Paso (etapas intermedias) */}
                  {!isFinalStage && !isFinalized && currentUser.role !== "CLIENTE" && stages.length > 0 && (
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                        <ArrowRightCircle className="w-3.5 h-3.5 text-brand-600 dark:text-emerald-400" />
                        Siguiente paso (opcional)
                      </label>
                      <select
                        value={nextStageId}
                        onChange={(e) => setNextStageId(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#151515] border border-slate-200 dark:border-neutral-700 rounded-lg text-slate-800 dark:text-slate-100"
                      >
                        <option value="">Mantener etapa actual ({record?.stage_name || "Actual"})</option>
                        {stages
                          .filter((s: any) => s.id !== record?.stage_id)
                          .map((s: any) => (
                            <option key={s.id} value={s.id}>
                              Avanzar a: {s.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  {/* Selector de Siguiente Flujo (última etapa del pipeline) */}
                  {isFinalStage && !isFinalized && currentUser.role !== "CLIENTE" && (
                    <div className="space-y-1 p-2.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50">
                      <label className="text-[11px] font-semibold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                        <GitBranch className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        Última etapa alcanzada — Siguiente flujo (opcional)
                      </label>
                      <select
                        value={nextPipelineId}
                        onChange={(e) => setNextPipelineId(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#151515] border border-emerald-300 dark:border-emerald-800 rounded-lg text-slate-800 dark:text-slate-100"
                      >
                        <option value="">Solo finalizar sin generar nuevo flujo</option>
                        {allPipelines
                          .filter((p) => p.id !== record?.pipeline_id)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              [{p.module_type === "TICKETS" ? "Soporte" : "Comercial"}] {p.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    {recordType === "TICKET" && currentUser.role !== "CLIENTE" && (
                      <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isInternalNote}
                          onChange={(e) => setIsInternalNote(e.target.checked)}
                          className="rounded text-brand-900 focus:ring-brand-500"
                        />
                        <span>Nota interna (oculta para clientes)</span>
                      </label>
                    )}

                    {isFinalStage && !isFinalized && currentUser.role !== "CLIENTE" ? (
                      <button
                        type="submit"
                        disabled={submitting}
                        className="ml-auto flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold transition-colors disabled:opacity-40 shadow-sm"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{submitting ? "Finalizando..." : "Finalizar"}</span>
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={submitting || !newComment.trim()}
                        className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-brand-900 hover:bg-brand-800 text-white rounded-md text-xs font-medium transition-colors disabled:opacity-40"
                      >
                        <Send className="w-3 h-3" />
                        <span>{nextStageId ? "Guardar y avanzar paso" : "Guardar observación"}</span>
                      </button>
                    )}
                  </div>
                </form>

                {/* Timeline Items */}
                <div className="space-y-3 pt-2">
                  {timeline?.map((item: any) => {
                    const isStageHistory = item.interaction_type === "STAGE_HISTORY";
                    const isFlowHandoff = item.interaction_type === "FLOW_HANDOFF";
                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-lg text-xs space-y-1.5 border ${
                          isFlowHandoff
                            ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50"
                            : isStageHistory
                            ? "bg-sky-50/70 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800/50"
                            : item.is_internal
                            ? "bg-amber-50/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/40"
                            : item.interaction_type === "AI_SUMMARY"
                            ? "bg-teal-50/60 dark:bg-teal-950/30 border-teal-200 dark:border-teal-900/40"
                            : "bg-slate-50 dark:bg-[#1b1b1b] border-slate-200 dark:border-neutral-800"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800 dark:text-slate-100">
                              {item.author_name || "Sistema / Copiloto"}
                            </span>
                            {isStageHistory && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-100 dark:bg-sky-900/50 text-sky-800 dark:text-sky-200">
                                <History className="w-2.5 h-2.5" />
                                Paso
                              </span>
                            )}
                            {isFlowHandoff && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200">
                                <GitBranch className="w-2.5 h-2.5" />
                                Siguiente Flujo
                              </span>
                            )}
                          </div>
                          <span>{new Date(item.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{item.body}</p>
                      </div>
                    );
                  })}
                  {(!timeline || timeline.length === 0) && (
                    <div className="text-center py-6 text-xs text-slate-400">
                      No hay interacciones registradas aún.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab: Linked Tasks */}
            {activeTab === "tasks" && (
              <div className="mt-4 space-y-2">
                {tasks.map((t: any) => (
                  <div
                    key={t.id}
                    className="p-3 bg-slate-50 dark:bg-[#1b1b1b] rounded-lg border border-slate-200 dark:border-neutral-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-medium text-slate-900 dark:text-white block">{t.title}</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        Asignado a: {t.assigned_to_name || "N/A"} · Vence: {t.due_at ? new Date(t.due_at).toLocaleDateString() : "Sin fecha"}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                        t.status === "COMPLETED"
                          ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200"
                          : "bg-slate-200 dark:bg-neutral-800 text-slate-700 dark:text-slate-200"
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                ))}
                {tasks.length === 0 && (
                  <div className="text-center py-6 text-xs text-slate-400">
                    No hay tareas vinculadas. Usa el Copiloto IA para generar una tarea comercial.
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      )}

      {/* Confirmation Alert Modal for Next Flow */}
      {showFinalizeConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#1d1d1d] rounded-xl border border-slate-200 dark:border-neutral-700 shadow-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                <GitBranch className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Confirmar creación en siguiente flujo
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  ¿Realmente desea finalizar este registro y generar automáticamente la nueva tarjeta y tarea en el flujo{" "}
                  <strong className="text-slate-900 dark:text-white">
                    "{targetPipelineObj?.name || "seleccionado"}"
                  </strong>?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-neutral-800">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowFinalizeConfirm(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-md"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={executeFinalize}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold shadow-sm disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{submitting ? "Generando..." : "Sí, finalizar y generar"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
