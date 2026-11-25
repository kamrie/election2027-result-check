import "server-only";

import { connection } from "next/server";
import type { RowDataPacket } from "mysql2";
import { compareTallies } from "@/lib/irev";
import { getIrevTallies } from "@/lib/irev.server";
import { getActiveParties } from "@/lib/parties.server";
import { getUnitVerifications } from "@/lib/unit-verification.server";

type Unit = RowDataPacket & { id: number; name: string; code: string; state: string; lga: string; stateId: number; lgaId: number };
type Option = RowDataPacket & { id: number; name: string; stateId?: number };
const statusOrder = { mismatch: 0, conflicting: 1, unverified: 2, confirmed: 3, matches: 4 };
const notes = {
  mismatch: "Confirmed tally differs from IReV.",
  conflicting: "Eligible submissions disagree.",
  unverified: "Awaiting an eligible match or review.",
  confirmed: "Confirmed by eligible submissions.",
  matches: "Confirmed tally matches IReV.",
};

export async function getPublicResults() {
  await connection();
  const { db } = await import("@/lib/db");
  // Select only polling units with submissions that have not been removed.
  const [[units], [[{ total }]]] = await Promise.all([
    db.execute<Unit[]>(
      "SELECT p.id, p.name, p.code, s.name AS state, l.name AS lga, s.id AS stateId, l.id AS lgaId "
      + "FROM (SELECT DISTINCT polling_unit_id FROM submissions WHERE status <> 'REMOVED') submitted "
      + "JOIN polling_units p ON p.id = submitted.polling_unit_id JOIN wards w ON w.id = p.ward_id "
      + "JOIN lgas l ON l.id = w.lga_id JOIN states s ON s.id = l.state_id ORDER BY p.id",
    ),
    // Count the complete imported polling-unit directory.
    db.execute<(RowDataPacket & { total: number })[]>("SELECT COUNT(*) AS total FROM polling_units"),
  ]);

  const results = [];
  let parties: Awaited<ReturnType<typeof getActiveParties>> | undefined;
  for (let offset = 0; offset < units.length; offset += 200) {
    const batch = units.slice(offset, offset + 200);
    const verified = await getUnitVerifications(batch.map(({ id }) => id));
    const confirmedIds = batch.filter(({ id }) => verified.get(id)?.status === "confirmed").map(({ id }) => id);
    const irev = await getIrevTallies(confirmedIds);
    if (irev.size && !parties) parties = await getActiveParties(false);
    for (const { id, name, code, state, lga, stateId, lgaId } of batch) {
      const verification = verified.get(id);
      if (!verification || verification.status === "no-results") continue;
      const entered = irev.get(id);
      const status = entered && verification.result && parties
        ? compareTallies(verification.result, entered, parties).status : verification.status;
      results.push({ name, code, state, lga, stateId, lgaId, status, note: notes[status] });
    }
  }
  results.sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || a.name.localeCompare(b.name) || a.code.localeCompare(b.code));
  return {
    units: results,
    total,
    stats: {
      covered: results.length,
      confirmed: results.filter(({ status }) => status === "confirmed" || status === "matches" || status === "mismatch").length,
      matches: results.filter(({ status }) => status === "matches").length,
      mismatches: results.filter(({ status }) => status === "mismatch").length,
    },
  };
}

export async function getDashboardLocations(stateId: number | null) {
  await connection();
  const { db } = await import("@/lib/db");
  // Read the real state list and the LGAs belonging to the requested state.
  const [[states], [lgas]] = await Promise.all([
    db.execute<Option[]>("SELECT id, name FROM states ORDER BY name, id"),
    stateId === null ? Promise.resolve([[] as Option[]]) :
      db.execute<Option[]>("SELECT id, name FROM lgas WHERE state_id = ? ORDER BY name, id", [stateId]),
  ]);
  return { states: states.map(({ id, name }) => ({ id, name })), lgas: lgas.map(({ id, name }) => ({ id, name })) };
}
