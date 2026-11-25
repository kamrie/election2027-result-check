import "server-only";

import { createHash } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { Pool } from "mysql2/promise";
import type { IrevEntry, IrevResult, Tally } from "@/lib/irev";

type IrevRow = RowDataPacket & {
  polling_unit_id: number; id: number; entered_by: number; accredited: number; valid_votes: number; rejected_votes: number;
  party_id: number | null; score: number | null; name: string | null; abbreviation: string | null;
};

async function readRows(database: Pick<Pool, "execute">, unitIds: number[]) {
  // Read the result and its party scores in one snapshot, ordered by stable party ID.
  const [rows] = await database.execute<IrevRow[]>(
    "SELECT r.polling_unit_id, r.id, r.entered_by, r.accredited, r.valid_votes, r.rejected_votes, "
    + "s.party_id, s.score, p.name, p.abbreviation FROM irev_results r "
    + "LEFT JOIN irev_scores s ON s.irev_result_id = r.id LEFT JOIN parties p ON p.id = s.party_id "
    + "WHERE r.polling_unit_id IN (" + unitIds.map(() => "?").join(", ") + ") ORDER BY s.party_id",
    unitIds,
  );
  return rows;
}

function toIrev(rows: IrevRow[]) {
  if (!rows.length) return null;
  const { id, entered_by, accredited, valid_votes, rejected_votes } = rows[0];
  const tally: Tally = { accredited, valid: valid_votes, rejected: rejected_votes, scores: [] };
  for (const row of rows) {
    if (row.party_id !== null && row.score !== null && row.name !== null && row.abbreviation !== null) {
      tally.scores.push({ partyId: row.party_id, score: row.score, name: row.name, abbreviation: row.abbreviation });
    }
  }
  const revision = createHash("sha256").update(JSON.stringify([
    id, entered_by, accredited, valid_votes, rejected_votes, tally.scores.map(({ partyId, score }) => [partyId, score]),
  ])).digest("hex");
  return { id, tally, revision };
}

async function readIrev(database: Pick<Pool, "execute">, unitId: number) {
  return toIrev(await readRows(database, [unitId]));
}

export async function getIrevTallies(unitIds: number[]) {
  const results = new Map<number, Tally>();
  if (!unitIds.length) return results;
  const { db } = await import("@/lib/db");
  const groups = new Map<number, IrevRow[]>();
  for (const row of await readRows(db, unitIds)) {
    const group = groups.get(row.polling_unit_id) ?? [];
    group.push(row);
    groups.set(row.polling_unit_id, group);
  }
  for (const [id, rows] of groups) {
    const saved = toIrev(rows);
    if (saved) results.set(id, saved.tally);
  }
  return results;
}

export async function getIrevResult(unitId: number): Promise<IrevResult | null> {
  const { db } = await import("@/lib/db");
  const stored = await readIrev(db, unitId);
  return stored && { ...stored.tally, revision: stored.revision };
}

export class IrevWriteError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function saveIrevResult(unitId: number, adminId: number, entry: IrevEntry) {
  const { db } = await import("@/lib/db");
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    // Serialize writes for a unit, including when no IReV record exists yet.
    await connection.execute("SELECT id FROM polling_units WHERE id = ? FOR UPDATE", [unitId]);
    const stored = await readIrev(connection, unitId);
    if ((stored?.revision ?? null) !== entry.correction) {
      throw new IrevWriteError("The saved IReV entry has changed. Reload the unit before saving.", 409);
    }
    // Validate the submitted roster against the current active parties.
    const [active] = await connection.execute<(RowDataPacket & { id: number })[]>(
      "SELECT id FROM parties WHERE active = 1",
    );
    const ids = new Set(entry.scores.map(({ partyId }) => partyId));
    if (ids.size !== active.length || entry.scores.length !== active.length || active.some(({ id }) => !ids.has(id))) {
      throw new IrevWriteError("Enter one score for each active party. Reload if the party list changed.", 400);
    }

    let id: number;
    if (stored) {
      id = stored.id;
      // Apply an explicit correction and attribute the current record to the correcting admin.
      await connection.execute(
        "UPDATE irev_results SET accredited = ?, valid_votes = ?, rejected_votes = ?, entered_by = ? WHERE id = ?",
        [entry.accredited, entry.valid, entry.rejected, adminId, id],
      );
      // Replace the score set atomically with the corrected totals.
      await connection.execute("DELETE FROM irev_scores WHERE irev_result_id = ?", [id]);
    } else {
      // Create the single IReV record allowed for this polling unit.
      const [result] = await connection.execute<ResultSetHeader>(
        "INSERT INTO irev_results (polling_unit_id, accredited, valid_votes, rejected_votes, entered_by) VALUES (?, ?, ?, ?, ?)",
        [unitId, entry.accredited, entry.valid, entry.rejected, adminId],
      );
      id = result.insertId;
    }

    // Save each party score with the parent result in the same transaction.
    await connection.execute(
      "INSERT INTO irev_scores (irev_result_id, party_id, score) VALUES " + entry.scores.map(() => "(?, ?, ?)").join(", "),
      entry.scores.flatMap(({ partyId, score }) => [id, partyId, score]),
    );
    const saved = await readIrev(connection, unitId);
    if (!saved) throw new Error("Saved IReV result could not be read.");
    await connection.commit();
    return { ...saved.tally, revision: saved.revision };
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}
