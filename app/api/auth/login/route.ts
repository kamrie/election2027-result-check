import type { NextRequest } from "next/server";
import { compare } from "bcryptjs";
import type { RowDataPacket } from "mysql2";
import { loginSchema, type AuthUser } from "@/lib/auth-validation";
import { authBody, authResponse, authUnavailable, sameOrigin } from "@/lib/auth-request";
import { authRetryAfter } from "@/lib/auth-rate-limit";
import { sessionCookie, sessionCookieName, signSession } from "@/lib/auth";

// A cost-12 bcrypt hash for timing parity when no account exists.
const dummyHash = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxDLgO32WBWbw2l8zCfJZ2pggiK";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return authResponse({ error: "This request is not allowed." }, 403);
  const parsed = loginSchema.safeParse(await authBody(request));
  if (!parsed.success) return authResponse({ error: parsed.error.issues[0].message }, 400);

  const { emailOrPhone, password } = parsed.data;
  try {
    const retryAfter = await authRetryAfter("login", emailOrPhone);
    if (retryAfter) {
      return authResponse({ error: "Too many login attempts. Try again later." }, 429, { "Retry-After": String(retryAfter) });
    }

    const { db } = await import("@/lib/db");
    // Look up the normalized contact and its password hash for verification.
    const [[user]] = await db.execute<(RowDataPacket & AuthUser & { password_hash: string })[]>(
      "SELECT id, name, role, password_hash FROM users WHERE contact = ?", [emailOrPhone],
    );
    const matches = await compare(password, user?.password_hash ?? dummyHash);
    if (!user || !matches) return authResponse({ error: "Incorrect email, phone number or password." }, 401);

    const token = await signSession(user.id);
    const response = authResponse({ user: { id: user.id, name: user.name, role: user.role } });
    response.cookies.set(sessionCookieName, token, sessionCookie());
    return response;
  } catch {
    return authUnavailable("login");
  }
}
