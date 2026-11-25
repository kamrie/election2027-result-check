import type { RowDataPacket } from "mysql2";
import type { NextRequest } from "next/server";

const parentQueries = {
  // List the LGAs that belong to the selected state.
  stateId: "SELECT id, name FROM lgas WHERE state_id = ? ORDER BY name, id",
  // List the wards that belong to the selected LGA.
  lgaId: "SELECT id, name FROM wards WHERE lga_id = ? ORDER BY name, id",
  // List the polling units that belong to the selected ward.
  wardId: "SELECT id, name, code FROM polling_units WHERE ward_id = ? ORDER BY name, code",
};

export async function GET(request: NextRequest) {
  const params = [...request.nextUrl.searchParams];
  const [parent] = params;
  // List all states when no parent is supplied.
  let sql = "SELECT id, name FROM states ORDER BY name, id";
  const bindings: number[] = [];

  if (parent) {
    const [key, value] = parent;
    const parentId = Number(value);
    if (params.length !== 1 || !Object.hasOwn(parentQueries, key)
      || !/^[1-9]\d{0,9}$/.test(value) || parentId > 2147483647) {
      return Response.json({ error: "Provide one valid stateId, lgaId or wardId." }, { status: 400 });
    }
    sql = parentQueries[key as keyof typeof parentQueries];
    bindings.push(parentId);
  }

  try {
    const { db } = await import("@/lib/db");
    const [rows] = await db.execute<RowDataPacket[]>(sql, bindings);

    return Response.json(rows);
  } catch (error) {
    console.error("Location lookup failed.", error);
    return Response.json({ error: "Could not load locations. Try again." }, { status: 503 });
  }
}
