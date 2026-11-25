import "server-only";

import { connection } from "next/server";
import type { RowDataPacket } from "mysql2";
import { fallbackParties, type Party } from "@/lib/parties";

export const partiesLoadError = "Could not load parties. Try again.";

export function isPartyFallback(parties: Party[]): boolean {
  return parties === fallbackParties;
}

export async function getActiveParties(allowFallback = true): Promise<Party[]> {
  await connection();

  try {
    const { db } = await import("@/lib/db");

    // Load active parties in abbreviation order.
    const [parties] = await db.query<(Party & RowDataPacket)[]>(
      "SELECT id, name, abbreviation FROM parties WHERE active = 1 ORDER BY abbreviation"
    );
    return parties.map(({ id, name, abbreviation }) => ({ id, name, abbreviation }));
  } catch (error) {
    if (allowFallback && process.env.NODE_ENV === "development") {
      console.warn("Could not query active parties. Using the development fallback.", error);
      return fallbackParties;
    }

    console.error("Could not query active parties.", error);
    throw new Error(partiesLoadError);
  }
}
