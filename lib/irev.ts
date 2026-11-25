import { z } from "zod";
import type { Party } from "@/lib/parties";
import { maxVoteCount, pollingUnitCode } from "@/lib/submission-validation";

export const voteTotals = [
  ["accredited", "Accredited voters"], ["valid", "Valid votes"], ["rejected", "Rejected votes"],
] as const;

const count = z.number().int().min(0).max(maxVoteCount);
export const irevEntry = z.strictObject({
  unitCode: pollingUnitCode,
  accredited: count,
  valid: count,
  rejected: count,
  scores: z.array(z.strictObject({ partyId: count.positive(), score: count })).min(1).max(100),
  correction: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
}).superRefine((data, ctx) => {
  if (data.scores.reduce((sum, { score }) => sum + score, 0) !== data.valid) {
    ctx.addIssue({ code: "custom", message: "Party scores must add up to valid votes." });
  }
  if (data.valid + data.rejected > data.accredited) {
    ctx.addIssue({ code: "custom", message: "Valid and rejected votes cannot exceed accredited voters." });
  }
});

export type IrevEntry = z.output<typeof irevEntry>;
type Score = { partyId: number; score: number };
export type NamedScore = Score & Pick<Party, "name" | "abbreviation">;
export type Tally = { accredited: number; valid: number; rejected: number; scores: NamedScore[] };
export type IrevResult = Tally & { revision: string };

export function formatDifference(ours: number | null, irev: number | null) {
  if (ours === null || irev === null) return null;
  const diff = ours - irev;
  return diff > 0 ? "+" + diff : String(diff);
}

export function compareTallies(ours: Tally, irev: Tally, active: Party[]) {
  const parties = new Map(active.map(({ id, name, abbreviation }) => [id, { name, abbreviation }]));
  for (const { partyId, name, abbreviation } of [...ours.scores, ...irev.scores]) {
    if (!parties.has(partyId)) parties.set(partyId, { name, abbreviation });
  }
  const ourScores = new Map(ours.scores.map(({ partyId, score }) => [partyId, score]));
  const irevScores = new Map(irev.scores.map(({ partyId, score }) => [partyId, score]));
  const scores = [...parties].map(([key, party]) => ({
    key, label: party.name + " (" + party.abbreviation + ")",
    ours: ourScores.get(key) ?? null, irev: irevScores.get(key) ?? null,
  })).sort((a, b) => parties.get(a.key)!.abbreviation.localeCompare(parties.get(b.key)!.abbreviation));
  const totals = voteTotals.map(([key, label]) => ({ key, label, ours: ours[key], irev: irev[key] }));
  const rows = [...scores, ...totals].map((row) => ({
    ...row, differs: row.ours === null || row.irev === null || row.ours !== row.irev,
    difference: formatDifference(row.ours, row.irev),
  }));
  return { status: rows.some(({ differs }) => differs) ? "mismatch" as const : "matches" as const, rows };
}
