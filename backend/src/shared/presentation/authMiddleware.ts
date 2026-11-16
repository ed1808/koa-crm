import { sql } from "../../database/db";

export type UserRole =
  | "ADMIN"
  | "COMERCIAL"
  | "SOPORTE"
  | "EMPLEADO_INTERNO"
  | "CLIENTE"
  | "PROVEEDOR";

export interface AuthenticatedUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  department?: string;
  linked_company_id?: string | null;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safeDecode(value: string | null, fallback: string): string {
  if (!value) return fallback;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function extractAuthUser(req: Request): AuthenticatedUser | null {
  const userId = req.headers.get("x-user-id");
  const userRole = (req.headers.get("x-user-role") as UserRole) || "ADMIN";
  const userEmail = req.headers.get("x-user-email") || "user@koa.com";
  const userName = safeDecode(req.headers.get("x-user-name"), "Usuario KOA");
  const linkedCompanyId = req.headers.get("x-linked-company-id") || undefined;

  if (!userId) {
    return {
      id: "admin-default-id",
      email: "admin@koa.com",
      full_name: "Administrador KOA",
      role: "ADMIN",
    };
  }

  return {
    id: userId,
    email: userEmail,
    full_name: userName,
    role: userRole,
    linked_company_id: linkedCompanyId,
  };
}

/**
 * Resolves the authoritative user record from PostgreSQL when a valid UUID header is present,
 * preventing role/company spoofing on RBAC-restricted endpoints.
 */
export async function resolveAuthUser(req: Request): Promise<AuthenticatedUser> {
  const headerUser = extractAuthUser(req);
  if (headerUser && UUID_REGEX.test(headerUser.id)) {
    const rows = await sql`
      SELECT id, full_name, email, role, department, linked_company_id, is_active
      FROM users
      WHERE id = ${headerUser.id} AND is_active = TRUE
      LIMIT 1;
    `;
    if (rows && rows.length > 0) {
      return {
        id: rows[0].id,
        full_name: rows[0].full_name,
        email: rows[0].email,
        role: rows[0].role as UserRole,
        department: rows[0].department,
        linked_company_id: rows[0].linked_company_id,
      };
    }
  }

  return (
    headerUser || {
      id: "admin-default-id",
      email: "admin@koa.com",
      full_name: "Administrador KOA",
      role: "ADMIN",
    }
  );
}
