import React, { useState } from "react";
import { X, Check } from "lucide-react";
import { apiFetch } from "../services/api";

interface CreateDealModalProps {
  isOpen: boolean;
  onClose: () => void;
  pipelineId: string;
  stages: any[];
  onCreated: () => void;
}

export const CreateDealModal: React.FC<CreateDealModalProps> = ({
  isOpen,
  onClose,
  pipelineId,
  stages,
  onCreated,
}) => {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [stageId, setStageId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");

  const [companies, setCompanies] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (stages.length > 0 && !stageId) {
      setStageId(stages[0].id);
    }
  }, [stages]);

  React.useEffect(() => {
    if (isOpen) {
      apiFetch<{ data: any[] }>("/api/companies").then((res) => setCompanies(res.data || []));
      apiFetch<{ data: any[] }>("/api/users?role=COMERCIAL").then((res) => {
        setUsers(res.data || []);
        if (res.data && res.data.length > 0) setOwnerId(res.data[0].id);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !stageId) return;

    setSaving(true);
    try {
      await apiFetch("/api/deals", {
        method: "POST",
        body: JSON.stringify({
          pipeline_id: pipelineId,
          stage_id: stageId,
          title: title.trim(),
          amount: Number(amount) || 0,
          company_id: companyId || null,
          owner_id: ownerId || null,
          expected_close_date: expectedCloseDate || null,
        }),
      });

      onCreated();
      onClose();
    } catch (err: any) {
      alert("Error al crear negocio: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-neutral-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Agregar Nueva Oportunidad Comercial
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Título de la Oportunidad *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Licencias Adicionales - Sucursal Norte"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Valor en COP
              </label>
              <input
                type="number"
                min="0"
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Etapa Inicial
              </label>
              <select
                value={stageId}
                onChange={(e) => setStageId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium"
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.win_probability}%)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Empresa Cliente
              </label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
              >
                <option value="">Seleccionar empresa...</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id} disabled={Boolean(c.do_not_contact)}>
                    {c.name}{c.do_not_contact ? " (No Contactar)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Asesor Propietario
              </label>
              <select
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
              >
                <option value="">Sin asignar...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Fecha Prevista de Cierre
            </label>
            <input
              type="date"
              value={expectedCloseDate}
              onChange={(e) => setExpectedCloseDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
            />
          </div>

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
              <span>{saving ? "Creando..." : "Crear Negocio"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
