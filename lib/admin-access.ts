import "server-only";

import { getAuthenticatedUser } from "@/lib/auth";
import { authResponse, authUnavailable } from "@/lib/auth-request";

export async function adminAccess() {
  const user = await getAuthenticatedUser().catch(() => undefined);
  if (user === undefined) return authUnavailable("admin access");
  if (!user) return authResponse({ error: "Log in to continue." }, 401);
  if (user.role !== "ADMIN") return authResponse({ error: "Administrator access required." }, 403);
  return user;
}
