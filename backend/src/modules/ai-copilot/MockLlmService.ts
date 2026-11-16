import { CopilotChatRequest, CopilotChatResponse, ILlmService } from "./domain";

export class MockLlmService implements ILlmService {
  async processChat(request: CopilotChatRequest, systemContext: any): Promise<CopilotChatResponse> {
    const msg = request.user_message.toLowerCase();

    // Contexto Comercial (DEAL): asesoría asertiva para concretar cierre y manejo de objeciones / desistimiento
    if (systemContext.mode === "DEAL") {
      const companyName = systemContext.companyName || "el cliente";
      const contactName = systemContext.contactName || "contacto principal";
      const dealTitle = systemContext.dealTitle || "esta oportunidad";
      const stageName = systemContext.stageName || "en gestión";
      const amountFmt = Number(systemContext.amount || 0).toLocaleString("es-CO");
      const lastDate = systemContext.lastActivityDate || "hoy";
      const intervalText = systemContext.recoveryIntervalText || "1 mes";

      if (
        msg.includes("no quiere") ||
        msg.includes("no desea") ||
        msg.includes("desist") ||
        msg.includes("posponer") ||
        msg.includes("por el momento") ||
        msg.includes("no contactar") ||
        msg.includes("rechaz")
      ) {
        return {
          reply:
            `Entendido. Para **${dealTitle}** (${companyName}) en etapa **${stageName}** (última gestión: ${lastDate}), es clave diferenciar el nivel de respuesta del cliente antes de retirar la tarjeta del pipeline:\n\n` +
            `1. **No interesado por el momento:** Se retira del pipeline actual y se programa automáticamente una tarea de recuperación en **${intervalText}** a partir de la última gestión.\n` +
            `2. **Desiste solo de este negocio:** Cancela las tareas pendientes de esta oportunidad y la archiva sin bloquear la empresa para futuras ventas.\n` +
            `3. **No desea ser contactado nuevamente:** Activa el bloqueo "No contactar" en **${companyName}**, cancela todas sus tareas pendientes y retira sus oportunidades activas.\n\n` +
            `¿Qué acción deseas ejecutar?`,
          suggested_actions: [
            {
              label: `🗓️ No por ahora (recuperar en ${intervalText})`,
              action: "APPLY_DEAL_OUTCOME",
              payload: {
                outcome: "POSTPONED_RECOVERY",
                reason: "Cliente indica que no está interesado por el momento (vía Copiloto IA).",
              },
            },
            {
              label: "❌ Desiste solo de este negocio",
              action: "APPLY_DEAL_OUTCOME",
              payload: {
                outcome: "LOST_DEFINITIVE",
                reason: "Cliente desiste definitivamente de esta oportunidad comercial (vía Copiloto IA).",
              },
            },
            {
              label: "🚫 No desea ser contactado nuevamente",
              action: "APPLY_DEAL_OUTCOME",
              payload: {
                outcome: "DO_NOT_CONTACT",
                reason: "Cliente solicita no volver a ser contactado (vía Copiloto IA).",
              },
            },
          ],
        };
      }

      if (
        msg.includes("guion") ||
        msg.includes("mensaje") ||
        msg.includes("asertiv") ||
        msg.includes("cerrar") ||
        msg.includes("objec") ||
        msg.includes("estrateg") ||
        msg.includes("concret")
      ) {
        const script =
          `Hola ${contactName}, espero que estés muy bien.\n\n` +
          `Retomo nuestra conversación sobre **${dealTitle}** para **${companyName}** (inversión estimada COP ${amountFmt}). ` +
          `Entiendo que están evaluando tiempos y prioridades; por eso te propongo validar en 10 minutos los 2 puntos clave que generan retorno inmediato para su equipo y definir si avanzamos esta semana o si prefieres que lo retomemos en una fecha posterior que no interrumpa su operación.\n\n` +
          `¿Te funciona mañana a las 9:30 a.m. o prefieres que te envíe el resumen comparativo?`;

        return {
          reply:
            `**Estrategia Asertiva Recomendada para ${companyName} (${stageName}):**\n` +
            `- **Enfoque:** Validar la objeción real (tiempo, presupuesto o prioridad) sin presionar, dando una salida clara de cierre o pausa.\n` +
            `- **Última gestión registrada:** ${lastDate}\n\n` +
            `**Guion sugerido:**\n${script}`,
          suggested_actions: [
            {
              label: "💬 Copiar guion asertivo de cierre",
              action: "SUGGEST_CLIENT_REPLY",
              payload: { template: script },
            },
            {
              label: `🗓️ Posponer (recuperación en ${intervalText})`,
              action: "APPLY_DEAL_OUTCOME",
              payload: {
                outcome: "POSTPONED_RECOVERY",
                reason: "Cliente solicita retomar contacto más adelante.",
              },
            },
            {
              label: "❌ Desiste de este negocio",
              action: "APPLY_DEAL_OUTCOME",
              payload: {
                outcome: "LOST_DEFINITIVE",
                reason: "Cliente desiste definitivamente de este negocio.",
              },
            },
            {
              label: "🚫 No contactar nuevamente",
              action: "APPLY_DEAL_OUTCOME",
              payload: {
                outcome: "DO_NOT_CONTACT",
                reason: "Cliente indica no querer ser contactado nuevamente.",
              },
            },
          ],
        };
      }

      return {
        reply:
          `**Asesoría Comercial IA — ${dealTitle}**\n` +
          `- **Empresa:** ${companyName} · **Valor:** COP ${amountFmt}\n` +
          `- **Etapa actual:** ${stageName} · **Última gestión:** ${lastDate}\n` +
          `${systemContext.companyDoNotContact ? "- ⚠️ **Alerta:** Empresa marcada como NO CONTACTAR.\n" : ""}\n` +
          `Puedo redactar un guion asertivo para concretar el negocio, manejar objeciones o ejecutar el retiro/recuperación automática si el cliente decide pausar o desistir.`,
        suggested_actions: [
          {
            label: "🎯 Generar estrategia y guion asertivo de cierre",
            action: "SUGGEST_DEAL_STRATEGY",
            payload: {},
          },
          {
            label: `🗓️ No interesado por ahora (recuperar en ${intervalText})`,
            action: "APPLY_DEAL_OUTCOME",
            payload: {
              outcome: "POSTPONED_RECOVERY",
              reason: "Cliente no interesado por el momento.",
            },
          },
          {
            label: "❌ Desiste solo de este negocio",
            action: "APPLY_DEAL_OUTCOME",
            payload: {
              outcome: "LOST_DEFINITIVE",
              reason: "Cliente desiste definitivamente de este negocio.",
            },
          },
          {
            label: "🚫 No desea ser contactado nuevamente",
            action: "APPLY_DEAL_OUTCOME",
            payload: {
              outcome: "DO_NOT_CONTACT",
              reason: "Cliente solicita no volver a ser contactado.",
            },
          },
        ],
      };
    }

    // Detección de intención: Derivar oportunidad comercial a partir de ticket
    if (
      msg.includes("derivar") ||
      msg.includes("oportunidad") ||
      msg.includes("comercial") ||
      msg.includes("tarea comercial") ||
      msg.includes("vender") ||
      msg.includes("cotizar")
    ) {
      const ownerName = systemContext.commercialOwnerName || "Rafael Betancourt";
      const companyName = systemContext.companyName || "Cliente";
      const ticketNum = systemContext.ticketNumber ? `ID ${systemContext.ticketNumber}` : "el ticket";

      return {
        reply: `He analizado la conversación y detectado una oportunidad comercial clara para **${companyName}** a partir de ${ticketNum}. El asesor comercial asignado es **${ownerName}**. Puedo generarle inmediatamente la tarea de seguimiento comercial e incorporar el negocio al pipeline.`,
        suggested_actions: [
          {
            label: `Crear tarea comercial para ${ownerName}`,
            action: "CREATE_COMMERCIAL_TASK",
            payload: {
              title: `Seguimiento comercial generado por IA - ${ticketNum} (${companyName})`,
              assigned_to_id: systemContext.commercialOwnerId,
              priority: "HIGH",
            },
          },
          {
            label: `Crear negocio en Pipeline de Ventas`,
            action: "CREATE_DEAL_FROM_TICKET",
            payload: {
              title: `Oportunidad: Módulos adicionales (${companyName})`,
              amount: 2500000,
            },
          },
        ],
      };
    }

    // Detección de intención: Resumir ticket o historial
    if (msg.includes("resum") || msg.includes("analiz") || msg.includes("caso")) {
      const ticketNum = systemContext.ticketNumber ? `ID ${systemContext.ticketNumber}` : "";
      return {
        reply: `**Resumen Ejecutivo del Caso ${ticketNum}:**\n- **Cliente:** ${systemContext.companyName || "N/A"}\n- **Asunto:** ${systemContext.subject || "Sin asunto"}\n- **Estado:** ${systemContext.stageName || "En atención"}\n- **Diagnóstico:** Se identificó interés en servicios complementarios y soporte operativo. Se recomienda validar cotización con el área comercial.`,
        suggested_actions: [
          {
            label: "Redactar respuesta cordial al cliente",
            action: "SUGGEST_CLIENT_REPLY",
            payload: {
              template: `Estimado(a) ${systemContext.contactName || "cliente"},\n\nHemos registrado su solicitud con prioridad. Nuestro equipo técnico y su asesor comercial están revisando los requerimientos para brindarle una solución integral hoy mismo.\n\nAtentamente,\nEquipo KOA`,
            },
          },
        ],
      };
    }

    // Respuesta general de copiloto
    return {
      reply: `Hola, soy tu copiloto de IA en KOA. Puedo ayudarte a resumir este caso, redactar respuestas al cliente o derivar tareas comerciales al asesor de ventas asignado con un solo clic. ¿Qué deseas hacer?`,
      suggested_actions: [
        {
          label: "Resumir este ticket",
          action: "SUMMARIZE",
          payload: {},
        },
        {
          label: "Derivar oportunidad al asesor comercial",
          action: "DELEGATE_COMMERCIAL",
          payload: {},
        },
      ],
    };
  }
}
