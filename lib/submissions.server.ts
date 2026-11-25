import "server-only";

import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { lockPhotoEvidence, recordPhotoEvidence } from "@/lib/photo-evidence.mjs";
import type { PhotoHash } from "@/lib/photo-evidence.mjs";
import type { Submission } from "@/lib/submission-validation";

export type SubmissionUnit = { id: number; name: string; code: string; ward: string; lga: string; state: string };

export async function findSubmissionUnit(code: string): Promise<SubmissionUnit | null> {
  const { db } = await import("@/lib/db");
  // Find the polling unit and the names of its parent locations.
  const [[unit]] = await db.execute<(SubmissionUnit & RowDataPacket)[]>(
    "SELECT pu.id, pu.name, pu.code, w.name AS ward, l.name AS lga, s.name AS state "
    + "FROM polling_units pu JOIN wards w ON w.id = pu.ward_id "
    + "JOIN lgas l ON l.id = w.lga_id JOIN states s ON s.id = l.state_id WHERE pu.code = ?",
    [code],
  );
  return unit ? { id: unit.id, name: unit.name, code: unit.code, ward: unit.ward, lga: unit.lga, state: unit.state } : null;
}

export async function hasSubmitted(userId: number, unitId: number) {
  const { db } = await import("@/lib/db");
  // Check if this account already has a submission for the polling unit.
  const [[existing]] = await db.execute<RowDataPacket[]>(
    "SELECT id FROM submissions WHERE user_id = ? AND polling_unit_id = ?", [userId, unitId],
  );
  return Boolean(existing);
}

export class SubmissionCommitError extends Error {}

export async function saveSubmission(userId: number, unitId: number, data: Submission, urls: string[], hashes: PhotoHash[]) {
  const { db } = await import("@/lib/db");
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await lockPhotoEvidence(connection, unitId);
    // Insert the immutable result. The unique user/unit constraint resolves concurrent submissions.
    const [submission] = await connection.execute<ResultSetHeader>(
      "INSERT INTO submissions (user_id, polling_unit_id, photo_urls, accredited, valid_votes, rejected_votes, status) "
      + "VALUES (?, ?, ?, ?, ?, ?, ?)",
      [userId, unitId, JSON.stringify(urls), data.accredited, data.valid, data.rejected,
        data.sheetDoesNotAddUp ? "FLAGGED" : "PENDING"],
    );

    const placeholders = data.scores.map(() => "(?, ?, ?)").join(", ");
    // Save every active party's score as part of the same transaction.
    await connection.execute(
      "INSERT INTO submission_scores (submission_id, party_id, score) VALUES " + placeholders,
      data.scores.flatMap(({ partyId, score }) => [submission.insertId, partyId, score]),
    );
    const duplicatePhoto = await recordPhotoEvidence(connection, submission.insertId, unitId, hashes);
    try {
      await connection.commit();
    } catch {
      // A lost connection can leave the outcome of COMMIT unknown.
      throw new SubmissionCommitError();
    }
    return { duplicatePhoto };
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}
