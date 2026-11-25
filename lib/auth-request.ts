import "server-only";

import { NextResponse, type NextRequest } from "next/server";

export function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  if (origin === (process.env.AUTH_ORIGIN || request.nextUrl.origin)) return true;

  // Validate the configured tunnel origin before considering any proxy headers.
  const configured = process.env.AUTH_FORWARDED_ORIGIN?.trim();
  if (!configured) return false;
  try {
    const forwarded = new URL(configured);
    if (forwarded.protocol !== "https:" || forwarded.hostname.includes("*")
      || (configured !== forwarded.origin && configured !== forwarded.origin + "/")) return false;
    if (origin === forwarded.origin) return true;

    // VS Code dev tunnels can rewrite a same-origin HTTPS request to the local HTTP Origin.
    const { host, hostname } = request.nextUrl;
    return process.env.NODE_ENV === "development"
      && (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]")
      && request.headers.get("host") === host
      && origin === "http://" + host
      && request.headers.get("x-forwarded-host") === forwarded.host
      && request.headers.get("x-forwarded-proto") === "https"
      && request.headers.get("sec-fetch-site") === "same-origin";
  } catch {
    return false;
  }
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
