import React, { useState, useEffect } from "react";
import { 
  Search, 
  CheckCircle2, 
  Circle, 
  Plus, 
  Play, 
  Calendar, 
  Briefcase, 
  LifeBuoy,
  Building2,
  Edit2,
  Trash2
} from "lucide-react";
import { apiFetch } from "../services/api";
import { TaskModal } from "../components/TaskModal";
import { useUser } from "../context/UserContext";

export const TasksTablePage: React.FC = () => {
  const { currentUser } = useUser();
  const isAdmin = currentUser?.role === "ADMIN";

  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "today" | "overdue" | "upcoming">("all");
  const [search, setSearch] = useState("");
  const [filterUserId, setFilterUserId] = useState("");
  const [allUsers, setAllUsers] = useState<any[]>([]);

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<any | null>(null);

  useEffect(() => {
    if (isAdmin) {
      apiFetch<{ data: any[] }>("/api/users")
        .then((res) => setAllUsers(res.data || []))
        .catch(() => {});
    } else {
      setFilterUserId("");
    }
  }, [isAdmin]);

  const loadTasks = () => {
    setLoading(true);
    let url = `/api/tasks?filter=${activeTab}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (isAdmin && filterUserId) url += `&assigned_to=${encodeURIComponent(filterUserId)}`;
    apiFetch<{ data: any[] }>(url)
      .then((res) => setTasks(res.data || []))
      .catch((err) => console.error("Error fetching tasks:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTasks();
  }, [activeTab, search, filterUserId, currentUser?.id]);

  const handleToggleTaskStatus = async (taskId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "COMPLETED" ? "NOT_STARTED" : "COMPLETED";
    try {
      await apiFetch(`/api/tasks/${taskId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      loadTasks();
    } catch (err: any) {
      alert("Error al actualizar tarea: " + err.message);
    }
  };

  const handleDeleteTask = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("¿Deseas eliminar esta tarea?")) return;
    try {
      await apiFetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      loadTasks();
    } catch (err: any) {
      alert("Error al eliminar: " + err.message);
    }
  };

  const handleOpenEdit = (task: any) => {
    setTaskToEdit(task);
    setIsTaskModalOpen(true);
  };

  const handleOpenCreate = () => {
    setTaskToEdit(null);
    setIsTaskModalOpen(true);
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden bg-white dark:bg-slate-950">
      
      {/* Top Banner */}
      <div className="bg-sky-50/80 dark:bg-sky-950/40 border-b border-sky-100 dark:border-sky-900/40 px-6 py-2 text-xs text-sky-900 dark:text-sky-200 flex items-center justify-between">
        <span>
          ¿Deseas ver las tareas en tu calendario de Google o de Outlook? Conecta un nuevo calendario para sincronizar las tareas creadas en KOA.
        </span>
        <button className="font-semibold text-brand-900 dark:text-brand-300 hover:underline">
          Ir a la configuración
        </button>
      </div>

      {/* Header and Filter Toolbar */}
      <div className="border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        
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
              Todos tareas
            </button>
            <button
              onClick={() => setActiveTab("today")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                activeTab === "today"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Vencen hoy
            </button>
            <button
              onClick={() => setActiveTab("overdue")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                activeTab === "overdue"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Atrasado
            </button>
            <button
              onClick={() => setActiveTab("upcoming")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                activeTab === "upcoming"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Próximamente
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
        </div>

        {/* Right: Role visibility indicator, Admin filter & Actions */}
        <div className="flex items-center gap-2">
          {isAdmin ? (
            <select
              value={filterUserId}
              onChange={(e) => setFilterUserId(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 dark:bg-[#1b1b1b] border border-slate-200 dark:border-neutral-700 rounded-lg text-xs text-slate-700 dark:text-slate-200"
            >
              <option value="">ADMIN: Todas las tareas</option>
              {allUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.role})
                </option>
              ))}
            </select>
          ) : (
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#1b1b1b] border border-slate-200 dark:border-neutral-700 text-[11px] font-medium text-slate-600 dark:text-slate-300">
              Mis tareas asignadas
            </span>
          )}

          <button className="flex items-center gap-1.5 px-3 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
            <Play className="w-3 h-3 text-slate-500" />
            <span>Iniciar tareas ({tasks.length})</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3 py-1 bg-brand-900 hover:bg-brand-800 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Agregar tareas</span>
          </button>
        </div>

      </div>

      {/* Tasks Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 font-medium">
              <th className="py-2.5 px-4 w-10">
                <input type="checkbox" className="rounded text-brand-900" />
              </th>
              <th className="py-2.5 px-4">Título de la tarea</th>
              <th className="py-2.5 px-4">Etapa / Estado</th>
              <th className="py-2.5 px-4">Asignado a</th>
              <th className="py-2.5 px-4">Vínculo (Comercial / Soporte / Empresa)</th>
              <th className="py-2.5 px-4">Fecha de vencimiento</th>
              <th className="py-2.5 px-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {tasks.map((task) => (
              <tr
                key={task.id}
                onClick={() => handleOpenEdit(task)}
                className="hover:bg-slate-50/80 dark:hover:bg-slate-900/60 transition-colors group cursor-pointer"
              >
                <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleToggleTaskStatus(task.id, task.status)}
                    className="text-slate-400 hover:text-emerald-600 transition-colors"
                  >
                    {task.status === "COMPLETED" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Circle className="w-4 h-4" />
                    )}
                  </button>
                </td>
                <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100 max-w-md">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={task.status === "COMPLETED" || task.status === "CANCELLED" ? "line-through text-slate-400" : ""}>
                      {task.title}
                    </span>
                    {task.task_type === "COMMERCIAL_RECOVERY" && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-200 border border-sky-200 dark:border-sky-800">
                        Recuperación
                      </span>
                    )}
                    {task.company_do_not_contact && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800">
                        No Contactar
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                  <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                    task.status === "COMPLETED" 
                      ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
                      : task.status === "CANCELLED"
                      ? "bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300"
                      : task.status === "IN_PROGRESS"
                      ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                  }`}>
                    {task.status === "COMPLETED"
                      ? "Completada"
                      : task.status === "CANCELLED"
                      ? "Cancelada"
                      : task.status === "IN_PROGRESS"
                      ? "En curso"
                      : "Sin iniciar"}
                  </span>
                </td>
                <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                  {task.assigned_to_name || "--"}
                </td>
                <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                  {task.deal_title ? (
                    <span className="flex items-center gap-1 text-brand-900 dark:text-slate-200 font-medium">
                      <Briefcase className="w-3 h-3 text-slate-400" /> {task.deal_title}
                    </span>
                  ) : task.source_ticket_number ? (
                    <span className="flex items-center gap-1 text-teal-700 dark:text-emerald-400 font-medium">
                      <LifeBuoy className="w-3 h-3 text-emerald-400" /> Ticket #{task.source_ticket_number}
                    </span>
                  ) : task.company_name ? (
                    <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                      <Building2 className="w-3 h-3" /> {task.company_name}
                    </span>
                  ) : (
                    "--"
                  )}
                </td>
                <td className="py-3 px-4 text-slate-500">
                  {task.due_at ? (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {new Date(task.due_at).toLocaleDateString()}
                    </span>
                  ) : (
                    "--"
                  )}
                </td>
                <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1 text-slate-400">
                    <button
                      onClick={() => handleOpenEdit(task)}
                      className="p-1 hover:text-slate-700 dark:hover:text-slate-200 rounded"
                      title="Modificar tarea"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteTask(task.id, e)}
                      className="p-1 hover:text-red-600 rounded"
                      title="Eliminar tarea"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {tasks.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="text-center py-10 text-slate-400 text-xs">
                  No hay tareas en esta vista.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Task Modal for Add/Edit */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        taskToEdit={taskToEdit}
        onSaved={loadTasks}
      />

    </div>
  );
};
