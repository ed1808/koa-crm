import React, { useState } from "react";
import { X, Check } from "lucide-react";
import { apiFetch } from "../services/api";

interface CompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyToEdit?: any | null;
  onSaved: () => void;
}

export const CompanyModal: React.FC<CompanyModalProps> = ({
  isOpen,
  onClose,
  companyToEdit,
  onSaved,
}) => {
  const [name, setName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [industry, setIndustry] = useState("");
  const [externalErpId, setExternalErpId] = useState("");
  const [commercialOwnerId, setCommercialOwnerId] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [users, setUsers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      apiFetch<{ data: any[] }>("/api/users?role=COMERCIAL").then((res) => setUsers(res.data || []));

      if (companyToEdit) {
        setName(companyToEdit.name || "");
        setTaxId(companyToEdit.tax_id || "");
        setIndustry(companyToEdit.industry || "");
        setExternalErpId(companyToEdit.external_erp_id || "");
        setCommercialOwnerId(companyToEdit.commercial_owner_id || "");
        setPhone(companyToEdit.phone || "");
        setEmail(companyToEdit.email || "");
      } else {
        setName("");
        setTaxId("");
        setIndustry("");
        setExternalErpId("");
        setCommercialOwnerId("");
        setPhone("");
        setEmail("");
      }
    }
  }, [isOpen, companyToEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      if (companyToEdit) {
        await apiFetch(`/api/companies/${companyToEdit.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: name.trim(),
            tax_id: taxId.trim() || null,
            industry: industry.trim() || null,
            external_erp_id: externalErpId.trim() || null,
            commercial_owner_id: commercialOwnerId || null,
            phone: phone.trim() || null,
            email: email.trim() || null,
          }),
        });
      } else {
        await apiFetch("/api/companies", {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            tax_id: taxId.trim() || null,
            industry: industry.trim() || null,
            external_erp_id: externalErpId.trim() || null,
            commercial_owner_id: commercialOwnerId || null,
            phone: phone.trim() || null,
            email: email.trim() || null,
          }),
        });
      }

      onSaved();
      onClose();
    } catch (err: any) {
      alert("Error al guardar empresa: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {companyToEdit ? "Editar Empresa" : "Crear Nueva Empresa"}
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Razón Social / Nombre Comercial *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: DISTRIBUIDORA DEL VALLE SAS"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                NIT / Identificación Fiscal
              </label>
              <input
                type="text"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                placeholder="900.123.456-7"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Sector / Industria
              </label>
              <input
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="Comercio, Alimentos..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                ID ERP Externo
              </label>
              <input
                type="text"
                value={externalErpId}
                onChange={(e) => setExternalErpId(e.target.value)}
                placeholder="ERP-CLI-909"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Asesor Comercial Asignado
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Teléfono de Contacto
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="300 123 4567"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Correo Electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contacto@empresa.com"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
              />
            </div>
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
              disabled={saving || !name.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-brand-900 hover:bg-brand-800 text-white rounded-md text-xs font-semibold shadow-sm disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{saving ? "Guardando..." : "Guardar Empresa"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
