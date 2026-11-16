import { NativeRouter, jsonResponse, parseBody } from "../../shared/infrastructure/Router";
import { sql } from "../../database/db";
import { eventBus } from "../../shared/infrastructure/EventBus";

export function registerErpRoutes(router: NativeRouter) {
  // 1. Monitor de eventos de integración (para inspeccionar RabbitMQ & Outbox desde la UI)
  router.get("/api/erp/events", async (req) => {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);

    const events = await sql`
      SELECT id, aggregate_type, aggregate_id, routing_key, payload, status, retry_count, created_at, published_at
      FROM outbox_events
      ORDER BY created_at DESC
      LIMIT ${limit};
    `;

    return jsonResponse({ data: events });
  });

  // 2. Simulador de evento entrante desde el ERP (ej: nuevo cliente creado en ERP o factura generada)
  router.post("/api/erp/simulate-inbound", async (req) => {
    const body = await parseBody(req);
    const { event_type, payload } = body;

    if (event_type === "erp.customer.upserted") {
      // Simular sincronización de empresa desde ERP
      const companyName = payload.name || "NUEVA EMPRESA ERP SAS";
      const taxId = payload.tax_id || "900.999.888-1";
      const erpId = payload.external_erp_id || `ERP-${Date.now()}`;

      // Asignar primer asesor comercial disponible
      const owner = await sql`SELECT id FROM users WHERE role = 'COMERCIAL' LIMIT 1;`;
      const ownerId = owner[0]?.id || null;

      const res = await sql`
        INSERT INTO companies (name, tax_id, external_erp_id, industry, commercial_owner_id)
        VALUES (${companyName}, ${taxId}, ${erpId}, ${payload.industry || 'General'}, ${ownerId})
        ON CONFLICT (external_erp_id) 
        DO UPDATE SET name = EXCLUDED.name, tax_id = EXCLUDED.tax_id, updated_at = CURRENT_TIMESTAMP
        RETURNING *;
      `;

      await eventBus.publish("erp.customer.synced", { companyId: res[0].id, erpId }, "Company", res[0].id);

      return jsonResponse({
        success: true,
        message: "Evento ERP procesado: Cliente sincronizado en CRM",
        data: res[0],
      });
    }

    return jsonResponse({ error: "Unsupported ERP event type" }, 400);
  });
}
