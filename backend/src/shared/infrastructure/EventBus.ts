import amqplib from "amqplib";
import { sql } from "../../database/db";

export interface IEventBus {
  publish(routingKey: string, payload: Record<string, any>, aggregateType: string, aggregateId: string): Promise<void>;
  subscribe(routingKey: string, handler: (payload: any, routingKey: string) => Promise<void>): Promise<void>;
}

class RabbitMQEventBus implements IEventBus {
  private connection: any = null;
  private channel: any = null;
  private exchange = process.env.RABBITMQ_EXCHANGE || "koa.events";
  private inMemorySubscribers: Map<string, Array<(payload: any, routingKey: string) => Promise<void>>> = new Map();

  async connect(): Promise<void> {
    try {
      const url = process.env.RABBITMQ_URL || "amqp://koa_rabbit:koa_rabbit_2026@127.0.0.1:5673";
      this.connection = await amqplib.connect(url);
      this.channel = await this.connection.createChannel();
      await this.channel.assertExchange(this.exchange, "topic", { durable: true });
      console.log(`[EventBus] Connected to RabbitMQ exchange "${this.exchange}"`);
    } catch (error) {
      console.warn("[EventBus] Warning: Could not connect to RabbitMQ directly. Using in-memory fallback with Outbox:", (error as any).message);
    }
  }

  async publish(routingKey: string, payload: Record<string, any>, aggregateType: string, aggregateId: string): Promise<void> {
    // 1. Guardar siempre en Transactional Outbox
    try {
      await sql`
        INSERT INTO outbox_events (aggregate_type, aggregate_id, routing_key, payload, status)
        VALUES (${aggregateType}, ${aggregateId}, ${routingKey}, ${JSON.stringify(payload)}, 'PENDING');
      `;
    } catch (e) {
      console.error("[EventBus] Failed to persist outbox event:", e);
    }

    // 2. Publicar a RabbitMQ si está conectado
    if (this.channel) {
      try {
        const messageBuffer = Buffer.from(JSON.stringify(payload));
        this.channel.publish(this.exchange, routingKey, messageBuffer, {
          persistent: true,
          headers: { aggregateType, aggregateId },
        });
      } catch (err) {
        console.error("[EventBus] Failed to publish message to RabbitMQ:", err);
      }
    }

    // 3. Notificar a suscriptores en memoria locales
    const handlers = this.inMemorySubscribers.get(routingKey) || [];
    for (const h of handlers) {
      try {
        await h(payload, routingKey);
      } catch (err) {
        console.error(`[EventBus] Handler error for ${routingKey}:`, err);
      }
    }
  }

  async subscribe(routingKey: string, handler: (payload: any, routingKey: string) => Promise<void>): Promise<void> {
    if (!this.inMemorySubscribers.has(routingKey)) {
      this.inMemorySubscribers.set(routingKey, []);
    }
    this.inMemorySubscribers.get(routingKey)!.push(handler);

    if (this.channel) {
      try {
        const q = await this.channel.assertQueue("", { exclusive: true });
        await this.channel.bindQueue(q.queue, this.exchange, routingKey);
        this.channel.consume(q.queue, async (msg: any) => {
          if (msg) {
            try {
              const content = JSON.parse(msg.content.toString());
              await handler(content, msg.fields.routingKey);
              this.channel.ack(msg);
            } catch (e) {
              console.error("[EventBus] Error processing consumed message:", e);
              this.channel.nack(msg, false, false);
            }
          }
        });
      } catch (err) {
        console.error(`[EventBus] Error setting up RabbitMQ queue for ${routingKey}:`, err);
      }
    }
  }
}

export const eventBus = new RabbitMQEventBus();
