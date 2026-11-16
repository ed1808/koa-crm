import { NativeRouter, jsonResponse, parseBody } from "../../shared/infrastructure/Router";
import { sql } from "../../database/db";
import { resolveAuthUser } from "../../shared/presentation/authMiddleware";
import { getRecoverySettings, IntervalUnit } from "../../shared/application/RecoveryService";

const VALID_UNITS: IntervalUnit[] = ["DAYS", "WEEKS", "MONTHS"];

export function registerSettingsRoutes(router: NativeRouter) {
  // 1. Obtener configuración global del sistema (Solo ADMIN)
  router.get("/api/settings", async (req) => {
    const user = await resolveAuthUser(req);
    if (user.role !== "ADMIN") {
      return jsonResponse({ error: "Solo un administrador puede acceder a la configuración del sistema" }, 403);
    }

    const commercialRecovery = await getRecoverySettings();

    const blockedCompanies = await sql`
      SELECT id, name, tax_id, email, phone, do_not_contact, do_not_contact_at, do_not_contact_reason
      FROM companies
      WHERE do_not_contact = TRUE
      ORDER BY do_not_contact_at DESC NULLS LAST, name ASC;
    `;

    return jsonResponse({
      data: {
        commercial_recovery: commercialRecovery,
        blocked_companies: blockedCompanies,
      },
    });
  });

  // 2. Actualizar configuración de lapso de recuperación (Solo ADMIN)
  router.put("/api/settings", async (req) => {
    const user = await resolveAuthUser(req);
    if (user.role !== "ADMIN") {
      return jsonResponse({ error: "Solo un administrador puede modificar la configuración del sistema" }, 403);
    }

    const body = await parseBody(req);
    const intervalValue = Number(body.interval_value);
    const intervalUnit = String(body.interval_unit || "").toUpperCase() as IntervalUnit;

    if (!Number.isInteger(intervalValue) || intervalValue < 1 || intervalValue > 365) {
      return jsonResponse({ error: "interval_value debe ser un entero entre 1 y 365" }, 400);
    }
    if (!VALID_UNITS.includes(intervalUnit)) {
      return jsonResponse({ error: "interval_unit debe ser DAYS, WEEKS o MONTHS" }, 400);
    }

    const valueJson = JSON.stringify({
      interval_value: intervalValue,
      interval_unit: intervalUnit,
    });

    await sql`
      INSERT INTO system_settings (key, value_json, updated_by, updated_at)
      VALUES ('commercial_recovery', ${valueJson}::jsonb, ${user.id}, CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO UPDATE
      SET value_json = EXCLUDED.value_json,
          updated_by = EXCLUDED.updated_by,
          updated_at = CURRENT_TIMESTAMP;
    `;

    return jsonResponse({
      data: {
        commercial_recovery: {
          interval_value: intervalValue,
          interval_unit: intervalUnit,
        },
      },
    });
  });
}
