// Client API helper with automatic fallback: relative path in production or port 3001 in dev
const API_URL = import.meta.env.VITE_API_URL !== undefined
  ? import.meta.env.VITE_API_URL
  : (import.meta.env.PROD
      ? ""
      : (typeof window !== "undefined" ? `${window.location.protocol}//${window.location.hostname}:3001` : "http://127.0.0.1:3001"));

export interface CurrentUser {
  id: string;
  full_name: string;
  email: string;
  role: "ADMIN" | "COMERCIAL" | "SOPORTE" | "EMPLEADO_INTERNO" | "CLIENTE" | "PROVEEDOR";
  department?: string;
  linked_company_id?: string;
}

let activeUser: CurrentUser | null = null;
let authToken: string | null = null;

// Initialize from localStorage if exists
if (typeof window !== "undefined") {
  try {
    const savedUser = localStorage.getItem("koa_user");
    const savedToken = localStorage.getItem("koa_token");
    if (savedUser && savedToken) {
      activeUser = JSON.parse(savedUser);
      authToken = savedToken;
    }
  } catch (e) {
    // Ignore parse errors
  }
}

export function setActiveUser(user: CurrentUser | null, token?: string) {
  activeUser = user;
  if (user && token) {
    authToken = token;
    localStorage.setItem("koa_user", JSON.stringify(user));
    localStorage.setItem("koa_token", token);
  } else if (!user) {
    authToken = null;
    localStorage.removeItem("koa_user");
    localStorage.removeItem("koa_token");
  }
}

export function getActiveUser(): CurrentUser | null {
  return activeUser;
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");

  if (activeUser) {
    headers.set("x-user-id", activeUser.id);
    headers.set("x-user-role", activeUser.role);
    headers.set("x-user-email", activeUser.email);
    headers.set("x-user-name", encodeURIComponent(activeUser.full_name));
    if (activeUser.linked_company_id) {
      headers.set("x-linked-company-id", activeUser.linked_company_id);
    }
  }

  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error ${response.status}`);
  }

  return response.json();
}
