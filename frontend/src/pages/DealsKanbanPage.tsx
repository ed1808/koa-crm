import React, { useState, useEffect } from "react";
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  Plus, 
  Settings, 
  Sparkles, 
  ChevronRight
} from "lucide-react";
import { apiFetch } from "../services/api";
import { PipelineSettingsModal } from "../components/PipelineSettingsModal";
import { CreateDealModal } from "../components/CreateDealModal";
import { useUser } from "../context/UserContext";

interface DealsKanbanPageProps {
  onSelectDeal: (dealId: string) => void;
  onOpenCopilotWithDeal: (dealId: string) => void;
  refreshKey?: number;
}

export const DealsKanbanPage: React.FC<DealsKanbanPageProps> = ({
  onSelectDeal,
  onOpenCopilotWithDeal,
  refreshKey = 0,
}) => {
  const { currentUser } = useUser();
  const isAdmin = currentUser?.role === "ADMIN";

  const [pipelines, setPipelines] = useState<any[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");
  const [boardData, setBoardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreateDealOpen, setIsCreateDealOpen] = useState(false);
  const [activeQuickTab, setActiveQuickTab] = useState<"all" | "my">("all");

  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);

  const loadPipelines = (selectId?: string) => {
    apiFetch<{ data: any[] }>("/api/pipelines?module=CRM")
      .then((res) => {
        if (res.data && res.data.length > 0) {
          setPipelines(res.data);
          if (selectId) {
            setSelectedPipelineId(selectId);
          } else if (!selectedPipelineId) {
            setSelectedPipelineId(res.data[0].id);
          }
        }
      })
      .catch((err) => console.error("Error fetching pipelines:", err));
  };

  useEffect(() => {
    loadPipelines();
  }, []);

  const loadBoard = () => {
    if (!selectedPipelineId) return;
    setLoading(true);
    let url = `/api/deals/kanban?pipeline_id=${selectedPipelineId}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (activeQuickTab === "my" && currentUser?.id) url += `&owner_id=${encodeURIComponent(currentUser.id)}`;
    apiFetch<{ data: any }>(url)
      .then((res) => setBoardData(res.data))
      .catch((err) => console.error("Error fetching deals kanban:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBoard();
  }, [selectedPipelineId, search, activeQuickTab, refreshKey]);

  const handleDragStart = (dealId: string) => {
    setDraggedDealId(dealId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (targetStageId: string) => {
    if (!draggedDealId) return;
    try {
      await apiFetch(`/api/deals/${draggedDealId}/stage`, {
        method: "PATCH",
        body: JSON.stringify({ target_stage_id: targetStageId }),
      });
      loadBoard();
    } catch (err: any) {
      alert("Error al mover negocio: " + err.message);
    } finally {
      setDraggedDealId(null);
    }
  };

  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId);

  const renderActivityPill = (nextActivityAt: string | null) => {
    if (!nextActivityAt) {
      return (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/40 rounded px-2 py-0.5 text-[11px] text-amber-800 dark:text-amber-300 flex items-center justify-between">
          <span>— | No hay próximas actividades</span>
        </div>
      );
    }

    const dueDate = new Date(nextActivityAt);
    const now = new Date();
    const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 3600 * 24));

    if (diffDays < 0) {
      const pastDays = Math.abs(diffDays);
      const text = pastDays > 300 ? "hace un año" : `hace ${pastDays} días`;
      return (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/40 rounded px-2 py-0.5 text-[11px] text-amber-800 dark:text-amber-300 flex items-center justify-between">
          <span>📅 {text}</span>
          <span className="text-amber-600 font-bold">ⓘ</span>
        </div>
      );
    } else {
      return (
        <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-0.5 text-[11px] text-slate-700 dark:text-slate-300 flex items-center justify-between">
          <span>— | en {diffDays} días</span>
        </div>
      );
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden bg-slate-100/70 dark:bg-slate-950">
      
      {/* Top Filter and Pipeline Selector Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
        
        {/* Left: View Tabs */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => setActiveQuickTab("all")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                activeQuickTab === "all"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Todo Comercial
            </button>
            <button
              onClick={() => setActiveQuickTab("my")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                activeQuickTab === "my"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Mis oportunidades
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar ( / )"
              className="pl-8 pr-3 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs w-48 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <button className="flex items-center gap-1.5 px-2.5 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
            <Filter className="w-3 h-3 text-slate-500" />
            <span>Filtro</span>
          </button>
        </div>

        {/* Right: Pipeline Selector and Actions */}
        <div className="flex items-center gap-2">
          <select
            value={selectedPipelineId}
            onChange={(e) => setSelectedPipelineId(e.target.value)}
            className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Configure Pipeline Settings Modal button (Solo ADMIN) */}
          {isAdmin && (
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              title="Configurar Pipeline y Columnas"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Add Deal Button */}
          <button
            onClick={() => setIsCreateDealOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1 bg-brand-900 hover:bg-brand-800 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Agregar oportunidad</span>
          </button>
        </div>

      </div>

      {/* Kanban Board Container */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        {loading ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-400">
            Cargando tablero comercial...
          </div>
        ) : (
          <div className="flex items-start gap-3.5 h-full min-w-max pb-2">
            {boardData?.columns?.map((col: any) => (
              <div
                key={col.stage.id}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(col.stage.id)}
                className="w-72 max-w-72 flex flex-col h-full bg-slate-200/50 dark:bg-slate-900/60 rounded-xl border border-slate-300/60 dark:border-slate-800/80 shadow-2xs overflow-hidden"
              >
                {/* Column Header */}
                <div className="px-3.5 py-2.5 border-b border-slate-300/60 dark:border-slate-800 flex items-center justify-between bg-slate-100/70 dark:bg-slate-800/40">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {col.stage.name}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-white/80 dark:bg-slate-700/80 px-1.5 py-0.2 rounded-full border border-slate-200 dark:border-slate-700">
                      {col.count}
                    </span>
                  </div>
                </div>

                {/* Cards Scroll Area */}
                <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
                  {col.deals.map((deal: any) => (
                    <div
                      key={deal.id}
                      draggable
                      onDragStart={() => handleDragStart(deal.id)}
                      onClick={() => onSelectDeal(deal.id)}
                      className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-800 shadow-2xs hover:shadow-sm hover:border-brand-500/50 transition-all cursor-pointer group space-y-2"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="text-xs font-bold text-brand-900 dark:text-slate-100 group-hover:underline leading-tight">
                          {deal.title}
                        </h4>
                        {deal.is_finalized && (
                          <span className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800">
                            Finalizado
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Valor:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            COP {Number(deal.amount || 0).toLocaleString("es-CO")}
                          </span>
                        </div>
                        {deal.expected_close_date && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Fecha de cierre:</span>
                            <span>{new Date(deal.expected_close_date).toLocaleDateString()}</span>
                          </div>
                        )}
                        <div className="truncate">
                          <span className="text-slate-400">Propietario del negocio: </span>
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {deal.owner_name || "Sin asignar"}
                          </span>
                        </div>
                      </div>

                      {deal.contact_name && (
                        <div className="flex items-center gap-1.5 pt-1">
                          <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold flex items-center justify-center text-slate-600 dark:text-slate-400">
                            {deal.contact_name.charAt(0)}
                          </div>
                          <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate">
                            {deal.contact_name}
                          </span>
                        </div>
                      )}

                      {renderActivityPill(deal.next_activity_at)}

                      <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end gap-2 text-slate-400">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenCopilotWithDeal(deal.id);
                          }}
                          className="p-1 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                          title="Copiloto IA para este negocio"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectDeal(deal.id);
                          }}
                          className="p-1 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                          title="Ver detalle 360°"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                    </div>
                  ))}
                </div>

                {/* Column Footer */}
                <div className="p-2.5 bg-slate-100/90 dark:bg-slate-800/70 border-t border-slate-300/60 dark:border-slate-800 text-[11px] space-y-0.5">
                  <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 font-semibold">
                    <span>COP {Number(col.totalAmount || 0).toLocaleString("es-CO")}</span>
                    <span className="text-[10px] text-slate-400 font-normal">Cantidad total</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[10px]">
                    <span>
                      COP {Number(col.weightedAmount || 0).toLocaleString("es-CO")} ({col.stage.win_probability}%)
                    </span>
                    <span>Cantidad ponderada</span>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pipeline Settings & Creation Modal */}
      <PipelineSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        pipeline={selectedPipeline}
        stages={boardData?.columns?.map((c: any) => c.stage) || []}
        moduleType="CRM"
        onUpdated={loadBoard}
        onPipelineCreated={(newId) => loadPipelines(newId)}
      />

      {/* Create Deal Modal */}
      <CreateDealModal
        isOpen={isCreateDealOpen}
        onClose={() => setIsCreateDealOpen(false)}
        pipelineId={selectedPipelineId}
        stages={boardData?.columns?.map((c: any) => c.stage) || []}
        onCreated={loadBoard}
      />

    </div>
  );
};
