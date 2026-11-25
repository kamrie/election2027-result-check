import "server-only";

import type { RowDataPacket } from "mysql2";

export type ReviewStatus = "PENDING" | "FLAGGED" | "REMOVED";
type ReviewRow = RowDataPacket & {
  id: number; code: string; name: string; status: ReviewStatus; photos: string;
  accredited: number; valid: number; rejected: number; created: string; photoFlag: number;
  reason: "FAKE" | "DUPLICATE" | null;
};
type ScoreRow = RowDataPacket & { submissionId: number; abbreviation: string; score: number };

export function cloudinaryPhotos(value: string | null): (string | null)[] {
  try {
    const urls: unknown = JSON.parse(value ?? "[]");
    return Array.isArray(urls) ? urls.map((url: unknown) =>
      typeof url === "string" && url.startsWith("https://res.cloudinary.com/") ? url : null
    ) : [];
  } catch {
    return [];
  }
}

export async function listSubmissions(status: ReviewStatus | "ALL", before: number) {
  const { db } = await import("@/lib/db");
  // Read a bounded page of evidence and its removal reason without submitter data.
  const [rows] = await db.execute<ReviewRow[]>(
    "SELECT s.id, p.code, p.name, s.status, s.photo_urls AS photos, s.accredited, s.valid_votes AS valid, s.rejected_votes AS rejected, "
    + "DATE_FORMAT(s.created_at, '%Y-%m-%d %H:%i:%s') AS created, r.reason, "
    + "EXISTS (SELECT 1 FROM submission_photo_hashes h WHERE h.submission_id = s.id AND h.match_kind IS NOT NULL) AS photoFlag "
    + "FROM submissions s JOIN polling_units p ON p.id = s.polling_unit_id LEFT JOIN submission_removals r ON r.submission_id = s.id "
    + "WHERE (? = 'ALL' OR s.status = ?) AND s.id < ? ORDER BY s.id DESC LIMIT 51",
    [status, status, before],
  );
  const visible = rows.slice(0, 50);
  const scores = new Map<number, { abbreviation: string; score: number }[]>();
  if (visible.length) {
    // Read all score rows for the visible submissions together.
    const [partyRows] = await db.execute<ScoreRow[]>(
      "SELECT s.submission_id AS submissionId, p.abbreviation, s.score FROM submission_scores s JOIN parties p ON p.id = s.party_id "
      + "WHERE s.submission_id IN (" + visible.map(() => "?").join(", ") + ") ORDER BY p.abbreviation",
      visible.map(({ id }) => id),
    );
    for (const { submissionId, abbreviation, score } of partyRows) {
      const values = scores.get(submissionId) ?? [];
      values.push({ abbreviation, score });
      scores.set(submissionId, values);
    }
  }
  return { items: visible.map(({ id, code, name, status, photos, accredited, valid, rejected, created, photoFlag, reason }) => ({
    id, code, name, status, photos: cloudinaryPhotos(photos).filter((url) => url !== null), accredited, valid, rejected,
    created, photoFlag: Boolean(photoFlag), reason, scores: scores.get(id) ?? [],
  })), next: rows.length > 50 ? visible.at(-1)!.id : null };
}

export async function removeSubmission(id: number, adminId: number, reason: "FAKE" | "DUPLICATE") {
  const { db } = await import("@/lib/db");
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    // Lock the submission so concurrent review decisions cannot overwrite each other.
    const [[record]] = await connection.execute<(RowDataPacket & { status: ReviewStatus })[]>(
      "SELECT status FROM submissions WHERE id = ? FOR UPDATE", [id],
    );
    if (!record || record.status === "REMOVED") {
      await connection.rollback();
      return record ? "already-removed" : "missing";
    }
    // Keep the evidence and record who removed it and why.
    await connection.execute(
      "INSERT INTO submission_removals (submission_id, reviewed_by, reason, previous_status) VALUES (?, ?, ?, ?)",
      [id, adminId, reason, record.status],
    );
    // Exclude the submission from public verification using the existing status model.
    await connection.execute("UPDATE submissions SET status = 'REMOVED' WHERE id = ?", [id]);
    await connection.commit();
    return "removed";
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}
