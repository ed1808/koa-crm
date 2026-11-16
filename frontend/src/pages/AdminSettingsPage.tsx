import React, { useState, useEffect } from "react";
import {
  Settings,
  CalendarClock,
  Save,
  CheckCircle2,
  Ban,
  ShieldCheck,
  Users,
  Plus,
  Search,
  Edit2,
  UserCheck,
  UserX
} from "lucide-react";
import { apiFetch } from "../services/api";
import { useUser } from "../context/UserContext";
import { UserModal } from "../components/UserModal";

type IntervalUnit = "DAYS" | "WEEKS" | "MONTHS";
type SettingsSubTab = "general" | "users";

const ROLE_BADGE_STYLES: Record<string, string> = {
  ADMIN: "bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-800",
  COMERCIAL: "bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-200 border-sky-200 dark:border-sky-800",
  SOPORTE: "bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 border-teal-200 dark:border-teal-800",
  EMPLEADO_INTERNO: "bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-neutral-700",
  CLIENTE: "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800",
  PROVEEDOR: "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800",
};

function previewRecoveryDate(baseDateStr: string, value: number, unit: IntervalUnit): string {
  const d = new Date(`${baseDateStr}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || value < 1) return baseDateStr;
  if (unit === "DAYS") {
    d.setUTCDate(d.getUTCDate() + value);
  } else if (unit === "WEEKS") {
    d.setUTCDate(d.getUTCDate() + value * 7);
  } else {
    const origDay = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + value);
    const maxDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(origDay, maxDay));
  }
  return d.toISOString().slice(0, 10);
}

export const AdminSettingsPage: React.FC = () => {
  const { currentUser, refreshUsers } = useUser();
  const [subTab, setSubTab] = useState<SettingsSubTab>("general");

  const [intervalValue, setIntervalValue] = useState<number>(1);
  const [intervalUnit, setIntervalUnit] = useState<IntervalUnit>("MONTHS");
  const [blockedCompanies, setBlockedCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  // User Management State
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<any | null>(null);

  const loadSettings = () => {
    setLoading(true);
    apiFetch<{ data: any }>("/api/settings")
      .then((res) => {
        if (res.data?.commercial_recovery) {
          setIntervalValue(Number(res.data.commercial_recovery.interval_value) || 1);
          setIntervalUnit(res.data.commercial_recovery.interval_unit || "MONTHS");
        }
        setBlockedCompanies(res.data?.blocked_companies || []);
      })
      .catch((err) => console.error("Error loading settings:", err))
      .finally(() => setLoading(false));
  };

  const loadUsers = () => {
    setLoadingUsers(true);
    apiFetch<{ data: any[] }>("/api/users?include_inactive=true")
      .then((res) => setUsersList(res.data || []))
      .catch((err) => console.error("Error loading users:", err))
      .finally(() => setLoadingUsers(false));
  };

  useEffect(() => {
    loadSettings();
    loadUsers();
  }, []);

  if (currentUser?.role !== "ADMIN") {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50 dark:bg-[#151515] text-xs text-slate-500 dark:text-slate-400">
        Solo el usuario Administrador tiene acceso a esta sección de configuración.
      </div>
    );
  }

  const handleToggleUserStatus = async (u: any) => {
    if (u.id === currentUser.id) {
      alert("No puedes desactivar tu propia cuenta de administrador.");
      return;
    }
    const nextActive = !u.is_active;
    const msg = nextActive
      ? `¿Deseas reactivar la cuenta de "${u.full_name}"?`
      : `¿Deseas desactivar la cuenta de "${u.full_name}"? No podrá iniciar sesión mientras esté inactiva.`;
    if (!confirm(msg)) return;

    try {
      await apiFetch(`/api/users/${u.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: nextActive }),
      });
      loadUsers();
      refreshUsers();
    } catch (err: any) {
      alert("Error al actualizar estado del usuario: " + err.message);
    }
  };

  const filteredUsers = usersList.filter((u) => {
    if (roleFilter && u.role !== roleFilter) return false;
    if (userSearch.trim()) {
      const q = userSearch.toLowerCase();
      return (
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.department && u.department.toLowerCase().includes(q)) ||
        (u.linked_company_name && u.linked_company_name.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedNotice(null);
    try {
      await apiFetch("/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          interval_value: Number(intervalValue),
          interval_unit: intervalUnit,
        }),
      });
      setSavedNotice("Configuración guardada correctamente.");
    } catch (err: any) {
      alert("Error al guardar configuración: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUnblockCompany = async (companyId: string, name: string) => {
    if (!confirm(`¿Deseas habilitar nuevamente el contacto comercial para "${name}"?`)) return;
    try {
      await apiFetch(`/api/companies/${companyId}/do-not-contact`, {
        method: "PATCH",
        body: JSON.stringify({ do_not_contact: false }),
      });
      loadSettings();
    } catch (err: any) {
      alert("Error al habilitar empresa: " + err.message);
    }
  };

  const sampleBase = "2026-11-13";
  const sampleResult = previewRecoveryDate(sampleBase, Number(intervalValue) || 1, intervalUnit);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#151515] p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-900 text-white">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Configuración del Sistema
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Parámetros globales y gestión de usuarios exclusivos del perfil Administrador.
              </p>
            </div>
          </div>

          {/* Sub-tabs */}
          <div className="flex items-center bg-slate-200/70 dark:bg-[#1c1c1c] border border-slate-200 dark:border-neutral-800 rounded-lg p-1 gap-1">
            <button
              type="button"
              onClick={() => setSubTab("general")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                subTab === "general"
                  ? "bg-white dark:bg-[#2a2a2a] text-slate-900 dark:text-white shadow-2xs font-semibold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <CalendarClock className="w-3.5 h-3.5" />
              <span>Parámetros y Bloqueos</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab("users")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                subTab === "users"
                  ? "bg-white dark:bg-[#2a2a2a] text-slate-900 dark:text-white shadow-2xs font-semibold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Gestión de Usuarios ({usersList.length})</span>
            </button>
          </div>
        </div>

        {subTab === "general" && (
          loading ? (
            <div className="p-8 text-center text-xs text-slate-400 bg-white dark:bg-[#1c1c1c] rounded-xl border border-slate-200 dark:border-neutral-800">
              Cargando configuración...
            </div>
          ) : (
            <>
            {/* Commercial Recovery Setting Card */}
            <form
              onSubmit={handleSave}
              className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-slate-200 dark:border-neutral-800 shadow-2xs p-5 space-y-4"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300">
                  <CalendarClock className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Lapso Automático para Tareas de Recuperación de Clientes
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Cuando un asesor comercial marque un cliente como <strong>"No interesado por el momento"</strong>, el sistema retirará la oportunidad del pipeline y programará automáticamente una tarea de recuperación sumando este lapso a la fecha de última gestión.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Cantidad de tiempo
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    required
                    value={intervalValue}
                    onChange={(e) => setIntervalValue(Math.max(1, parseInt(e.target.value || "1", 10)))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#151515] border border-slate-200 dark:border-neutral-700 rounded-lg text-xs text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Unidad
                  </label>
                  <select
                    value={intervalUnit}
                    onChange={(e) => setIntervalUnit(e.target.value as IntervalUnit)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#151515] border border-slate-200 dark:border-neutral-700 rounded-lg text-xs text-slate-900 dark:text-slate-100"
                  >
                    <option value="DAYS">Días</option>
                    <option value="WEEKS">Semanas</option>
                    <option value="MONTHS">Meses</option>
                  </select>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#151515] border border-slate-200 dark:border-neutral-800 text-xs text-slate-700 dark:text-slate-300">
                <strong>Vista previa de cálculo:</strong> Si la fecha de última gestión es{" "}
                <code className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-neutral-800 font-mono text-[11px]">{sampleBase}</code>, la tarea de recuperación se programará automáticamente para el{" "}
                <code className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 font-mono text-[11px] font-bold">{sampleResult}</code>.
              </div>

              {savedNotice && (
                <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-200">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{savedNotice}</span>
                </div>
              )}

              <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-neutral-800">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-brand-900 hover:bg-brand-800 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? "Guardando..." : "Guardar configuración"}</span>
                </button>
              </div>
            </form>

            {/* Do Not Contact Registry Card */}
            <div className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-slate-200 dark:border-neutral-800 shadow-2xs p-5 space-y-3">
              <div className="flex items-center gap-2.5">
                <Ban className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Empresas con Restricción "No Contactar Nuevamente" ({blockedCompanies.length})
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Estas empresas solicitaron no recibir más gestión comercial. Solo un Administrador puede reactivarlas si el cliente autoriza nuevamente el contacto.
              </p>

              {blockedCompanies.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 dark:bg-[#151515] rounded-lg border border-slate-200 dark:border-neutral-800">
                  No hay empresas bloqueadas actualmente.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-neutral-800 border border-slate-200 dark:border-neutral-800 rounded-lg overflow-hidden">
                  {blockedCompanies.map((c) => (
                    <div
                      key={c.id}
                      className="p-3 bg-slate-50/70 dark:bg-[#151515] flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{c.name}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {c.do_not_contact_reason || "Solicitó no volver a ser contactado"}
                          {c.do_not_contact_at ? ` · ${new Date(c.do_not_contact_at).toLocaleDateString()}` : ""}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUnblockCompany(c.id, c.name)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-neutral-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-neutral-800"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Habilitar contacto</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
          )
        )}

        {subTab === "users" && (
          <div className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-slate-200 dark:border-neutral-800 shadow-2xs overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Buscar por nombre, correo o empresa..."
                    className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-[#151515] border border-slate-200 dark:border-neutral-700 rounded-lg text-xs w-64 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 dark:bg-[#151515] border border-slate-200 dark:border-neutral-700 rounded-lg text-xs text-slate-800 dark:text-slate-100"
                >
                  <option value="">Todos los roles</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="COMERCIAL">COMERCIAL</option>
                  <option value="SOPORTE">SOPORTE</option>
                  <option value="EMPLEADO_INTERNO">EMPLEADO_INTERNO</option>
                  <option value="CLIENTE">CLIENTE</option>
                  <option value="PROVEEDOR">PROVEEDOR</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => {
                  setUserToEdit(null);
                  setIsUserModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-brand-900 hover:bg-brand-800 text-white rounded-lg text-xs font-semibold shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nuevo usuario</span>
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-neutral-800 bg-slate-50/70 dark:bg-[#151515] text-slate-500 dark:text-slate-400 font-medium">
                    <th className="py-2.5 px-4">Usuario</th>
                    <th className="py-2.5 px-4">Rol</th>
                    <th className="py-2.5 px-4">Departamento</th>
                    <th className="py-2.5 px-4">Empresa Asociada</th>
                    <th className="py-2.5 px-4">Estado</th>
                    <th className="py-2.5 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
                  {loadingUsers ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Cargando usuarios...
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No se encontraron usuarios con ese criterio.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-[#222222]/60 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            <span>{u.full_name}</span>
                            {u.id === currentUser.id && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-100 dark:bg-neutral-800 text-brand-900 dark:text-slate-200 font-bold">
                                Tú
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">{u.email}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                              ROLE_BADGE_STYLES[u.role] || "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                          {u.department || "--"}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                          {u.linked_company_name || "--"}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                              u.is_active
                                ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800"
                                : "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800"
                            }`}
                          >
                            {u.is_active ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setUserToEdit(u);
                                setIsUserModalOpen(true);
                              }}
                              className="p-1.5 rounded-md border border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-neutral-800"
                              title="Editar usuario"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={u.id === currentUser.id}
                              onClick={() => handleToggleUserStatus(u)}
                              className="p-1.5 rounded-md border border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-neutral-800 disabled:opacity-40"
                              title={u.is_active ? "Desactivar usuario" : "Activar usuario"}
                            >
                              {u.is_active ? (
                                <UserX className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                              ) : (
                                <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <UserModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        userToEdit={userToEdit}
        onSaved={() => {
          loadUsers();
          refreshUsers();
        }}
      />
    </div>
  );
};
