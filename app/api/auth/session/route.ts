import { connection } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { authResponse, authUnavailable } from "@/lib/auth-request";

export async function GET() {
  await connection();
  try {
    const user = await getAuthenticatedUser();
    return user
      ? authResponse({ user })
      : authResponse({ error: "Log in to continue." }, 401);
  } catch {
    return authUnavailable("session lookup");
  }
}
