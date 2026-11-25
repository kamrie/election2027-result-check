import "server-only";

import { createHmac, randomInt } from "node:crypto";
import type { RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { authSecret } from "@/lib/auth";

const limits = {
  signup: { contact: 5, all: 30 },
  login: { contact: 10, all: 120 },
  submit: { contact: 8, all: 30 },
};
const minute = 60;
const contactWindow = 15 * minute;

export async function authRetryAfter(action: keyof typeof limits, contact: string): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  const globalExpiry = now + minute - now % minute;
  const contactExpiry = now + contactWindow - now % contactWindow;
  const contactKey = createHmac("sha256", authSecret()).update(action + ":" + contact).digest("hex");
  const globalKey = action + ":all";
  const limit = limits[action];
  const { db } = await import("@/lib/db");
  const connection = await db.getConnection();
  let retryAfter = 0;

  try {
    await connection.beginTransaction();
    const allAttempts = await incrementBucket(connection, globalKey, globalExpiry, limit.all);
    if (allAttempts > limit.all) {
      retryAfter = globalExpiry - now;
    } else {
      const contactAttempts = await incrementBucket(connection, contactKey, contactExpiry, limit.contact);
      if (contactAttempts > limit.contact) retryAfter = contactExpiry - now;
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }

  if (randomInt(20) === 0) {
    // Remove expired buckets in small batches.
    await db.execute("DELETE FROM auth_rate_limits WHERE expires_at <= ? LIMIT 1000", [now]).catch(() => {});
  }
  return retryAfter;
}

async function incrementBucket(connection: PoolConnection, key: string, expiry: number, limit: number) {
  // Increment the bucket while holding its row lock until the transaction commits.
  await connection.execute(
    "INSERT INTO auth_rate_limits (bucket_key, expires_at, attempts) VALUES (?, ?, 1) "
    + "ON DUPLICATE KEY UPDATE attempts = LEAST(attempts + 1, ?)",
    [key, expiry, limit + 1],
  );
  // Read the incremented counter in the same transaction.
  const [[row]] = await connection.execute<(RowDataPacket & { attempts: number })[]>(
    "SELECT attempts FROM auth_rate_limits WHERE bucket_key = ? AND expires_at = ?", [key, expiry],
  );
  return row.attempts;
}
