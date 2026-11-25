import type { NextRequest } from "next/server";
import type { RowDataPacket } from "mysql2";
import { adminAccess } from "@/lib/admin-access";
import { authResponse, authUnavailable } from "@/lib/auth-request";

const fields = ["unitCode", "unitName", "resultId", "status", "removalReason", "accredited", "valid", "rejected", "party", "score"] as const;

// Escape spreadsheet formulas, then quote values for CSV.
function cell(value: unknown) {
  const text = String(value ?? "");
  const safe = /^[\s\uFEFF]*[=+\-@]|^[\t\r\n]/.test(text) ? "'" + text : text;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export async function GET(request: NextRequest) {
  const dataset = request.nextUrl.searchParams.get("dataset");
  const user = await adminAccess();
  if (user instanceof Response) return user;
  if (dataset !== "submissions" && dataset !== "irev") return authResponse({ error: "Choose a valid export." }, 400);
  const { db } = await import("@/lib/db");
  const batchSize = 500;
  let cursor = 0;
  // Export vote data in stable score-ID order, without contact details or image URLs.
  const sql = dataset === "submissions"
    ? "SELECT x.id, p.code AS unitCode, p.name AS unitName, s.id AS resultId, s.status, r.reason AS removalReason, "
      + "s.accredited, s.valid_votes AS valid, s.rejected_votes AS rejected, a.abbreviation AS party, x.score "
      + "FROM submission_scores x JOIN submissions s ON s.id = x.submission_id JOIN polling_units p ON p.id = s.polling_unit_id "
      + "JOIN parties a ON a.id = x.party_id LEFT JOIN submission_removals r ON r.submission_id = s.id "
      + "WHERE x.id > ? ORDER BY x.id LIMIT ?"
    : "SELECT x.id, p.code AS unitCode, p.name AS unitName, r.id AS resultId, NULL AS status, NULL AS removalReason, "
      + "r.accredited, r.valid_votes AS valid, r.rejected_votes AS rejected, a.abbreviation AS party, x.score "
      + "FROM irev_scores x JOIN irev_results r ON r.id = x.irev_result_id JOIN polling_units p ON p.id = r.polling_unit_id "
      + "JOIN parties a ON a.id = x.party_id WHERE x.id > ? ORDER BY x.id LIMIT ?";
  async function next() {
    const [rows] = await db.execute<RowDataPacket[]>(sql, [cursor, batchSize]);
    if (rows.length) cursor = rows.at(-1)!.id;
    return rows;
  }

  try {
    const first = await next();
    const encoder = new TextEncoder();
    const encode = (rows: RowDataPacket[]) => rows.map((row) => fields.map((key) => cell(row[key])).join(",") + "\r\n").join("");
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(fields.join(",") + "\r\n" + encode(first)));
        if (first.length < batchSize) controller.close();
      },
      async pull(controller) {
        const rows = await next();
        if (rows.length) controller.enqueue(encoder.encode(encode(rows)));
        if (rows.length < batchSize) controller.close();
      },
    });
    return new Response(stream, { headers: {
      "Cache-Control": "no-store", "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"tallyvote-" + dataset + ".csv\"",
    } });
  } catch {
    return authUnavailable("CSV export");
  }
}
