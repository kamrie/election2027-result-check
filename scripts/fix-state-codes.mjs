import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rename, rm, rmdir } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { parse } from "csv-parse";
import { stringify } from "csv-stringify";

const input = new URL("../data/result_check_polling_units.csv", import.meta.url);
const output = new URL("../data/result_check_polling_units_fixed.csv", import.meta.url);
const columns = ["state_name", "lga_name", "ward_name", "name", "pu_code"];
const expectedRows = 176846;
const codePattern = /^\d{2}-\d{2}-\d{2}-\d{3}$/;

const stateCodes = new Map([
  ["ABIA", "01"], ["ADAMAWA", "02"], ["AKWA IBOM", "03"], ["ANAMBRA", "04"],
  ["BAUCHI", "05"], ["BAYELSA", "06"], ["BENUE", "07"], ["BORNO", "08"],
  ["CROSS RIVER", "09"], ["DELTA", "10"], ["EBONYI", "11"], ["EDO", "12"],
  ["EKITI", "13"], ["ENUGU", "14"], ["FCT", "15"], ["GOMBE", "16"],
  ["IMO", "17"], ["JIGAWA", "18"], ["KADUNA", "19"], ["KANO", "20"],
  ["KATSINA", "21"], ["KEBBI", "22"], ["KOGI", "23"], ["KWARA", "24"],
  ["LAGOS", "25"], ["NASARAWA", "26"], ["NIGER", "27"], ["OGUN", "28"],
  ["ONDO", "29"], ["OSUN", "30"], ["OYO", "31"], ["PLATEAU", "32"],
  ["RIVERS", "33"], ["SOKOTO", "34"], ["TARABA", "35"], ["YOBE", "36"],
  ["ZAMFARA", "37"],
]);

async function fixStateCodes() {
  const tempDir = await mkdtemp(new URL("./.fix-state-codes-", output));
  const tempFile = tempDir + "/polling-units.csv";
  const codes = new Set();
  const oldCodesByState = new Map();
  let rowCount = 0;

  try {
    await pipeline(
      createReadStream(input),
      parse({
        bom: true,
        columns(header) {
          if (header.length !== columns.length || !columns.every((column, index) => column === header[index])) {
            throw new Error("Unexpected CSV header. Expected " + columns.join(", ") + ".");
          }
          return header;
        },
      }),
      async function* fixRows(rows) {
        for await (const row of rows) {
          rowCount++;
          const state = row.state_name;
          const newCode = stateCodes.get(state);
          if (!newCode) {
            throw new Error("Unknown state name " + JSON.stringify(state) + " at data row " + rowCount + ".");
          }
          if (!codePattern.test(row.pu_code)) {
            throw new Error("Invalid pu_code at data row " + rowCount + ". Expected SS-LL-WW-UUU.");
          }

          const fixedCode = newCode + row.pu_code.slice(2);
          if (codes.has(fixedCode)) {
            throw new Error("Duplicate corrected pu_code " + fixedCode + " at data row " + rowCount + ".");
          }
          codes.add(fixedCode);

          if (!oldCodesByState.has(state)) oldCodesByState.set(state, new Set());
          oldCodesByState.get(state).add(row.pu_code.slice(0, 2));
          yield { ...row, pu_code: fixedCode };
        }

        if (rowCount !== expectedRows) {
          throw new Error("Expected " + expectedRows + " data rows, found " + rowCount + ".");
        }
      },
      stringify({ header: true, columns }),
      createWriteStream(tempFile),
    );

    await rename(tempFile, output);
  } finally {
    await rm(tempFile, { force: true });
    await rmdir(tempDir);
  }

  console.table([...stateCodes].filter(([state]) => oldCodesByState.has(state)).map(([state, newCode]) => ({
    "State name": state,
    "Old code": [...oldCodesByState.get(state)].sort().join(", "),
    "New code": newCode,
  })));
  console.log("Verified " + rowCount + " unique polling-unit codes in SS-LL-WW-UUU format.");
  console.log("Wrote data/result_check_polling_units_fixed.csv.");
}

try {
  await fixStateCodes();
} catch (error) {
  console.error("Could not fix state codes: " + error.message);
  process.exitCode = 1;
}
