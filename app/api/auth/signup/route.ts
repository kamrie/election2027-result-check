import type { NextRequest } from "next/server";
import { hash } from "bcryptjs";
import type { RowDataPacket } from "mysql2";
import { signupSchema } from "@/lib/auth-validation";
import { authBody, authResponse, authUnavailable, sameOrigin } from "@/lib/auth-request";
import { authRetryAfter } from "@/lib/auth-rate-limit";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return authResponse({ error: "This request is not allowed." }, 403);
  const parsed = signupSchema.safeParse(await authBody(request));
  if (!parsed.success) return authResponse({ error: parsed.error.issues[0].message }, 400);

  const { name, emailOrPhone, password } = parsed.data;
  const duplicate = { error: "An account already exists for this email or phone number." };
  try {
    const retryAfter = await authRetryAfter("signup", emailOrPhone);
    if (retryAfter) {
      return authResponse({ error: "Too many sign-up attempts. Try again later." }, 429, { "Retry-After": String(retryAfter) });
    }

    const { db } = await import("@/lib/db");
    // Check whether the normalized contact is already registered.
    const [[existing]] = await db.execute<RowDataPacket[]>("SELECT id FROM users WHERE contact = ?", [emailOrPhone]);
    if (existing) return authResponse(duplicate, 409);

    const passwordHash = await hash(password, 12);
    // Create an ordinary user. The unique contact index also handles concurrent sign-ups.
    await db.execute(
      "INSERT INTO users (name, contact, password_hash, role) VALUES (?, ?, ?, ?)",
      [name, emailOrPhone, passwordHash, "USER"],
    );
    return authResponse({ message: "Account created. Log in to continue." }, 201);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ER_DUP_ENTRY") {
      return authResponse(duplicate, 409);
    }
    return authUnavailable("sign-up");
  }
}
