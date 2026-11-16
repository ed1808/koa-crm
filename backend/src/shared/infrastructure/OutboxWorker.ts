import { sql } from "../../database/db";

export class OutboxWorker {
  private timer: any = null;
  private isProcessing = false;

  start(intervalMs = 3000) {
    this.timer = setInterval(() => this.processEvents(), intervalMs);
    console.log("[OutboxWorker] Started polling pending events every", intervalMs, "ms");
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  async processEvents() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const pendingEvents = await sql`
        SELECT id, aggregate_type, aggregate_id, routing_key, payload, retry_count
        FROM outbox_events
        WHERE status = 'PENDING' AND retry_count < 5
        ORDER BY created_at ASC
        LIMIT 20;
      `;

      for (const event of pendingEvents) {
        try {
          // Marcar como publicado
          await sql`
            UPDATE outbox_events
            SET status = 'PUBLISHED', published_at = CURRENT_TIMESTAMP
            WHERE id = ${event.id};
          `;
        } catch (err) {
          await sql`
            UPDATE outbox_events
            SET retry_count = retry_count + 1,
                status = CASE WHEN retry_count + 1 >= 5 THEN 'FAILED' ELSE 'PENDING' END
            WHERE id = ${event.id};
          `;
        }
      }
    } catch (e) {
      // Ignorar errores transitorios
    } finally {
      this.isProcessing = false;
    }
  }
}

export const outboxWorker = new OutboxWorker();
