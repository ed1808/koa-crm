import React, { useState } from "react";
import { X, Plus, Trash2, GripVertical, Check, GitBranch } from "lucide-react";
import { apiFetch } from "../services/api";

interface PipelineSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  pipeline: any;
  stages: any[];
  moduleType: "CRM" | "TICKETS";
  onUpdated: () => void;
  onPipelineCreated?: (newPipelineId: string) => void;
}

export const PipelineSettingsModal: React.FC<PipelineSettingsModalProps> = ({
  isOpen,
  onClose,
  pipeline,
  stages,
  moduleType,
  onUpdated,
  onPipelineCreated,
}) => {
  const [stageList, setStageList] = useState<any[]>(stages);
  const [saving, setSaving] = useState(false);

  // Modo crear nuevo pipeline
  const [isCreatingNewPipeline, setIsCreatingNewPipeline] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState("");
  const [newPipelineDesc, setNewPipelineDesc] = useState("");

  // Sincronizar stages cuando se abre o cambia pipeline
  React.useEffect(() => {
    setStageList(stages);
    setIsCreatingNewPipeline(false);
    setNewPipelineName("");
    setNewPipelineDesc("");
  }, [stages, pipeline, isOpen]);

  if (!isOpen) return null;

  const handleAddStage = () => {
    setStageList([
      ...stageList,
      {
        name: "Nueva Etapa",
        position: stageList.length + 1,
        win_probability: moduleType === "CRM" ? 50 : 0,
        status_category: "IN_PROGRESS",
        default_sla_hours: moduleType === "TICKETS" ? 24 : null,
        color_hex: "#0F5C4D",
      },
    ]);
  };

  const handleUpdateField = (index: number, field: string, val: any) => {
    const next = [...stageList];
    next[index] = { ...next[index], [field]: val };
    setStageList(next);
  };

  const handleDeleteStage = (index: number) => {
    setStageList(stageList.filter((_, i) => i !== index));
  };

  const handleSaveStages = async () => {
    if (!pipeline?.id) return;
    setSaving(true);
    try {
      await apiFetch(`/api/pipelines/${pipeline.id}/stages`, {
        method: "PUT",
        body: JSON.stringify({ stages: stageList }),
      });
      onUpdated();
      onClose();
    } catch (err: any) {
      alert("Error al guardar etapas del pipeline: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPipelineName.trim()) return;

    setSaving(true);
    try {
      const res = await apiFetch<{ data: any }>("/api/pipelines", {
        method: "POST",
        body: JSON.stringify({
          module_type: moduleType,
          name: newPipelineName.trim(),
          description: newPipelineDesc.trim() || undefined,
        }),
      });

      if (onPipelineCreated && res.data?.id) {
        onPipelineCreated(res.data.id);
      }
      onUpdated();
      onClose();
    } catch (err: any) {
      alert("Error al crear pipeline: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header con tabs para cambiar entre editar etapas o crear nuevo pipeline */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCreatingNewPipeline(false)}
              className={`text-sm font-semibold pb-1 transition-all ${
                !isCreatingNewPipeline
                  ? "text-brand-900 dark:text-slate-100 border-b-2 border-brand-900 dark:border-emerald-400 font-bold"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              Configurar Columnas / Etapas
            </button>
            <button
              onClick={() => setIsCreatingNewPipeline(true)}
              className={`text-sm font-semibold pb-1 flex items-center gap-1 transition-all ${
                isCreatingNewPipeline
                  ? "text-brand-900 dark:text-slate-100 border-b-2 border-brand-900 dark:border-emerald-400 font-bold"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              Crear Nuevo Pipeline
            </button>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab 1: Configurar Etapas del Pipeline Actual */}
        {!isCreatingNewPipeline ? (
          <>
            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Etapas de {pipeline?.name || "Pipeline"}
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Puedes agregar, renombrar, cambiar el orden o eliminar columnas.
                  </p>
                </div>
                <button
                  onClick={handleAddStage}
                  className="flex items-center gap-1 text-xs text-brand-900 dark:text-emerald-400 hover:underline font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" /> Agregar etapa
                </button>
              </div>

              {stageList.map((st, idx) => (
                <div
                  key={st.id || `temp-${idx}`}
                  className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  <GripVertical className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  
                  {/* Stage Name */}
                  <input
                    type="text"
                    value={st.name}
                    onChange={(e) => handleUpdateField(idx, "name", e.target.value)}
                    placeholder="Nombre de la etapa"
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />

                  {/* Module-Specific Settings */}
                  {moduleType === "CRM" ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-500">% Éxito:</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={st.win_probability ?? 0}
                        onChange={(e) => handleUpdateField(idx, "win_probability", parseInt(e.target.value) || 0)}
                        className="w-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs text-center text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-500">SLA (horas):</span>
                      <input
                        type="number"
                        min="1"
                        value={st.default_sla_hours ?? 24}
                        onChange={(e) => handleUpdateField(idx, "default_sla_hours", parseInt(e.target.value) || null)}
                        className="w-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs text-center text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </div>
                  )}

                  {/* Color picker */}
                  <input
                    type="color"
                    value={st.color_hex || "#0F5C4D"}
                    onChange={(e) => handleUpdateField(idx, "color_hex", e.target.value)}
                    className="w-7 h-7 rounded border border-slate-200 dark:border-slate-700 cursor-pointer p-0.5 bg-transparent"
                  />

                  {/* Delete */}
                  <button
                    onClick={() => handleDeleteStage(idx)}
                    className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                    title="Eliminar etapa"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveStages}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-brand-900 hover:bg-brand-800 text-white rounded-md text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{saving ? "Guardando..." : "Guardar Cambios"}</span>
              </button>
            </div>
          </>
        ) : (
          /* Tab 2: Crear Nuevo Pipeline */
          <form onSubmit={handleCreatePipeline}>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Nombre del Pipeline
                </label>
                <input
                  type="text"
                  required
                  value={newPipelineName}
                  onChange={(e) => setNewPipelineName(e.target.value)}
                  placeholder={moduleType === "CRM" ? "Ej: Pipeline Renovaciones o Up-Selling" : "Ej: Soporte Facturación Electrónica"}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Descripción (Opcional)
                </label>
                <textarea
                  rows={3}
                  value={newPipelineDesc}
                  onChange={(e) => setNewPipelineDesc(e.target.value)}
                  placeholder="Describe el propósito y flujo de este pipeline..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="p-3 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-lg text-[11px] text-teal-800 dark:text-teal-200">
                Al crear el pipeline se generarán automáticamente las etapas base según el módulo ({moduleType}), las cuales podrás personalizar inmediatamente.
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreatingNewPipeline(false)}
                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"
              >
                Volver
              </button>
              <button
                type="submit"
                disabled={saving || !newPipelineName.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-brand-900 hover:bg-brand-800 text-white rounded-md text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{saving ? "Creando..." : "Crear Pipeline"}</span>
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
