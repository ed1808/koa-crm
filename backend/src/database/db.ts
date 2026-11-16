// Database connection helper using pure Bun.sql (native PostgreSQL)
import { SQL } from "bun";

const connectionString = process.env.DATABASE_URL || "postgres://mia_admin:mia_admin_password@localhost:5432/koa_crm";

export const sql = new SQL(connectionString);

export async function testConnection(): Promise<boolean> {
  try {
    const result = await sql`SELECT 1 as connected`;
    return result[0]?.connected === 1;
  } catch (error) {
    console.error("Database connection failed:", error);
    return false;
  }
}
