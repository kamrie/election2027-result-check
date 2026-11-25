import "server-only";

import { NextResponse, type NextRequest } from "next/server";

export function sameOrigin(request: NextRequest) {
  return request.headers.get("origin") === (process.env.AUTH_ORIGIN || request.nextUrl.origin);
}

export function authResponse(body: object, status = 200, headers?: HeadersInit) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Cache-Control", "no-store");
  return NextResponse.json(body, { status, headers: responseHeaders });
}

export async function authBody(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return null;
  }
  const reader = request.body?.getReader();
  if (!reader) return null;

  const decoder = new TextDecoder("utf-8", { fatal: true });
  let length = 0;
  let body = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return JSON.parse(body + decoder.decode()) as unknown;
      length += value.byteLength;
      if (length > 8192) {
        await reader.cancel();
        return null;
      }
      body += decoder.decode(value, { stream: true });
    }
  } catch {
    await reader.cancel().catch(() => {});
    return null;
  } finally {
    reader.releaseLock();
  }
}

export function authUnavailable(operation: string) {
  console.error("Authentication unavailable during " + operation + ".");
  return authResponse({ error: "Authentication is temporarily unavailable. Try again." }, 503);
}
