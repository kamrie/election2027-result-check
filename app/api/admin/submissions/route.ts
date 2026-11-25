import type { NextRequest } from "next/server";
import { z } from "zod";
import { adminAccess } from "@/lib/admin-access";
import { authBody, authResponse, authUnavailable, sameOrigin } from "@/lib/auth-request";
import { listSubmissions, removeSubmission } from "@/lib/admin-results.server";

const review = z.strictObject({ id: z.number().int().min(1).max(2147483647), reason: z.enum(["FAKE", "DUPLICATE"]) });
const statuses = z.enum(["ALL", "PENDING", "FLAGGED", "REMOVED"]);

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const user = await adminAccess();
  if (user instanceof Response) return user;
  const status = statuses.safeParse(params.get("status") ?? "FLAGGED");
  const before = params.get("before") ?? "2147483648";
  if (!status.success || !/^[1-9]\d{0,9}$/.test(before) || Number(before) > 2147483648) {
    return authResponse({ error: "Invalid submission filter." }, 400);
  }
  try {
    return authResponse(await listSubmissions(status.data, Number(before)));
  } catch {
    return authUnavailable("submission review list");
  }
}

export async function POST(request: NextRequest) {
  const user = await adminAccess();
  if (user instanceof Response) return user;
  if (!sameOrigin(request)) return authResponse({ error: "This request is not allowed." }, 403);
  const parsed = review.safeParse(await authBody(request));
  if (!parsed.success) return authResponse({ error: "Choose a submission and removal reason." }, 400);
  try {
    const result = await removeSubmission(parsed.data.id, user.id, parsed.data.reason);
    if (result === "missing") return authResponse({ error: "Submission not found." }, 404);
    if (result === "already-removed") return authResponse({ error: "This submission is already removed." }, 409);
    return authResponse({ message: "Submission removed from verification. Evidence was retained." });
  } catch {
    return authUnavailable("submission removal");
  }
}
