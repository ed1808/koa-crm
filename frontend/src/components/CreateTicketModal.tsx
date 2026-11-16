import React, { useState } from "react";
import { X, Check, Info } from "lucide-react";
import { apiFetch } from "../services/api";
import { useUser } from "../context/UserContext";

interface CreateTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  pipelineId: string;
  stages: any[];
  onCreated: () => void;
}

export const CreateTicketModal: React.FC<CreateTicketModalProps> = ({
  isOpen,
  onClose,
  pipelineId,
  stages,
  onCreated,
}) => {
  const { currentUser } = useUser();
  const isComercialOrInternal = currentUser.role === "COMERCIAL" || currentUser.role === "EMPLEADO_INTERNO";
  const isClient = currentUser.role === "CLIENTE";
  const canFullTriage = currentUser.role === "ADMIN" || currentUser.role === "SOPORTE";

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [stageId, setStageId] = useState("");
  const [category, setCategory] = useState("Error en el producto");
  const [priority, setPriority] = useState("MEDIUM");
  const [ticketScope, setTicketScope] = useState<"CUSTOMER" | "INTERNAL">(
    isComercialOrInternal ? "INTERNAL" : "CUSTOMER"
  );
  const [companyId, setCompanyId] = useState("");
  const [assignedAgentId, setAssignedAgentId] = useState("");

  const [companies, setCompanies] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (stages.length > 0) {
      setStageId(stages[0].id);
    }
  }, [stages, isOpen]);

  React.useEffect(() => {
    if (isComercialOrInternal) {
      setTicketScope("INTERNAL");
      setAssignedAgentId("");
      setPriority("MEDIUM");
      setCompanyId("");
    } else if (isClient) {
      setTicketScope("CUSTOMER");
      setAssignedAgentId("");
      setPriority("MEDIUM");
    }
  }, [isOpen, currentUser.role, isComercialOrInternal, isClient]);

  React.useEffect(() => {
    if (isOpen && canFullTriage) {
      apiFetch<{ data: any[] }>("/api/companies").then((res) => setCompanies(res.data || []));
      apiFetch<{ data: any[] }>("/api/users").then((res) =>
        setAgents((res.data || []).filter((u: any) => u.role === "SOPORTE" || u.role === "ADMIN"))
      );
    }
  }, [isOpen, canFullTriage]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim() || !stageId) return;

    setSaving(true);
    try {
      const payload: Record<string, any> = {
        pipeline_id: pipelineId,
        stage_id: stageId,
        category,
        subject: subject.trim(),
        description: description.trim(),
      };

      if (canFullTriage) {
        payload.ticket_scope = ticketScope;
        payload.company_id = ticketScope === "CUSTOMER" ? companyId || null : null;
        payload.assigned_agent_id = assignedAgentId || null;
        payload.priority = priority;
      }

      await apiFetch("/api/tickets", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setSubject("");
      setDescription("");
      onCreated();
      onClose();
    } catch (err: any) {
      alert("Error al crear caso de soporte: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-2xl border border-slate-200 dark:border-neutral-800 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-neutral-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Crear Nuevo Caso de Soporte
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {canFullTriage ? (
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  checked={ticketScope === "CUSTOMER"}
                  onChange={() => setTicketScope("CUSTOMER")}
                  className="text-brand-900"
                />
                <span>Atención a Cliente</span>
              </label>
              <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  checked={ticketScope === "INTERNAL"}
                  onChange={() => setTicketScope("INTERNAL")}
                  className="text-brand-900"
                />
                <span>Soporte Interno (Entre Departamentos)</span>
              </label>
            </div>
          ) : (
            <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-[#222222] border border-slate-200 dark:border-neutral-700 flex items-start gap-2 text-[11px] text-slate-700 dark:text-slate-300">
              <Info className="w-4 h-4 text-sky-600 dark:text-sky-400 flex-shrink-0 mt-0.5" />
              <span>
                {isComercialOrInternal
                  ? "Este ticket se registrará automáticamente como Soporte Interno sin asignar, y el equipo de Soporte determinará su prioridad y responsable."
                  : "Este ticket se registrará como Atención a Cliente asociado automáticamente a tu empresa, y el equipo de Soporte definirá prioridad y responsable."}
              </span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Asunto del Ticket *
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ej: Inconsistencia en liquidación de horas extras"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Descripción Detallada *
            </label>
            <textarea
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe detalladamente el requerimiento o incidente..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
            />
          </div>

          <div className={`grid ${canFullTriage ? "grid-cols-2" : "grid-cols-1"} gap-3`}>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Categoría
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#151515] border border-slate-200 dark:border-neutral-700 rounded-lg text-xs"
              >
                <option value="Error en el producto">Error en el producto</option>
                <option value="Solicitud nueva característica">Solicitud nueva característica</option>
                <option value="Capacitación / Duda operativa">Capacitación / Duda operativa</option>
                <option value="Soporte TI / Acceso">Soporte TI / Acceso</option>
              </select>
            </div>

            {canFullTriage && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Prioridad
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#151515] border border-slate-200 dark:border-neutral-700 rounded-lg text-xs"
                >
                  <option value="LOW">Baja</option>
                  <option value="MEDIUM">Media</option>
                  <option value="HIGH">Alta</option>
                  <option value="URGENT">Urgente</option>
                </select>
              </div>
            )}
          </div>

          {canFullTriage && (
            <div className="grid grid-cols-2 gap-3">
              {ticketScope === "CUSTOMER" ? (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Empresa Cliente
                  </label>
                  <select
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#151515] border border-slate-200 dark:border-neutral-700 rounded-lg text-xs"
                  >
                    <option value="">Seleccionar empresa...</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Área Solicitante
                  </label>
                  <input
                    type="text"
                    disabled
                    value="Interno"
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-[#222222] border border-slate-200 dark:border-neutral-700 rounded-lg text-xs opacity-70"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Agente Responsable
                </label>
                <select
                  value={assignedAgentId}
                  onChange={(e) => setAssignedAgentId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#151515] border border-slate-200 dark:border-neutral-700 rounded-lg text-xs"
                >
                  <option value="">Sin asignar...</option>
                  {agents.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-200 dark:border-neutral-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-md"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !subject.trim() || !description.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-brand-900 hover:bg-brand-800 text-white rounded-md text-xs font-semibold shadow-sm disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{saving ? "Creando..." : "Crear Caso"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
