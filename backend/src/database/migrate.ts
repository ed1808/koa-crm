import { sql } from "./db";
import { readFileSync } from "fs";
import { join } from "path";

export async function runMigrations() {
  console.log("Running database migrations...");
  const schemaPath = join(import.meta.dir, "schema.sql");
  const schemaSql = readFileSync(schemaPath, "utf-8");

  // Execute base DDL
  await sql.unsafe(schemaSql);

  // Idempotent incremental migrations for existing databases
  await sql.unsafe(`
    ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS is_internal_only BOOLEAN NOT NULL DEFAULT FALSE;

    ALTER TABLE tickets ADD COLUMN IF NOT EXISTS source_deal_id UUID;
    ALTER TABLE tickets ADD COLUMN IF NOT EXISTS is_finalized BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE tickets ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE tickets ADD COLUMN IF NOT EXISTS handoff_target_type VARCHAR(20);
    ALTER TABLE tickets ADD COLUMN IF NOT EXISTS handoff_target_id UUID;

    ALTER TABLE deals ADD COLUMN IF NOT EXISTS is_finalized BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS handoff_target_type VARCHAR(20);
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS handoff_target_id UUID;
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS outcome_status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE';
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS recovery_due_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS outcome_reason TEXT;

    ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_outcome_status_check;
    ALTER TABLE deals ADD CONSTRAINT deals_outcome_status_check CHECK (outcome_status IN ('ACTIVE', 'POSTPONED_RECOVERY', 'LOST_DEFINITIVE', 'DO_NOT_CONTACT'));

    ALTER TABLE companies ADD COLUMN IF NOT EXISTS do_not_contact BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS do_not_contact_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS do_not_contact_reason TEXT;

    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS do_not_contact BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS do_not_contact_at TIMESTAMP WITH TIME ZONE;

    ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_task_type_check;
    ALTER TABLE tasks ADD CONSTRAINT tasks_task_type_check CHECK (task_type IN ('CALL', 'EMAIL', 'MEETING', 'COMMERCIAL_FOLLOWUP', 'COMMERCIAL_RECOVERY', 'INTERNAL_ACTION'));

    INSERT INTO system_settings (key, value_json)
    VALUES ('commercial_recovery', '{"interval_value": 1, "interval_unit": "MONTHS"}'::jsonb)
    ON CONFLICT (key) DO NOTHING;

    ALTER TABLE interactions_comments DROP CONSTRAINT IF EXISTS interactions_comments_target_type_check;
    ALTER TABLE interactions_comments ADD CONSTRAINT interactions_comments_target_type_check CHECK (target_type IN ('DEAL', 'TICKET', 'COMPANY', 'TASK'));

    ALTER TABLE interactions_comments DROP CONSTRAINT IF EXISTS interactions_comments_interaction_type_check;
    ALTER TABLE interactions_comments ADD CONSTRAINT interactions_comments_interaction_type_check CHECK (interaction_type IN ('COMMENT', 'INTERNAL_NOTE', 'CALL_LOG', 'EMAIL_LOG', 'AI_SUMMARY', 'STAGE_HISTORY', 'FLOW_HANDOFF'));
  `);

  console.log("Database migrations applied successfully.");
}

if (import.meta.main) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Migration error:", err);
      process.exit(1);
    });
}
