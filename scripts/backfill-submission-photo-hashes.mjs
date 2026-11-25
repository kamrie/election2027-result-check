import mysql from "mysql2/promise";
import { hashPhoto, lockPhotoEvidence, recordPhotoEvidence, photoHashThreshold } from "../lib/photo-evidence.mjs";

const maxBytes = 5_000_000;
const cloudName = process.env.CLOUDINARY_URL ? new URL(process.env.CLOUDINARY_URL).hostname : "";

async function downloadPhoto(value) {
  const url = new URL(value);
  if (url.origin !== "https://res.cloudinary.com" || url.username || url.password
    || !cloudName || !url.pathname.startsWith("/" + cloudName + "/image/upload/")) {
    throw new Error("Unexpected Cloudinary URL");
  }
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(20_000) });
  if (!response.ok || !response.body || Number(response.headers.get("content-length")) > maxBytes
    || !["image/jpeg", "image/png"].includes(response.headers.get("content-type"))) {
    await response.body?.cancel();
    throw new Error("Photo download could not be validated");
  }

  const chunks = [];
  let total = 0;
  for await (const chunk of response.body) {
    total += chunk.byteLength;
    if (total > maxBytes) throw new Error("Photo exceeds size limit");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function main() {
  if (!cloudName) throw new Error("Set CLOUDINARY_URL before running the backfill.");
  photoHashThreshold();
  const pool = mysql.createPool({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  });
  let cursor = 0;
  let indexed = 0;
  let flagged = 0;
  let failed = 0;
  try {
    for (;;) {
      // Page through existing submissions with no indexed photos.
      const [rows] = await pool.execute(
        "SELECT id, polling_unit_id, photo_urls FROM submissions s WHERE id > ? "
        + "AND NOT EXISTS (SELECT 1 FROM submission_photo_hashes h WHERE h.submission_id = s.id) ORDER BY id LIMIT 25",
        [cursor],
      );
      if (!rows.length) break;
      for (const row of rows) {
        cursor = row.id;
        try {
          const urls = JSON.parse(row.photo_urls);
          if (!Array.isArray(urls) || !urls.length || urls.length > 6) throw new Error("Invalid photo list");
          const hashes = [];
          for (const url of urls) hashes.push(await hashPhoto(await downloadPhoto(url)));

          const connection = await pool.getConnection();
          try {
            await connection.beginTransaction();
            await lockPhotoEvidence(connection, row.polling_unit_id);
            // Recheck under the same lock used by live submissions.
            const [[existing]] = await connection.execute(
              "SELECT submission_id FROM submission_photo_hashes WHERE submission_id = ? LIMIT 1", [row.id],
            );
            let duplicate = false;
            if (!existing) duplicate = await recordPhotoEvidence(connection, row.id, row.polling_unit_id, hashes);
            await connection.commit();
            if (!existing) indexed++;
            if (duplicate) flagged++;
          } catch (error) {
            await connection.rollback().catch(() => {});
            throw error;
          } finally {
            connection.release();
          }
        } catch {
          failed++;
          console.error("Could not index photos for submission " + row.id + ".");
        }
      }
    }
  } finally {
    await pool.end();
  }
  console.log("Indexed submissions: " + indexed + ". Duplicate matches: " + flagged + ". Failed: " + failed + ".");
  if (failed) process.exitCode = 1;
}

await main().catch(() => {
  console.error("Photo backfill failed. Check the Cloudinary and MySQL settings and apply the migration first.");
  process.exitCode = 1;
});
