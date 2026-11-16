import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "koa_crm_production_super_secret_jwt_key_2026";

export interface TokenPayload {
  id: string;
  role: string;
  email: string;
  iat: number;
  exp: number;
}

export function signToken(user: { id: string; role: string; email: string }): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = {
    id: user.id,
    role: user.role,
    email: user.email,
    iat: now,
    exp: now + 7 * 24 * 60 * 60, // 7 días de vigencia
  };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${payloadStr}`).digest("base64url");
  return `${header}.${payloadStr}.${signature}`;
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, payloadStr, signature] = parts;
    const expectedSig = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${payloadStr}`).digest("base64url");
    
    // Comparación segura en tiempo constante para mitigar timing attacks
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(payloadStr, "base64url").toString("utf-8")) as TokenPayload;
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Token expirado
    }
    return payload;
  } catch {
    return null;
  }
}
