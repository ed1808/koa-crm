import React, { useState, useEffect } from "react";
import { Activity, Play, RefreshCw, CheckCircle2, Clock, AlertOctagon } from "lucide-react";
import { apiFetch } from "../services/api";

export const ErpEventsPage: React.FC = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [simMessage, setSimMessage] = useState<string | null>(null);

  const loadEvents = () => {
    setLoading(true);
    apiFetch<{ data: any[] }>("/api/erp/events")
      .then((res) => setEvents(res.data || []))
      .catch((err) => console.error("Error fetching ERP events:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadEvents();
    const interval = setInterval(loadEvents, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSimulateInboundCustomer = async () => {
    setSimulating(true);
    try {
      const randomNit = `901.${Math.floor(100 + Math.random() * 900)}.${Math.floor(100 + Math.random() * 900)}-${Math.floor(1 + Math.random() * 9)}`;
      const randomName = `DISTRIBUCIONES ANDINAS LOTE ${Math.floor(10 + Math.random() * 90)} SAS`;
      
      const res = await apiFetch<{ success: boolean; message: string }>("/api/erp/simulate-inbound", {
        method: "POST",
        body: JSON.stringify({
          event_type: "erp.customer.upserted",
          payload: {
            name: randomName,
            tax_id: randomNit,
            external_erp_id: `ERP-${Date.now().toString().slice(-6)}`,
            industry: "Logística y Suministros",
          },
        }),
      });

      setSimMessage(res.message);
      loadEvents();
    } catch (err: any) {
      alert("Error en simulación: " + err.message);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden bg-white dark:bg-slate-950 p-6 space-y-4">
      
      {/* Top Banner & Simulation Controls */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-brand-900 dark:text-brand-400" />
            Consola de Eventos RabbitMQ & Transactional Outbox (ERP)
          </h2>
          <p className="text-xs text-slate-500">
            Monitoreo en tiempo real de eventos asíncronos y sincronización bidireccional con el ERP empresarial.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadEvents}
            className="p-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            title="Refrescar eventos"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleSimulateInboundCustomer}
            disabled={simulating}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-800 hover:to-emerald-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-all active:scale-95 disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Simular Evento ERP Entrante (Nuevo Cliente)</span>
          </button>
        </div>
      </div>

      {simMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between">
          <span>✅ {simMessage}</span>
          <button onClick={() => setSimMessage(null)} className="text-xs font-bold">×</button>
        </div>
      )}

      {/* Events Log Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 text-slate-500 font-medium">
              <th className="py-2.5 px-4">Estado Outbox</th>
              <th className="py-2.5 px-4">Routing Key (RabbitMQ)</th>
              <th className="py-2.5 px-4">Agregado</th>
              <th className="py-2.5 px-4">Payload del Evento</th>
              <th className="py-2.5 px-4">Fecha Evento</th>
              <th className="py-2.5 px-4">Publicado a las</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono text-[11px]">
            {events.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                <td className="py-3 px-4">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-sans font-bold ${
                      e.status === "PUBLISHED"
                        ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
                        : e.status === "PENDING"
                        ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300"
                        : "bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300"
                    }`}
                  >
                    {e.status === "PUBLISHED" ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    {e.status}
                  </span>
                </td>
                <td className="py-3 px-4 font-bold text-brand-900 dark:text-brand-300">
                  {e.routing_key}
                </td>
                <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                  {e.aggregate_type}
                </td>
                <td className="py-3 px-4 max-w-md truncate text-slate-700 dark:text-slate-300">
                  {JSON.stringify(e.payload)}
                </td>
                <td className="py-3 px-4 text-slate-500 font-sans">
                  {new Date(e.created_at).toLocaleTimeString()}
                </td>
                <td className="py-3 px-4 text-slate-500 font-sans">
                  {e.published_at ? new Date(e.published_at).toLocaleTimeString() : "--"}
                </td>
              </tr>
            ))}
            {events.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="text-center py-10 text-slate-400 text-xs font-sans">
                  No hay eventos registrados en la cola outbox.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};
