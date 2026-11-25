import type { RowDataPacket } from "mysql2";
import { cloudinaryPhotos } from "@/lib/admin-results.server";

type Flag = RowDataPacket & {
  submission_id: number; photo_position: number; code: string; match_kind: "EXACT" | "NEAR";
  photo_urls: string; matched_submission_id: number | null; matched_urls: string | null;
};

async function getFlags() {
  const { db } = await import("@/lib/db");
  // List outstanding duplicate-photo flags without selecting submitter details.
  const [rows] = await db.execute<Flag[]>(
    "SELECT h.submission_id, h.photo_position, pu.code, h.match_kind, s.photo_urls, "
    + "h.matched_submission_id, prior.photo_urls AS matched_urls FROM submission_photo_hashes h "
    + "JOIN submissions s ON s.id = h.submission_id JOIN polling_units pu ON pu.id = h.polling_unit_id "
    + "LEFT JOIN submissions prior ON prior.id = h.matched_submission_id "
    + "WHERE h.match_kind IS NOT NULL AND s.status = 'FLAGGED' ORDER BY h.submission_id DESC, h.photo_position LIMIT 50",
  );
  return rows;
}

export default async function PhotoReview() {
  const flags = await getFlags().catch(() => null);
  return (
    <section className="mt-6 border border-line bg-white p-4 md:p-6">
      <h2 className="text-xl font-bold text-brand">Photo flags for review</h2>
      {!flags && <p role="alert" className="mt-3 text-sm text-muted">Could not load flagged photos. Try again.</p>}
      {flags?.length === 0 && <p className="mt-3 text-sm text-muted">No duplicate photos flagged.</p>}
      {flags?.length === 50 && <p className="mt-3 text-sm text-muted">Showing the 50 most recent photo flags.</p>}
      {flags?.length ? (
        <ul className="mt-3 divide-y divide-line">
          {flags.map((flag) => {
            const photo = cloudinaryPhotos(flag.photo_urls)[flag.photo_position];
            const matchedPhotos = cloudinaryPhotos(flag.matched_urls);
            return (
              <li key={flag.submission_id + ":" + flag.photo_position} className="py-3 text-sm">
                <p className="font-bold text-ink">
                  {flag.code} / Submission {flag.submission_id} / {flag.match_kind === "EXACT" ? "Exact duplicate" : "Possible duplicate"}
                </p>
                {photo && <a href={photo} className="mr-4 mt-2 inline-block font-bold text-brand underline">Flagged photo {flag.photo_position + 1}</a>}
                {matchedPhotos.map((url, index) => url && (
                  <a key={index} href={url} className="mr-4 mt-2 inline-block text-brand underline">Matched submission photo {index + 1}</a>
                ))}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
