import React, { useState, useEffect } from "react";
import { Building2, Users, Mail, Phone, Plus, Edit2, Trash2 } from "lucide-react";
import { apiFetch } from "../services/api";
import { CompanyModal } from "../components/CompanyModal";
import { ContactModal } from "../components/ContactModal";

export const CompaniesContactsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"companies" | "contacts">("companies");
  const [companies, setCompanies] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modales
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [companyToEdit, setCompanyToEdit] = useState<any | null>(null);

  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [contactToEdit, setContactToEdit] = useState<any | null>(null);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      apiFetch<{ data: any[] }>("/api/companies"),
      apiFetch<{ data: any[] }>("/api/contacts"),
    ])
      .then(([compRes, contRes]) => {
        setCompanies(compRes.data || []);
        setContacts(contRes.data || []);
      })
      .catch((err) => console.error("Error fetching companies/contacts:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteCompany = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("¿Deseas eliminar esta empresa y sus registros vinculados?")) return;
    try {
      await apiFetch(`/api/companies/${id}`, { method: "DELETE" });
      loadData();
    } catch (err: any) {
      alert("Error al eliminar: " + err.message);
    }
  };

  const handleDeleteContact = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("¿Deseas eliminar este contacto?")) return;
    try {
      await apiFetch(`/api/contacts/${id}`, { method: "DELETE" });
      loadData();
    } catch (err: any) {
      alert("Error al eliminar contacto: " + err.message);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden bg-white dark:bg-slate-950 p-6 space-y-4">
      {/* Header & Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab("companies")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "companies"
                ? "bg-brand-900 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Empresas ({companies.length})
          </button>
          <button
            onClick={() => setActiveTab("contacts")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "contacts"
                ? "bg-brand-900 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Contactos ({contacts.length})
          </button>
        </div>

        <div>
          {activeTab === "companies" ? (
            <button
              onClick={() => {
                setCompanyToEdit(null);
                setIsCompanyModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-900 hover:bg-brand-800 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Crear Empresa</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setContactToEdit(null);
                setIsContactModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-900 hover:bg-brand-800 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Crear Contacto</span>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "companies" ? (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 text-slate-500 font-medium">
                <th className="py-2.5 px-4">Nombre de la Empresa</th>
                <th className="py-2.5 px-4">NIT / Identificación</th>
                <th className="py-2.5 px-4">ID ERP Externo</th>
                <th className="py-2.5 px-4">Industria</th>
                <th className="py-2.5 px-4">Propietario Comercial</th>
                <th className="py-2.5 px-4 text-center">Negocios Activos</th>
                <th className="py-2.5 px-4 text-center">Tickets</th>
                <th className="py-2.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {companies.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => {
                    setCompanyToEdit(c);
                    setIsCompanyModalOpen(true);
                  }}
                  className="hover:bg-slate-50 dark:hover:bg-slate-900/50 cursor-pointer"
                >
                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                    <div className="flex items-center gap-2">
                      <span>{c.name}</span>
                      {c.do_not_contact && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800">
                          No Contactar
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{c.tax_id || "--"}</td>
                  <td className="py-3 px-4">
                    <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px] font-mono text-brand-900 dark:text-slate-200 border border-transparent dark:border-slate-700">
                      {c.external_erp_id || "Sin sincronizar"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{c.industry || "--"}</td>
                  <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                    {c.commercial_owner_name || "Sin asignar"}
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-emerald-600 dark:text-emerald-400">{c.deals_count}</td>
                  <td className="py-3 px-4 text-center font-bold text-teal-600 dark:text-emerald-400">{c.tickets_count}</td>
                  <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1 text-slate-400">
                      <button
                        onClick={() => {
                          setCompanyToEdit(c);
                          setIsCompanyModalOpen(true);
                        }}
                        className="p-1 hover:text-slate-700 dark:hover:text-slate-200 rounded"
                        title="Editar empresa"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteCompany(c.id, e)}
                        className="p-1 hover:text-red-600 rounded"
                        title="Eliminar empresa"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 text-slate-500 font-medium">
                <th className="py-2.5 px-4">Nombre Completo</th>
                <th className="py-2.5 px-4">Empresa</th>
                <th className="py-2.5 px-4">Cargo / Posición</th>
                <th className="py-2.5 px-4">Correo Electrónico</th>
                <th className="py-2.5 px-4">Teléfono</th>
                <th className="py-2.5 px-4">Asesor Encargado</th>
                <th className="py-2.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {contacts.map((ct) => (
                <tr
                  key={ct.id}
                  onClick={() => {
                    setContactToEdit(ct);
                    setIsContactModalOpen(true);
                  }}
                  className="hover:bg-slate-50 dark:hover:bg-slate-900/50 cursor-pointer"
                >
                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                    {ct.full_name}
                  </td>
                  <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{ct.company_name}</td>
                  <td className="py-3 px-4 text-slate-500">{ct.position_title || "--"}</td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3 text-slate-400" />
                      {ct.email || "--"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-400" />
                      {ct.phone || "--"}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                    {ct.commercial_owner_name || "Sin asignar"}
                  </td>
                  <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1 text-slate-400">
                      <button
                        onClick={() => {
                          setContactToEdit(ct);
                          setIsContactModalOpen(true);
                        }}
                        className="p-1 hover:text-slate-700 dark:hover:text-slate-200 rounded"
                        title="Editar contacto"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteContact(ct.id, e)}
                        className="p-1 hover:text-red-600 rounded"
                        title="Eliminar contacto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modales */}
      <CompanyModal
        isOpen={isCompanyModalOpen}
        onClose={() => setIsCompanyModalOpen(false)}
        companyToEdit={companyToEdit}
        onSaved={loadData}
      />

      <ContactModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        contactToEdit={contactToEdit}
        onSaved={loadData}
      />

    </div>
  );
};
