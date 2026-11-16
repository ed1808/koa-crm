import { sql } from "../../database/db";
import { verifyToken } from "../infrastructure/AuthToken";

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

export class UnauthorizedError extends Error {
  statusCode = 401;
  constructor(message = "Sesión no iniciada o token inválido") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  statusCode = 403;
  constructor(message = "No tienes permisos para realizar esta acción") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Resolves the authenticated user from the Authorization Bearer JWT or x-user-id header.
 * Verifies against PostgreSQL to ensure the user exists and is active.
 * Never defaults to ADMIN or fake profiles.
 */
export async function resolveAuthUser(req: Request): Promise<AuthenticatedUser | null> {
  let targetUserId: string | null = null;

  // 1. Prioridad: Authorization Bearer JWT
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const tokenPayload = verifyToken(token);
    if (tokenPayload && UUID_REGEX.test(tokenPayload.id)) {
      targetUserId = tokenPayload.id;
    }
  }

  // 2. Respaldo secundario: Header x-user-id (validando UUID)
  if (!targetUserId) {
    const rawId = req.headers.get("x-user-id");
    if (rawId && UUID_REGEX.test(rawId)) {
      targetUserId = rawId;
    }
  }

  if (!targetUserId) {
    return null;
  }

  // 3. Consultar y verificar el usuario en PostgreSQL
  try {
    const rows = await sql`
      SELECT id, full_name, email, role, department, linked_company_id, is_active
      FROM users
      WHERE id = ${targetUserId} AND is_active = TRUE
      LIMIT 1;
    `;

    if (rows && rows.length > 0) {
      const u = rows[0];
      return {
        id: u.id,
        full_name: u.full_name,
        email: u.email,
        role: u.role as UserRole,
        department: u.department,
        linked_company_id: u.linked_company_id,
      };
    }
  } catch (error) {
    console.error("[Auth] Database verification error:", error);
  }

  return null;
}

/**
 * Exige autenticación obligatoria. Lanza UnauthorizedError (HTTP 401) si no hay usuario válido.
 */
export async function requireAuthUser(req: Request): Promise<AuthenticatedUser> {
  const user = await resolveAuthUser(req);
  if (!user) {
    throw new UnauthorizedError("Se requiere iniciar sesión para acceder a este recurso");
  }
  return user;
}
