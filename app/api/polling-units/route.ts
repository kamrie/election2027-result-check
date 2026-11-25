import type { RowDataPacket } from "mysql2";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const params = [...request.nextUrl.searchParams];
  const [query] = params;
  const term = query?.[1].trim() ?? "";
  if (params.length !== 1 || query[0] !== "q" || term.length < 2 || term.length > 100) {
    return Response.json({ error: "Provide one search term between 2 and 100 characters." }, { status: 400 });
  }

  const code = term.replaceAll("/", "-");
  const isCodeSearch = /^[0-9/-]+$/.test(term);
  const exactCode = /^\d{2}-\d{2}-\d{2}-\d{3}$/.test(code);
  const literalTerm = term.replace(/[!%_]/g, (character) => "!" + character);

  try {
    const { db } = await import("@/lib/db");
    // Search by exact code, code prefix, or literal text within a polling-unit name.
    const [rows] = exactCode
      ? await db.execute<RowDataPacket[]>("SELECT id, name, code FROM polling_units WHERE code = ?", [code])
      : isCodeSearch
        ? await db.execute<RowDataPacket[]>(
          "SELECT id, name, code FROM polling_units WHERE code LIKE ? ORDER BY code LIMIT 50",
          [code + "%"],
        )
        : await db.execute<RowDataPacket[]>(
          "SELECT id, name, code FROM polling_units WHERE name LIKE ? ESCAPE '!' ORDER BY name, code LIMIT 50",
          ["%" + literalTerm + "%"],
        );

    return Response.json(rows);
  } catch (error) {
    console.error("Polling-unit search failed.", error);
    return Response.json({ error: "Could not search polling units. Try again." }, { status: 503 });
  }
}
