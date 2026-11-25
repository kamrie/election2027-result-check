import "server-only";

import type { RowDataPacket } from "mysql2";

type Score = { partyId: number; name: string; abbreviation: string; score: number };
type Evidence = {
  userId: number; accredited: number; valid: number; rejected: number; scores: Score[];
};
type EvidenceRow = RowDataPacket & {
  polling_unit_id: number; id: number; user_id: number; status: "PENDING" | "FLAGGED"; accredited: number;
  valid_votes: number; rejected_votes: number; eligible: number;
  party_id: number | null; name: string | null; abbreviation: string | null; score: number | null;
};

export async function getUnitVerifications(unitIds: number[]) {
  if (!unitIds.length) return new Map<number, ReturnType<typeof verifyRows>>();
  const { db } = await import("@/lib/db");
  // Read current results and scores together. Legacy photos must all be indexed before they can count.
  const [rows] = await db.execute<EvidenceRow[]>(
    "SELECT sub.polling_unit_id, sub.id, sub.user_id, sub.status, sub.accredited, sub.valid_votes, sub.rejected_votes, "
    + "(sub.status = 'PENDING' AND IF(JSON_VALID(sub.photo_urls), JSON_LENGTH(sub.photo_urls), 0) > 0 "
    + "AND IF(JSON_VALID(sub.photo_urls), JSON_LENGTH(sub.photo_urls), 0) = (SELECT COUNT(*) FROM submission_photo_hashes h WHERE h.submission_id = sub.id) "
    + "AND NOT EXISTS (SELECT 1 FROM submission_photo_hashes h WHERE h.submission_id = sub.id AND h.match_kind IS NOT NULL)) AS eligible, "
    + "score.party_id, p.name, p.abbreviation, score.score "
    + "FROM submissions sub LEFT JOIN submission_scores score ON score.submission_id = sub.id "
    + "LEFT JOIN parties p ON p.id = score.party_id "
    + "WHERE sub.polling_unit_id IN (" + unitIds.map(() => "?").join(", ") + ") "
    + "AND sub.status <> 'REMOVED' ORDER BY sub.id, score.party_id",
    unitIds,
  );
  const grouped = new Map<number, EvidenceRow[]>();
  for (const row of rows) {
    const group = grouped.get(row.polling_unit_id) ?? [];
    group.push(row);
    grouped.set(row.polling_unit_id, group);
  }
  return new Map(unitIds.map((id) => [id, verifyRows(grouped.get(id) ?? [])]));
}

export async function getUnitVerification(unitId: number) {
  return (await getUnitVerifications([unitId])).get(unitId) ?? verifyRows([]);
}

function verifyRows(rows: EvidenceRow[]) {
  const results = new Map<number, Evidence>();
  for (const row of rows) {
    if (!row.eligible) continue;
    let result = results.get(row.id);
    if (!result) {
      result = { userId: row.user_id, accredited: row.accredited, valid: row.valid_votes, rejected: row.rejected_votes, scores: [] };
      results.set(row.id, result);
    }
    if (row.party_id !== null && row.name !== null && row.abbreviation !== null && row.score !== null) {
      result.scores.push({ partyId: row.party_id, name: row.name, abbreviation: row.abbreviation, score: row.score });
    }
  }

  const groups = new Map<string, { result: Evidence; users: Set<number> }>();
  for (const result of results.values()) {
    if (!result.scores.length || result.valid + result.rejected > result.accredited
      || result.scores.reduce((sum, score) => sum + score.score, 0) !== result.valid) continue;

    const key = JSON.stringify([result.accredited, result.valid, result.rejected,
      result.scores.map(({ partyId, score }) => [partyId, score])]);
    const group = groups.get(key) ?? { result, users: new Set<number>() };
    group.users.add(result.userId);
    groups.set(key, group);
  }
  const matching = [...groups.values()].filter(({ users }) => users.size >= 2);
  const status = rows.length === 0 ? "no-results"
    : matching.length === 1 ? "confirmed"
      : groups.size > 1 ? "conflicting" : "unverified";
  const tally = matching.length === 1 ? matching[0] : groups.size === 1 ? [...groups.values()][0] : null;
  if (!tally) return { status, result: null } as const;

  const { accredited, valid, rejected, scores } = tally.result;
  return { status, result: { accredited, valid, rejected, count: tally.users.size,
    scores: scores.toSorted((a, b) => a.abbreviation.localeCompare(b.abbreviation)) } } as const;
}
