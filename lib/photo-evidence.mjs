import { createHash } from "node:crypto";
import sharp from "sharp";
import phash from "sharp-phash";

/** @typedef {{ sha256: Buffer, perceptual_hash: string }} PhotoHash */
/** @typedef {import("mysql2/promise").PoolConnection} Connection */
/** @typedef {import("mysql2").RowDataPacket & PhotoHash & { submission_id: number }} StoredHash */

export function photoHashThreshold() {
  const raw = process.env.PHOTO_PHASH_THRESHOLD ?? "6";
  if (!/^(?:[0-9]|1[0-6])$/.test(raw)) {
    throw new Error("PHOTO_PHASH_THRESHOLD must be an integer from 0 to 16.");
  }
  return Number(raw);
}

/** @param {Buffer} bytes @returns {Promise<PhotoHash>} */
export async function hashPhoto(bytes) {
  // Normalize orientation and bound decoded input before passing pixels to sharp-phash.
  const normalized = await sharp(bytes, { limitInputPixels: 16_000_000, failOn: "warning" })
    .rotate().resize(256, 256, { fit: "fill" }).flatten({ background: "#fff" }).png().toBuffer();
  return {
    sha256: createHash("sha256").update(bytes).digest(),
    perceptual_hash: await phash(normalized),
  };
}

/** @param {string} first @param {string} second */
export function photoHashDistance(first, second) {
  let distance = 0;
  for (let i = 0; i < 64; i++) if (first[i] !== second[i]) distance++;
  return distance;
}

/** @param {Connection} connection @param {number} unitId */
export async function lockPhotoEvidence(connection, unitId) {
  // Serialize matching and writes for this unit, including concurrent uploads and backfills.
  await connection.execute("SELECT id FROM polling_units WHERE id = ? FOR UPDATE", [unitId]);
}

/**
 * @param {Connection} connection
 * @param {number} submissionId
 * @param {number} unitId
 * @param {PhotoHash[]} photos
 * @returns {Promise<boolean>}
 */
export async function recordPhotoEvidence(connection, submissionId, unitId, photos) {
  const threshold = photoHashThreshold();
  // Only read evidence from this polling unit, including older flagged submissions.
  const [rows] = /** @type {[StoredHash[], import("mysql2").FieldPacket[]]} */ (await connection.execute(
    "SELECT submission_id, sha256, perceptual_hash FROM submission_photo_hashes "
    + "WHERE polling_unit_id = ? AND submission_id <> ? ORDER BY submission_id, photo_position",
    [unitId, submissionId],
  ));
  let flagged = false;
  /** @type {Array<PhotoHash & { submission_id: number }>} */
  const candidates = [...rows];
  const values = photos.flatMap((hash, index) => {
    const exact = candidates.find((other) => other.sha256.equals(hash.sha256));
    const near = exact ? undefined : candidates.find(
      (other) => photoHashDistance(other.perceptual_hash, hash.perceptual_hash) <= threshold,
    );
    const match = exact ?? near;
    const kind = exact ? "EXACT" : near ? "NEAR" : null;
    flagged ||= Boolean(match);
    candidates.push({ ...hash, submission_id: submissionId });
    return [submissionId, index, unitId, hash.sha256, hash.perceptual_hash, kind, match?.submission_id ?? null];
  });

  // Store per-photo hashes, keeping their positions aligned with photo_urls.
  await connection.execute(
    "INSERT INTO submission_photo_hashes (submission_id, photo_position, polling_unit_id, sha256, perceptual_hash, match_kind, matched_submission_id) VALUES "
    + photos.map(() => "(?, ?, ?, ?, ?, ?, ?)").join(", "),
    values,
  );

  if (flagged) {
    // Leave existing flags and removed submissions intact.
    await connection.execute(
      "UPDATE submissions SET status = ? WHERE id = ? AND status = ?", ["FLAGGED", submissionId, "PENDING"],
    );
  }
  return flagged;
}
