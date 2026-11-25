// Source: data/result_check_polling_units.csv, the supplied Nigerian polling-unit dataset.
// Re-check this dataset against INEC before launch.

import { createReadStream } from "node:fs";
import { parseArgs } from "node:util";
import { pipeline } from "node:stream/promises";
import { parse } from "csv-parse";
import mysql from "mysql2/promise";

const defaultFile = "data/result_check_polling_units.csv";
const columns = ["state_name", "lga_name", "ward_name", "name", "pu_code"];
const batchSize = 1000;
const expected = { states: 37, lgas: 774, wards: 8809, pollingUnits: 176846 };
const countFormat = new Intl.NumberFormat("en");

class ImportError extends Error {}

async function readUnits(file) {
  const report = {
    read: 0, skipped: 0, skippedExamples: [], duplicateRows: 0,
    duplicateCodes: new Set(), states: new Map(),
  };
  let header;

  function skip(line, reason) {
    report.skipped++;
    if (report.skippedExamples.length < 20) {
      report.skippedExamples.push({ line, reason });
    }
  }

  await pipeline(
    createReadStream(file),
    parse({ bom: true, encoding: "utf8", info: true, relax_column_count: true }),
    async (records) => {
      for await (const { record, info } of records) {
        if (!header) {
          header = record.map((field) => field.trim());
          if (header.length !== columns.length || columns.some((name) => !header.includes(name))) {
            throw new ImportError("The CSV header must contain state_name, lga_name, ward_name, name and pu_code.");
          }
          continue;
        }

        report.read++;
        if (record.length !== columns.length) {
          skip(info.lines, "Expected five fields.");
          continue;
        }

        const values = columns.map((column) => record[header.indexOf(column)].trim());
        const missing = columns.filter((_, index) => values[index] === "");
        if (missing.length) {
          skip(info.lines, "Empty field(s): " + missing.join(", ") + ".");
          continue;
        }

        const [stateName, lgaName, wardName, unitName] = values.slice(0, 4)
          .map((name) => name.replace(/\s+/gu, " "));
        const code = values[4];
        if (!/^\d{2}-\d{2}-\d{2}-\d{3}$/.test(code)) {
          skip(info.lines, "Invalid pu_code. Expected SS-LL-WW-UUU.");
          continue;
        }

        const stateCode = code.slice(0, 2);
        const lgaCode = code.slice(0, 5);
        const wardCode = code.slice(0, 8);
        let state = report.states.get(stateCode);
        if (!state) {
          state = { code: stateCode, name: stateName, lgas: new Map(), wards: new Map(), units: new Map() };
          report.states.set(stateCode, state);
        }
        if (state.units.has(code)) {
          report.duplicateRows++;
          report.duplicateCodes.add(code);
          continue;
        }

        if (!state.lgas.has(lgaCode)) state.lgas.set(lgaCode, lgaName);
        if (!state.wards.has(wardCode)) state.wards.set(wardCode, wardName);
        state.units.set(code, unitName);
      }
    },
  );

  if (!header) throw new ImportError("The CSV is empty.");
  return report;
}

function printReport(report) {
  const counts = { states: report.states.size, lgas: 0, wards: 0, pollingUnits: 0 };
  console.log("Rows read: " + countFormat.format(report.read));
  console.log("Rows skipped: " + countFormat.format(report.skipped));
  for (const { line, reason } of report.skippedExamples) {
    console.log("  CSV line " + line + ": " + reason);
  }
  console.log("Duplicate codes: " + countFormat.format(report.duplicateCodes.size)
    + " (" + countFormat.format(report.duplicateRows) + " additional rows; first valid row kept)");

  for (const state of report.states.values()) {
    counts.lgas += state.lgas.size;
    counts.wards += state.wards.size;
    counts.pollingUnits += state.units.size;
  }

  const labels = { states: "States", lgas: "LGAs", wards: "Wards", pollingUnits: "Polling units" };
  for (const [key, actual] of Object.entries(counts)) {
    console.log(labels[key] + ": " + countFormat.format(actual));
    if (actual !== expected[key]) {
      console.warn("Warning: expected " + countFormat.format(expected[key]) + " " + labels[key]
        + ", found " + countFormat.format(actual) + " in the CSV.");
    }
  }

  console.log("Counts per state:");
  for (const state of [...report.states.values()].sort((a, b) => a.code.localeCompare(b.code))) {
    console.log("  " + state.code + " " + state.name + ": " + countFormat.format(state.lgas.size)
      + " LGAs, " + countFormat.format(state.wards.size) + " wards, "
      + countFormat.format(state.units.size) + " polling units");
  }
}

async function upsertBatches(connection, rows, insert, update) {
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);
    const placeholders = "(" + batch[0].map(() => "?").join(", ") + ")";
    const values = batch.map(() => placeholders).join(", ");
    // Insert this batch or update the existing records using the fixed SQL supplied by the caller.
    await connection.execute(insert + values + " ON DUPLICATE KEY UPDATE " + update, batch.flat());
  }
}

async function importState(connection, state) {
  await connection.beginTransaction();
  try {
    // Upsert by state code. A name collision with another code must not modify that row.
    await connection.execute(
      "INSERT INTO states (code, name) VALUES (?, ?) "
        + "ON DUPLICATE KEY UPDATE name = IF(code = VALUES(code), VALUES(name), name)",
      [state.code, state.name],
    );

    // Look up the state ID and detect conflicts on the unique state name.
    const [[storedState]] = await connection.execute("SELECT id, name FROM states WHERE code = ?", [state.code]);
    if (!storedState || storedState.name !== state.name) {
      throw new ImportError("State name conflicts with another state code.");
    }

    // Upsert LGAs for this state.
    await upsertBatches(connection,
      [...state.lgas].map(([code, name]) => [code, storedState.id, name]),
      "INSERT INTO lgas (code, state_id, name) VALUES ",
      "state_id = VALUES(state_id), name = VALUES(name)",
    );

    // Read LGA IDs for the ward inserts.
    const [lgas] = await connection.execute("SELECT id, code FROM lgas WHERE state_id = ?", [storedState.id]);
    const lgaIds = new Map(lgas.map(({ id, code }) => [code, id]));

    // Upsert wards under their LGAs.
    await upsertBatches(connection,
      [...state.wards].map(([code, name]) => [code, lgaIds.get(code.slice(0, 5)), name]),
      "INSERT INTO wards (code, lga_id, name) VALUES ",
      "lga_id = VALUES(lga_id), name = VALUES(name)",
    );

    // Read ward IDs for this state's polling-unit inserts.
    const [wards] = await connection.execute(
      "SELECT wards.id, wards.code FROM wards JOIN lgas ON wards.lga_id = lgas.id WHERE lgas.state_id = ?",
      [storedState.id],
    );
    const wardIds = new Map(wards.map(({ id, code }) => [code, id]));

    // Upsert polling units under their wards.
    await upsertBatches(connection,
      [...state.units].map(([code, name]) => [code, wardIds.get(code.slice(0, 8)), name]),
      "INSERT INTO polling_units (code, ward_id, name) VALUES ",
      "ward_id = VALUES(ward_id), name = VALUES(name)",
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  }
}

function errorCode(error) {
  return typeof error.code === "string" && /^[A-Z][A-Z0-9_]*$/.test(error.code)
    ? " (" + error.code + ")"
    : "";
}

async function importUnits(states) {
  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
  const port = Number(DB_PORT ?? 3306);
  if (!DB_HOST || !DB_USER || !DB_NAME || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ImportError("Check DB_HOST, DB_PORT, DB_USER and DB_NAME in .env.local before importing.");
  }

  const pool = mysql.createPool({
    host: DB_HOST, port, user: DB_USER, password: DB_PASSWORD, database: DB_NAME,
    connectionLimit: 1,
  });
  let connection;
  let committed = 0;
  try {
    try {
      connection = await pool.getConnection();
    } catch (error) {
      throw new ImportError("Could not connect to MySQL" + errorCode(error) + ". Check that MySQL is running and the database settings are correct.");
    }

    for (const state of states.values()) {
      try {
        await importState(connection, state);
        committed++;
      } catch (error) {
        const detail = error.message === "State name conflicts with another state code." ? " " + error.message : "";
        throw new ImportError("Import failed for state " + state.code + errorCode(error) + "." + detail
          + " Previously committed states: " + committed + ". You can rerun the import.");
      }
    }
  } finally {
    connection?.release();
    await pool.end();
  }
  console.log("Import complete. States committed: " + committed + ".");
}

async function main() {
  let options;
  try {
    ({ values: options } = parseArgs({
      options: {
        file: { type: "string", default: defaultFile },
        "dry-run": { type: "boolean", default: false },
      },
    }));
    if (!options.file.trim()) throw new ImportError();
  } catch {
    throw new ImportError("Usage: npm run import:units -- [--file <path>] [--dry-run]");
  }

  let report;
  try {
    report = await readUnits(options.file);
  } catch (error) {
    if (!error.code) throw error;
    const location = Number.isInteger(error.lines) ? " at line " + error.lines : "";
    throw new ImportError("Could not read the polling-unit CSV" + location + errorCode(error) + ".");
  }

  printReport(report);
  if (options["dry-run"]) {
    console.log("Dry run complete. No database connection opened.");
    return;
  }

  await importUnits(report.states);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof ImportError ? error.message : "Polling-unit import failed" + errorCode(error) + ".");
  process.exitCode = 1;
}
