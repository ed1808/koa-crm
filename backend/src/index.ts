import { NativeRouter, jsonResponse } from "./shared/infrastructure/Router";
import { testConnection } from "./database/db";
import { runMigrations } from "./database/migrate";
import { runSeed } from "./database/seed";
import { eventBus } from "./shared/infrastructure/EventBus";
import { outboxWorker } from "./shared/infrastructure/OutboxWorker";

// Routers de Módulos
import { registerIamRoutes } from "./modules/iam/routes";
import { registerPipelineRoutes } from "./modules/pipelines/routes";
import { registerCrmRoutes } from "./modules/crm/routes";
import { registerTicketsRoutes } from "./modules/tickets/routes";
import { registerTasksRoutes } from "./modules/tasks/routes";
import { registerAiCopilotRoutes } from "./modules/ai-copilot/routes";
import { registerErpRoutes } from "./modules/erp-integration/routes";
import { registerSettingsRoutes } from "./modules/settings/routes";

const router = new NativeRouter();

// Health Check
router.get("/health", async () => {
  const dbOk = await testConnection();
  return jsonResponse({
    status: dbOk ? "healthy" : "database_unreachable",
    timestamp: new Date().toISOString(),
    version: "1.0.0-mvp",
    engine: "Bun.serve",
  });
});

// Registrar Rutas por Dominio Modular
registerIamRoutes(router);
registerPipelineRoutes(router);
registerCrmRoutes(router);
registerTicketsRoutes(router);
registerTasksRoutes(router);
registerAiCopilotRoutes(router);
registerErpRoutes(router);
registerSettingsRoutes(router);

// Inicializar Servicios Asíncronos
async function bootstrap() {
  console.log("Initializing KOA CRM & Service Desk backend...");

  // 0. Ejecutar migraciones automáticas si AUTO_MIGRATE != "false"
  if (process.env.AUTO_MIGRATE !== "false") {
    let retries = 5;
    while (retries > 0) {
      try {
        await runMigrations();
        break;
      } catch (err: any) {
        retries--;
        console.warn(`[Bootstrap] Migrations attempt failed (${retries} retries left): ${err?.message || err}`);
        if (retries === 0) {
          console.error("[Bootstrap] Warning: Continuing startup without completed migrations...");
        } else {
          await new Promise((r) => setTimeout(r, 2500));
        }
      }
    }
  }

  // Opcional: Cargar semillas iniciales si RUN_SEED == "true"
  if (process.env.RUN_SEED === "true") {
    try {
      console.log("[Bootstrap] RUN_SEED=true detectado. Ejecutando seed inicial...");
      await runSeed();
    } catch (err: any) {
      console.error("[Bootstrap] Error al ejecutar seed inicial:", err?.message || err);
    }
  }

  // 1. Conectar a RabbitMQ si está disponible
  await eventBus.connect();

  // 2. Iniciar Worker de Outbox
  outboxWorker.start(2500);

  // 3. Iniciar Servidor HTTP Nativo con Bun.serve()
  const port = parseInt(process.env.PORT || "3001", 10);
  Bun.serve({
    port,
    fetch(req) {
      return router.handle(req);
    },
  });

  console.log(`KOA CRM Modular Monolith server listening on http://localhost:${port}`);
}

bootstrap().catch((err) => {
  console.error("Bootstrap error:", err);
});
