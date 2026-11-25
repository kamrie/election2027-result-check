import "server-only";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify, errors } from "jose";
import type { RowDataPacket } from "mysql2";
import type { AuthUser } from "@/lib/auth-validation";

export const sessionCookieName = "rc_session";
const sessionSeconds = 24 * 60 * 60;
const issuer = "result-check";
const audience = "result-check-web";

export function authSecret() {
  const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? "");
  if (secret.byteLength < 32) throw new Error("AUTH_SECRET must be at least 32 bytes.");
  return secret;
}

export function sessionCookie(maxAge = sessionSeconds) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function signSession(userId: number) {
  const issuedAt = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(String(userId))
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + sessionSeconds)
    .sign(authSecret());
}

export async function getSessionUserId(): Promise<number | null> {
  const token = (await cookies()).get(sessionCookieName)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, authSecret(), {
      algorithms: ["HS256"], issuer, audience, requiredClaims: ["sub", "iat", "exp"],
    });
    const id = Number(payload.sub);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  } catch (error) {
    if (error instanceof errors.JOSEError) return null;
    throw error;
  }
}

export async function getAuthenticatedUser(): Promise<AuthUser | null> {
  const id = await getSessionUserId();
  if (id === null) return null;

  const { db } = await import("@/lib/db");
  // Read the current account and role without selecting credentials or contact information.
  const [[user]] = await db.execute<(AuthUser & RowDataPacket)[]>(
    "SELECT id, name, role FROM users WHERE id = ?", [id],
  );
  return user ? { id: user.id, name: user.name, role: user.role } : null;
}
