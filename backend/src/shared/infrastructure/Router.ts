export interface RouteHandler {
  (req: Request, params: Record<string, string>): Promise<Response> | Response;
}

interface RouteEntry {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
}

export class NativeRouter {
  private routes: RouteEntry[] = [];

  private add(method: string, path: string, handler: RouteHandler) {
    const paramNames: string[] = [];
    const regexPath = path.replace(/:([a-zA-Z0-9_]+)/g, (_, paramName) => {
      paramNames.push(paramName);
      return "([^/]+)";
    });
    const pattern = new RegExp(`^${regexPath}$`);
    this.routes.push({ method, pattern, paramNames, handler });
  }

  get(path: string, handler: RouteHandler) {
    this.add("GET", path, handler);
  }

  post(path: string, handler: RouteHandler) {
    this.add("POST", path, handler);
  }

  put(path: string, handler: RouteHandler) {
    this.add("PUT", path, handler);
  }

  delete(path: string, handler: RouteHandler) {
    this.add("DELETE", path, handler);
  }

  patch(path: string, handler: RouteHandler) {
    this.add("PATCH", path, handler);
  }

  async handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const method = req.method;

    // Handle CORS Preflight (allow any headers requested by browser)
    if (method === "OPTIONS") {
      const reqHeaders = req.headers.get("access-control-request-headers") || "*";
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": reqHeaders,
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    for (const route of this.routes) {
      if (route.method === method) {
        const match = pathname.match(route.pattern);
        if (match) {
          const params: Record<string, string> = {};
          route.paramNames.forEach((name, index) => {
            params[name] = decodeURIComponent(match[index + 1]);
          });

          try {
            const response = await route.handler(req, params);
            const headers = new Headers(response.headers);
            headers.set("Access-Control-Allow-Origin", "*");
            return new Response(response.body, {
              status: response.status,
              statusText: response.statusText,
              headers,
            });
          } catch (error: any) {
            console.error(`[Router Error] ${method} ${pathname}:`, error);
            return jsonResponse({ error: error.message || "Internal Server Error" }, 500);
          }
        }
      }
    }

    return jsonResponse({ error: "Endpoint not found" }, 404);
  }
}

export function jsonResponse(data: any, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      ...headers,
    },
  });
}

export async function parseBody<T = any>(req: Request): Promise<T> {
  try {
    return await req.json();
  } catch {
    return {} as T;
  }
}
