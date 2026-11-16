import React, { useState } from "react";
import { X, Check } from "lucide-react";
import { apiFetch } from "../services/api";

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  contactToEdit?: any | null;
  onSaved: () => void;
}

export const ContactModal: React.FC<ContactModalProps> = ({
  isOpen,
  onClose,
  contactToEdit,
  onSaved,
}) => {
  const [fullName, setFullName] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [positionTitle, setPositionTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [commercialOwnerId, setCommercialOwnerId] = useState("");

  const [companies, setCompanies] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      apiFetch<{ data: any[] }>("/api/companies").then((res) => {
        setCompanies(res.data || []);
        if (res.data && res.data.length > 0 && !companyId && !contactToEdit) {
          setCompanyId(res.data[0].id);
        }
      });
      apiFetch<{ data: any[] }>("/api/users?role=COMERCIAL").then((res) => setUsers(res.data || []));

      if (contactToEdit) {
        setFullName(contactToEdit.full_name || "");
        setCompanyId(contactToEdit.company_id || "");
        setPositionTitle(contactToEdit.position_title || "");
        setEmail(contactToEdit.email || "");
        setPhone(contactToEdit.phone || "");
        setCommercialOwnerId(contactToEdit.commercial_owner_id || "");
      } else {
        setFullName("");
        setPositionTitle("");
        setEmail("");
        setPhone("");
        setCommercialOwnerId("");
      }
    }
  }, [isOpen, contactToEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !companyId) return;

    setSaving(true);
    try {
      if (contactToEdit) {
        await apiFetch(`/api/contacts/${contactToEdit.id}`, {
          method: "PUT",
          body: JSON.stringify({
            full_name: fullName.trim(),
            company_id: companyId,
            position_title: positionTitle.trim() || null,
            email: email.trim() || null,
            phone: phone.trim() || null,
            commercial_owner_id: commercialOwnerId || null,
          }),
        });
      } else {
        await apiFetch("/api/contacts", {
          method: "POST",
          body: JSON.stringify({
            full_name: fullName.trim(),
            company_id: companyId,
            position_title: positionTitle.trim() || null,
            email: email.trim() || null,
            phone: phone.trim() || null,
            commercial_owner_id: commercialOwnerId || null,
          }),
        });
      }

      onSaved();
      onClose();
    } catch (err: any) {
      alert("Error al guardar contacto: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {contactToEdit ? "Editar Contacto" : "Crear Nuevo Contacto"}
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Nombre Completo *
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ej: Laura Camila Restrepo"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Empresa Vinculada *
              </label>
              <select
                required
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
              >
                <option value="">Seleccionar empresa...</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Cargo / Rol
              </label>
              <input
                type="text"
                value={positionTitle}
                onChange={(e) => setPositionTitle(e.target.value)}
                placeholder="Directora Financiera, Líder TI..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Correo Electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="laura@empresa.com"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Teléfono / WhatsApp
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="310 987 6543"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Asesor Comercial Encargado
            </label>
            <select
              value={commercialOwnerId}
              onChange={(e) => setCommercialOwnerId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
            >
              <option value="">Sin asesor asignado...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </select>
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
              disabled={saving || !fullName.trim() || !companyId}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-brand-900 hover:bg-brand-800 text-white rounded-md text-xs font-semibold shadow-sm disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{saving ? "Guardando..." : "Guardar Contacto"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
