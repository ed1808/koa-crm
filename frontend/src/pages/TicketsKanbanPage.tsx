import React, { useState, useEffect } from "react";
import { 
  Search, 
  Filter, 
  Plus, 
  Settings, 
  Sparkles, 
  ChevronRight
} from "lucide-react";
import { apiFetch } from "../services/api";
import { PipelineSettingsModal } from "../components/PipelineSettingsModal";
import { CreateTicketModal } from "../components/CreateTicketModal";
import { useUser } from "../context/UserContext";

interface TicketsKanbanPageProps {
  onSelectTicket: (ticketId: string) => void;
  onOpenCopilotWithTicket: (ticketId: string) => void;
  refreshKey?: number;
}

export const TicketsKanbanPage: React.FC<TicketsKanbanPageProps> = ({
  onSelectTicket,
  onOpenCopilotWithTicket,
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
  const [isCreateTicketOpen, setIsCreateTicketOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "open" | "unassigned">("all");

  const [draggedTicketId, setDraggedTicketId] = useState<string | null>(null);

  const loadPipelines = (selectId?: string) => {
    apiFetch<{ data: any[] }>("/api/pipelines?module=TICKETS")
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
      .catch((err) => console.error("Error fetching ticket pipelines:", err));
  };

  useEffect(() => {
    loadPipelines();
  }, [currentUser?.role]);

  const loadBoard = () => {
    if (!selectedPipelineId) return;
    setLoading(true);
    let url = `/api/tickets/kanban?pipeline_id=${selectedPipelineId}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (activeTab === "unassigned") url += `&unassigned=true`;
    if (activeTab === "open" && currentUser?.id) url += `&agent_id=${encodeURIComponent(currentUser.id)}`;

    apiFetch<{ data: any }>(url)
      .then((res) => setBoardData(res.data))
      .catch((err) => console.error("Error fetching tickets kanban:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBoard();
  }, [selectedPipelineId, search, activeTab, refreshKey]);

  const handleDragStart = (ticketId: string) => {
    setDraggedTicketId(ticketId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (targetStageId: string) => {
    if (!draggedTicketId) return;
    try {
      await apiFetch(`/api/tickets/${draggedTicketId}/stage`, {
        method: "PATCH",
        body: JSON.stringify({ target_stage_id: targetStageId }),
      });
      loadBoard();
    } catch (err: any) {
      alert("Error al mover ticket: " + err.message);
    } finally {
      setDraggedTicketId(null);
    }
  };

  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return "text-red-600 bg-red-500";
      case "HIGH":
        return "text-rose-600 bg-rose-500";
      case "MEDIUM":
        return "text-amber-600 bg-amber-500";
      default:
        return "text-slate-500 bg-slate-400";
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden bg-slate-100/70 dark:bg-slate-950">
      
      {/* Top Filter and Pipeline Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
        
        {/* Left: View Tabs */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                activeTab === "all"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Todo Soporte
            </button>
            <button
              onClick={() => setActiveTab("open")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                activeTab === "open"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Mis casos asignados
            </button>
            <button
              onClick={() => setActiveTab("unassigned")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                activeTab === "unassigned"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Casos sin asignar
            </button>
          </div>

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

        {/* Right: Pipeline Selector & Add Ticket */}
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

          {isAdmin && (
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              title="Configurar Pipeline de Soporte"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => setIsCreateTicketOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1 bg-brand-900 hover:bg-brand-800 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Agregar soporte</span>
          </button>
        </div>

      </div>

      {/* Tickets Kanban Columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        {loading ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-400">
            Cargando tickets de soporte...
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

                {/* Cards List */}
                <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
                  {col.tickets.map((ticket: any) => (
                    <div
                      key={ticket.id}
                      draggable
                      onDragStart={() => handleDragStart(ticket.id)}
                      onClick={() => onSelectTicket(ticket.id)}
                      className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-800 shadow-2xs hover:shadow-sm hover:border-brand-500/50 transition-all cursor-pointer group space-y-2"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-1">
                          <h4 className="text-xs font-bold text-brand-900 dark:text-slate-100 group-hover:underline leading-tight">
                            ID {ticket.ticket_number} - {ticket.company_name || ticket.subject}
                          </h4>
                          {ticket.is_finalized && (
                            <span className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800">
                              Finalizado
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate mt-0.5">
                          {ticket.subject}
                        </span>
                      </div>

                      <div className="space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                        <div className="truncate">
                          <span className="text-slate-400">Propietario del ticket: </span>
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {ticket.assigned_agent_name || "Sin asignar"}
                          </span>
                        </div>
                        <div className="truncate">
                          <span className="text-slate-400">Categoría: </span>
                          <span>{ticket.category}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] font-medium">
                        <span className={`w-2 h-2 rounded-full ${getPriorityColor(ticket.priority)}`} />
                        <span className="capitalize">{ticket.priority.toLowerCase()}</span>
                      </div>

                      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/40 rounded px-2 py-0.5 text-[11px] text-amber-800 dark:text-amber-300 flex items-center justify-between">
                        <span>📅 Actividad reciente</span>
                        <span className="text-amber-600 font-bold">ⓘ</span>
                      </div>

                      <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-slate-400">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenCopilotWithTicket(ticket.id);
                          }}
                          className="flex items-center gap-1 text-[11px] text-teal-700 dark:text-emerald-400 hover:underline font-semibold"
                          title="Copiloto IA: Resumir o derivar a comercial"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                          <span>Derivar / Resumir</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectTicket(ticket.id);
                          }}
                          className="p-1 hover:text-slate-700 dark:hover:text-slate-200"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                    </div>
                  ))}
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      <PipelineSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        pipeline={selectedPipeline}
        stages={boardData?.columns?.map((c: any) => c.stage) || []}
        moduleType="TICKETS"
        onUpdated={loadBoard}
        onPipelineCreated={(newId) => loadPipelines(newId)}
      />

      <CreateTicketModal
        isOpen={isCreateTicketOpen}
        onClose={() => setIsCreateTicketOpen(false)}
        pipelineId={selectedPipelineId}
        stages={boardData?.columns?.map((c: any) => c.stage) || []}
        onCreated={loadBoard}
      />

    </div>
  );
};
