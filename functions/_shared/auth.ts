type CookieOptions = {
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: "Lax" | "Strict" | "None";
  secure?: boolean;
};

export type AppEnv = {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI?: string;
  SESSION_SECRET: string;
  DB?: D1Database;
  alcohol_log?: D1Database;
};

export type SessionPayload = {
  userId: string;
  exp: number;
};

const REQUIRED_ENV_KEYS = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "SESSION_SECRET",
] as const;

const SESSION_COOKIE = "alcohol_log_session";
const OAUTH_STATE_COOKIE = "alcohol_log_oauth_state";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function base64UrlEncode(value: string) {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return atob(padded);
}

function getCookie(request: Request, name: string) {
  const cookie = request.headers.get("Cookie");
  if (!cookie) {
    return null;
  }

  const match = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function serializeCookie(name: string, value: string, options: CookieOptions = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path ?? "/"}`);
  parts.push(`SameSite=${options.sameSite ?? "Lax"}`);

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`);
  }
  if (options.httpOnly ?? true) {
    parts.push("HttpOnly");
  }
  if (options.secure ?? true) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
}

async function createSignedToken(payload: SessionPayload, secret: string) {
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = await sign(body, secret);
  return `${body}.${signature}`;
}

async function verifySignedToken(token: string, secret: string): Promise<SessionPayload | null> {
  const [body, signature] = token.split(".");
  if (!body || !signature) {
    return null;
  }

  const expected = await sign(body, secret);
  if (signature !== expected) {
    return null;
  }

  let payload: SessionPayload;
  try {
    payload = JSON.parse(base64UrlDecode(body)) as SessionPayload;
  } catch {
    return null;
  }

  if (!payload.userId || payload.exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}

export function getDatabase(env: AppEnv) {
  const database = env.DB ?? env.alcohol_log;
  if (!database) {
    throw new Error("D1 binding is missing. Expected DB or alcohol_log.");
  }
  return database;
}

export function validateAuthEnv(env: AppEnv) {
  const missing = REQUIRED_ENV_KEYS.filter((key) => !env[key]);
  if (missing.length === 0) {
    return null;
  }

  return new Response(
    JSON.stringify({
      error: "missing_auth_environment",
      missing,
      message:
        "Required OAuth secrets are missing from the Cloudflare Pages Functions runtime environment.",
    }),
    {
      status: 500,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    },
  );
}

export function getOAuthState(request: Request) {
  return getCookie(request, OAUTH_STATE_COOKIE);
}

export function getSessionCookie(request: Request) {
  return getCookie(request, SESSION_COOKIE);
}

export function createOAuthStateCookie(state: string) {
  return serializeCookie(OAUTH_STATE_COOKIE, state, {
    maxAge: 60 * 10,
    path: "/api/auth",
  });
}

export function clearOAuthStateCookie() {
  return serializeCookie(OAUTH_STATE_COOKIE, "", {
    maxAge: 0,
    path: "/api/auth",
  });
}

export async function createSessionCookie(userId: string, secret: string) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const token = await createSignedToken({ userId, exp }, secret);
  return serializeCookie(SESSION_COOKIE, token, { maxAge: SESSION_TTL_SECONDS });
}

export function clearSessionCookie() {
  return serializeCookie(SESSION_COOKIE, "", { maxAge: 0 });
}

export async function readSession(request: Request, env: AppEnv) {
  const token = getSessionCookie(request);
  if (!token) {
    return null;
  }

  return verifySignedToken(token, env.SESSION_SECRET);
}

export function redirect(location: string, init?: ResponseInit) {
  return new Response(null, {
    ...init,
    status: init?.status ?? 302,
    headers: {
      ...init?.headers,
      Location: location,
    },
  });
}
