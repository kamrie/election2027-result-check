import type { NextRequest } from "next/server";
import { sessionCookie, sessionCookieName } from "@/lib/auth";
import { authResponse, sameOrigin } from "@/lib/auth-request";

export function POST(request: NextRequest) {
  if (!sameOrigin(request)) return authResponse({ error: "This request is not allowed." }, 403);

  const response = authResponse({ message: "Logged out." });
  response.cookies.set(sessionCookieName, "", sessionCookie(0));
  return response;
}
