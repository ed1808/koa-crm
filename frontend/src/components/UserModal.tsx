import React, { useState, useEffect } from "react";
import { X, Check, UserCog } from "lucide-react";
import { apiFetch } from "../services/api";
import { useUser } from "../context/UserContext";

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  userToEdit?: any | null;
  onSaved: () => void;
}

const ROLE_OPTIONS = [
  { value: "ADMIN", label: "Administrador (ADMIN)" },
  { value: "COMERCIAL", label: "Asesor Comercial (COMERCIAL)" },
  { value: "SOPORTE", label: "Agente de Soporte (SOPORTE)" },
  { value: "EMPLEADO_INTERNO", label: "Empleado Interno (EMPLEADO_INTERNO)" },
  { value: "CLIENTE", label: "Cliente Externo (CLIENTE)" },
  { value: "PROVEEDOR", label: "Proveedor Externo (PROVEEDOR)" },
];

export const UserModal: React.FC<UserModalProps> = ({
  isOpen,
  onClose,
  userToEdit,
  onSaved,
}) => {
  const { currentUser } = useUser();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("COMERCIAL");
  const [department, setDepartment] = useState("");
  const [linkedCompanyId, setLinkedCompanyId] = useState("");
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [companies, setCompanies] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      apiFetch<{ data: any[] }>("/api/companies")
        .then((res) => setCompanies(res.data || []))
        .catch(() => setCompanies([]));

      if (userToEdit) {
        setFullName(userToEdit.full_name || "");
        setEmail(userToEdit.email || "");
        setRole(userToEdit.role || "COMERCIAL");
        setDepartment(userToEdit.department || "");
        setLinkedCompanyId(userToEdit.linked_company_id || "");
        setPassword("");
        setIsActive(Boolean(userToEdit.is_active));
      } else {
        setFullName("");
        setEmail("");
        setRole("COMERCIAL");
        setDepartment("");
        setLinkedCompanyId("");
        setPassword("");
        setIsActive(true);
      }
    }
  }, [isOpen, userToEdit]);

  if (!isOpen) return null;

  const isEditingSelf = Boolean(userToEdit && currentUser && userToEdit.id === currentUser.id);
  const requiresCompany = role === "CLIENTE";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) return;
    if (!userToEdit && password.length < 6) {
      alert("La contraseña inicial debe tener al menos 6 caracteres.");
      return;
    }
    if (userToEdit && password.trim().length > 0 && password.length < 6) {
      alert("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (requiresCompany && !linkedCompanyId) {
      alert("Debes seleccionar una empresa asociada para los usuarios con rol CLIENTE.");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, any> = {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        role,
        department: department.trim() || null,
        linked_company_id: role === "CLIENTE" ? linkedCompanyId : linkedCompanyId || null,
        is_active: isActive,
      };
      if (password.trim().length > 0) {
        payload.password = password;
      }

      if (userToEdit) {
        await apiFetch(`/api/users/${userToEdit.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/api/users", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      onSaved();
      onClose();
    } catch (err: any) {
      alert("Error al guardar usuario: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-2xl border border-slate-200 dark:border-neutral-800 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCog className="w-4 h-4 text-brand-700 dark:text-slate-200" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {userToEdit ? "Editar Usuario" : "Crear Nuevo Usuario"}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Nombre Completo *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ej: Laura Gómez"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#151515] border border-slate-200 dark:border-neutral-700 rounded-lg text-xs text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Correo Electrónico *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@empresa.com"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#151515] border border-slate-200 dark:border-neutral-700 rounded-lg text-xs text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Rol del Sistema *
              </label>
              <select
                value={role}
                disabled={isEditingSelf}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#151515] border border-slate-200 dark:border-neutral-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 disabled:opacity-60"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Departamento / Área
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Ej: Ventas B2B, Soporte TI"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#151515] border border-slate-200 dark:border-neutral-700 rounded-lg text-xs text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {role === "CLIENTE" && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Empresa Asociada *
              </label>
              <select
                required
                value={linkedCompanyId}
                onChange={(e) => setLinkedCompanyId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#151515] border border-slate-200 dark:border-neutral-700 rounded-lg text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="">Seleccionar empresa cliente...</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              {userToEdit ? "Nueva Contraseña (opcional)" : "Contraseña Inicial *"}
            </label>
            <input
              type="password"
              required={!userToEdit}
              minLength={userToEdit ? undefined : 6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                userToEdit
                  ? "Dejar en blanco para conservar la contraseña actual"
                  : "Mínimo 6 caracteres"
              }
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#151515] border border-slate-200 dark:border-neutral-700 rounded-lg text-xs text-slate-900 dark:text-slate-100"
            />
          </div>

          {userToEdit && (
            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={isActive}
                disabled={isEditingSelf}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded text-brand-900 focus:ring-brand-500 disabled:opacity-50"
              />
              <span>Cuenta activa (permite iniciar sesión y recibir asignaciones)</span>
            </label>
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
              disabled={saving || !fullName.trim() || !email.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-brand-900 hover:bg-brand-800 text-white rounded-md text-xs font-semibold shadow-sm disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{saving ? "Guardando..." : userToEdit ? "Guardar cambios" : "Crear usuario"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
