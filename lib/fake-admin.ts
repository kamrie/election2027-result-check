import type { Party } from "@/lib/parties";
import { fakeLocations } from "@/lib/fake-locations";

export type SubmissionStatus = "PENDING" | "FLAGGED" | "REMOVED";

export type AdminSubmission = {
  id: number;
  volunteer: string;
  unitCode: string;
  unitName: string;
  submittedTime: string;
  status: SubmissionStatus;
  sheetDoesNotAdd: boolean;
  conflicting: boolean;
  reported: boolean;
  scores: Record<number, number>;
  accredited: number;
  valid: number;
  rejected: number;
};

export type ConfirmedUnit = {
  code: string;
  name: string;
  ward: string;
  lga: string;
  state: string;
  confirmed: boolean;
  scores: Record<number, number>;
  accredited: number;
  valid: number;
  rejected: number;
};

// TODO: Replace this sample data with database queries.

const locatedUnits = fakeLocations.flatMap((state) =>
  state.lgas.flatMap((lga) =>
    lga.wards.flatMap((ward) =>
      ward.units.map((unit) => ({
        code: unit.code,
        name: unit.name,
        ward: ward.name,
        lga: lga.name,
        state: state.name,
      }))
    )
  )
);

function makeScores(parties: Party[], seed: number): Record<number, number> {
  return Object.fromEntries(
    parties.map((party, index) => [party.id, 15 + ((seed + index * 7) % 38)])
  );
}

export function makeFakeConfirmedUnits(parties: Party[]): ConfirmedUnit[] {
  return locatedUnits.map((unit, index) => {
    const scores = unit.code === "15-01-01-001"
      ? Object.fromEntries(parties.map((party) => [party.id, 33]))
      : makeScores(parties, index + 1);
    const valid = Object.values(scores).reduce((sum, score) => sum + score, 0);
    const rejected = unit.code === "15-01-01-001" ? 3 : 12 + (index % 4);
    const accredited = unit.code === "15-01-01-001" ? valid + rejected : valid + rejected + 8;

    return {
      code: unit.code,
      name: unit.name,
      ward: unit.ward,
      lga: unit.lga,
      state: unit.state,
      confirmed: true,
      scores,
      accredited,
      valid,
      rejected,
    };
  });
}

export function makeFakeSubmissions(parties: Party[]): AdminSubmission[] {
  return Array.from({ length: 12 }, (_, index) => {
    const unit = locatedUnits[index % locatedUnits.length];
    const scores = makeScores(parties, index + 1);
    const partyTotal = Object.values(scores).reduce((sum, score) => sum + score, 0);
    const valid = index === 2 ? Math.max(0, partyTotal - 10) : partyTotal;
    const status: SubmissionStatus = index % 7 === 4 ? "REMOVED" : index % 4 === 1 ? "FLAGGED" : "PENDING";

    return {
      id: index + 1,
      volunteer: `Volunteer ${index + 1}`,
      unitCode: unit.code,
      unitName: unit.name,
      submittedTime: `25 Jan, ${String(3 + (index % 8)).padStart(2, "0")}:${index % 2 === 0 ? "12" : "48"} pm`,
      status,
      sheetDoesNotAdd: index === 2,
      conflicting: index % 6 === 3,
      reported: index % 7 === 4 || index % 8 === 5,
      scores,
      accredited: valid + 12,
      valid,
      rejected: 12,
    };
  });
}
