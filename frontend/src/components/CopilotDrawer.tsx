import React, { useState } from "react";
import { X, Send, Sparkles, UserCheck, Briefcase, FileText, CheckCircle2 } from "lucide-react";
import { apiFetch } from "../services/api";

interface CopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTicketId?: string | null;
  activeDealId?: string | null;
  onRefreshData?: () => void;
}

interface Message {
  sender: "user" | "copilot";
  text: string;
  suggested_actions?: Array<{
    label: string;
    action: string;
    payload: any;
  }>;
}

export const CopilotDrawer: React.FC<CopilotDrawerProps> = ({
  isOpen,
  onClose,
  activeTicketId,
  activeDealId,
  onRefreshData,
}) => {
  const buildWelcomeMessage = (ticketId?: string | null, dealId?: string | null): Message => {
    if (dealId) {
      return {
        sender: "copilot",
        text: "¡Hola! Estoy conectado a esta oportunidad comercial. Puedo darte argumentos asertivos y guiones de cierre para concretar el negocio, o ejecutar automáticamente la recuperación o desistimiento si el cliente no desea continuar.",
        suggested_actions: [
          {
            label: "🎯 Estrategia y guion asertivo para cerrar",
            action: "SUGGEST_DEAL_STRATEGY",
            payload: {},
          },
          {
            label: "🗓️ No por ahora (programar recuperación)",
            action: "APPLY_DEAL_OUTCOME",
            payload: {
              outcome: "POSTPONED_RECOVERY",
              reason: "Cliente indica no estar interesado por el momento (vía Copiloto IA).",
            },
          },
          {
            label: "❌ Desiste solo de este negocio",
            action: "APPLY_DEAL_OUTCOME",
            payload: {
              outcome: "LOST_DEFINITIVE",
              reason: "Cliente desiste definitivamente de esta oportunidad (vía Copiloto IA).",
            },
          },
          {
            label: "🚫 No contactar nuevamente",
            action: "APPLY_DEAL_OUTCOME",
            payload: {
              outcome: "DO_NOT_CONTACT",
              reason: "Cliente solicita no volver a ser contactado (vía Copiloto IA).",
            },
          },
        ],
      };
    }

    if (ticketId) {
      return {
        sender: "copilot",
        text: "¡Hola! Soy tu Copiloto de IA en KOA. Puedo ayudarte a resumir el historial de este caso, redactar respuestas o derivar de inmediato una oportunidad comercial al asesor de ventas asignado al cliente.",
        suggested_actions: [
          {
            label: "✨ Derivar oportunidad comercial a ventas",
            action: "DELEGATE_COMMERCIAL",
            payload: {},
          },
          {
            label: "📄 Resumir caso y diagnóstico",
            action: "SUMMARIZE",
            payload: {},
          },
        ],
      };
    }

    return {
      sender: "copilot",
      text: "¡Hola! Soy tu Copiloto de IA en KOA. Abre una oportunidad comercial o un caso de soporte para trabajar con su contexto completo, o consúltame cómo gestionar recuperaciones y seguimientos.",
      suggested_actions: [],
    };
  };

  const [messages, setMessages] = useState<Message[]>([buildWelcomeMessage(activeTicketId, activeDealId)]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setMessages([buildWelcomeMessage(activeTicketId, activeDealId)]);
      setActionSuccess(null);
    }
  }, [isOpen, activeTicketId, activeDealId]);

  if (!isOpen) return null;

  const handleSend = async (textToSend?: string) => {
    const message = textToSend || input;
    if (!message.trim()) return;

    const newMsgs: Message[] = [...messages, { sender: "user", text: message }];
    setMessages(newMsgs);
    if (!textToSend) setInput("");
    setLoading(true);

    try {
      const res = await apiFetch<{ data: any }>("/api/copilot/chat", {
        method: "POST",
        body: JSON.stringify({
          ticket_id: activeTicketId,
          deal_id: activeDealId,
          user_message: message,
        }),
      });

      setMessages([
        ...newMsgs,
        {
          sender: "copilot",
          text: res.data.reply,
          suggested_actions: res.data.suggested_actions,
        },
      ]);
    } catch (e: any) {
      setMessages([
        ...newMsgs,
        {
          sender: "copilot",
          text: `Error al procesar consulta: ${e.message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteAction = async (action: string, payload: any) => {
    if (action === "DELEGATE_COMMERCIAL" || action === "CREATE_COMMERCIAL_TASK") {
      setLoading(true);
      try {
        const res = await apiFetch<{ success: boolean; message: string }>("/api/copilot/execute-action", {
          method: "POST",
          body: JSON.stringify({
            action: "CREATE_COMMERCIAL_TASK",
            ticket_id: activeTicketId,
            payload,
          }),
        });

        setActionSuccess(res.message);
        setMessages((prev) => [
          ...prev,
          {
            sender: "copilot",
            text: `✅ ${res.message}. He registrado la tarea comercial en la bandeja del asesor y anotado el seguimiento interno en este ticket.`,
          },
        ]);

        if (onRefreshData) onRefreshData();
      } catch (err: any) {
        alert("Error al ejecutar acción: " + err.message);
      } finally {
        setLoading(false);
      }
    } else if (action === "CREATE_DEAL_FROM_TICKET") {
      setLoading(true);
      try {
        const res = await apiFetch<{ success: boolean; message: string }>("/api/copilot/execute-action", {
          method: "POST",
          body: JSON.stringify({
            action: "CREATE_DEAL_FROM_TICKET",
            ticket_id: activeTicketId,
            payload,
          }),
        });

        setActionSuccess(res.message);
        setMessages((prev) => [
          ...prev,
          {
            sender: "copilot",
            text: `🎯 Negocio comercial creado en el pipeline de ventas a partir de este ticket.`,
          },
        ]);
        if (onRefreshData) onRefreshData();
      } catch (err: any) {
        alert("Error al crear negocio: " + err.message);
      } finally {
        setLoading(false);
      }
    } else if (action === "SUMMARIZE") {
      handleSend("Por favor resume este ticket y su historial");
    } else if (action === "SUGGEST_DEAL_STRATEGY") {
      handleSend("Ayúdame con argumentos asertivos y un guion para concretar el cierre de este negocio");
    } else if (action === "SUGGEST_CLIENT_REPLY" && payload?.template) {
      try {
        await navigator.clipboard.writeText(payload.template);
        setActionSuccess("Guion copiado al portapapeles.");
      } catch {
        setActionSuccess("Guion generado en la conversación.");
      }
    } else if (action === "APPLY_DEAL_OUTCOME") {
      const outcomeLabels: Record<string, string> = {
        POSTPONED_RECOVERY: "retirar la oportunidad del pipeline y programar la tarea automática de recuperación",
        LOST_DEFINITIVE: "marcar este negocio como desistido definitivamente, cancelando sus tareas pendientes",
        DO_NOT_CONTACT: "bloquear a la empresa/contacto como No Contactar, cancelar todas sus tareas pendientes y retirar sus negocios de los pipelines",
      };
      const label = outcomeLabels[payload?.outcome] || "aplicar este resultado comercial";
      if (!confirm(`¿Confirmas ${label}?`)) return;

      setLoading(true);
      try {
        const res = await apiFetch<{ success: boolean; message: string }>("/api/copilot/execute-action", {
          method: "POST",
          body: JSON.stringify({
            action: "APPLY_DEAL_OUTCOME",
            deal_id: activeDealId,
            payload,
          }),
        });
        setActionSuccess(res.message);
        setMessages((prev) => [
          ...prev,
          {
            sender: "copilot",
            text: `✅ ${res.message}`,
          },
        ]);
        if (onRefreshData) onRefreshData();
      } catch (err: any) {
        alert("Error al ejecutar acción comercial: " + err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-500 flex items-center justify-center text-white shadow-sm">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              KOA Copiloto IA
              <span className="text-[10px] bg-teal-100 dark:bg-slate-800 text-teal-900 dark:text-emerald-300 font-semibold px-2 py-0.5 rounded-full border border-teal-200 dark:border-slate-700">
                Contextual
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {activeTicketId ? "Atendiendo Ticket seleccionado" : activeDealId ? "Analizando Negocio" : "Asistente transversal"}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Quick alert banner if action executed */}
      {actionSuccess && (
        <div className="bg-emerald-50 dark:bg-emerald-950/60 border-b border-emerald-200 dark:border-emerald-800 px-4 py-2 flex items-center gap-2 text-emerald-800 dark:text-emerald-200 text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3.5 py-2.5 text-xs leading-relaxed ${
                m.sender === "user"
                  ? "bg-brand-900 text-white rounded-br-none shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none border border-slate-200/60 dark:border-slate-700/60"
              }`}
            >
              <div className="whitespace-pre-line">{m.text}</div>
            </div>

            {/* Suggested Action Pills / Function Calling buttons */}
            {m.suggested_actions && m.suggested_actions.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5 max-w-[90%]">
                {m.suggested_actions.map((act, i) => (
                  <button
                    key={i}
                    onClick={() => handleExecuteAction(act.action, act.payload)}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-slate-700/60 border border-teal-200 dark:border-slate-700 hover:border-teal-400 text-teal-900 dark:text-slate-100 rounded-md text-[11px] font-medium shadow-2xs transition-all active:scale-95 disabled:opacity-50"
                  >
                    {act.action === "DELEGATE_COMMERCIAL" || act.action === "CREATE_COMMERCIAL_TASK" ? (
                      <UserCheck className="w-3.5 h-3.5 text-teal-600" />
                    ) : act.action === "CREATE_DEAL_FROM_TICKET" ? (
                      <Briefcase className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <span>{act.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-slate-400 italic">
            <Sparkles className="w-3.5 h-3.5 animate-spin text-teal-500" />
            <span>El Copiloto está analizando el caso...</span>
          </div>
        )}
      </div>

      {/* Input Footer */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ej: 'Derivar tarea comercial al asesor'..."
            className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="p-2 rounded-lg bg-brand-900 hover:bg-brand-800 text-white disabled:opacity-40 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
