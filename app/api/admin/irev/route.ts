import type { NextRequest } from "next/server";
import { adminAccess } from "@/lib/admin-access";
import { authBody, authResponse, authUnavailable, sameOrigin } from "@/lib/auth-request";
import { irevEntry } from "@/lib/irev";
import { getIrevResult, IrevWriteError, saveIrevResult } from "@/lib/irev.server";
import { pollingUnitCode } from "@/lib/submission-validation";
import { findSubmissionUnit } from "@/lib/submissions.server";
import { getUnitVerification } from "@/lib/unit-verification.server";

export async function GET(request: NextRequest) {
  // Read request data before database work so this route runs at request time.
  const values = request.nextUrl.searchParams.getAll("unit");
  const user = await adminAccess();
  if (user instanceof Response) return user;
  const code = pollingUnitCode.safeParse(values.length === 1 ? values[0] : null);
  if (!code.success) return authResponse({ error: "Enter a valid polling unit code." }, 400);
  try {
    const unit = await findSubmissionUnit(code.data);
    if (!unit) return authResponse({ error: "Polling unit not found." }, 404);
    const [verification, irev] = await Promise.all([getUnitVerification(unit.id), getIrevResult(unit.id)]);
    return authResponse({ unit, status: verification.status, confirmed: verification.status === "confirmed" ? verification.result : null, irev });
  } catch {
    return authUnavailable("IReV lookup");
  }
}

export async function POST(request: NextRequest) {
  const user = await adminAccess();
  if (user instanceof Response) return user;
  if (!sameOrigin(request)) return authResponse({ error: "This request is not allowed." }, 403);
  const parsed = irevEntry.safeParse(await authBody(request));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return authResponse({ error: issue.code === "custom" ? issue.message : "Enter a valid unit code, scores and vote totals." }, 400);
  }
  try {
    const unit = await findSubmissionUnit(parsed.data.unitCode);
    if (!unit) return authResponse({ error: "Polling unit not found." }, 404);
    const saved = await saveIrevResult(unit.id, user.id, parsed.data);
    return authResponse({ irev: saved }, parsed.data.correction ? 200 : 201);
  } catch (error) {
    if (error instanceof IrevWriteError) return authResponse({ error: error.message }, error.status);
    if (error && typeof error === "object" && "code" in error && error.code === "ER_DUP_ENTRY") {
      return authResponse({ error: "An IReV result already exists. Reload the polling unit." }, 409);
    }
    return authUnavailable("IReV save");
  }
}
