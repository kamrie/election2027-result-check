import type { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { authResponse, authUnavailable, sameOrigin } from "@/lib/auth-request";
import { authRetryAfter } from "@/lib/auth-rate-limit";
import { hashPhoto } from "@/lib/photo-evidence.mjs";
import { getActiveParties } from "@/lib/parties.server";
import { findSubmissionUnit, hasSubmitted, saveSubmission, SubmissionCommitError } from "@/lib/submissions.server";
import { hasPhotoStorage, photoId, removePhotos, storageUnavailable, uploadPhoto, validatePhoto } from "@/lib/submission-photos.server";
import { maxPhotoBytes, maxPhotos, submissionPhotos, submissionSchema } from "@/lib/submission-validation";

const bodyLimit = maxPhotos * maxPhotoBytes + 65_536;
const duplicate = { error: "You have already submitted a result for this polling unit." };

class UploadTooLarge extends Error {}

async function readForm(request: Request, contentType: string) {
  if (!request.body) throw new Error("Missing request body");
  if (Number(request.headers.get("content-length")) > bodyLimit) throw new UploadTooLarge();
  let bytes = 0;
  const stream = request.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      bytes += chunk.byteLength;
      if (bytes > bodyLimit) throw new UploadTooLarge();
      controller.enqueue(chunk);
    },
  }));
  return new Response(stream, { headers: { "Content-Type": contentType } }).formData();
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser().catch(() => undefined);
  if (user === undefined) return authUnavailable("submission access");
  if (!user) return authResponse({ error: "Log in to continue." }, 401);
  if (!sameOrigin(request)) return authResponse({ error: "This request is not allowed." }, 403);

  const contentType = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data\s*;/i.test(contentType)) {
    return authResponse({ error: "Send the result and photos together." }, 415);
  }

  const retryAfter = await authRetryAfter("submit", String(user.id)).catch(() => null);
  if (retryAfter === null) return authUnavailable("submission rate limiting");
  if (retryAfter) {
    return authResponse({ error: "Too many submission attempts. Try again later." }, 429, { "Retry-After": String(retryAfter) });
  }

  let form: FormData;
  try {
    form = await readForm(request, contentType);
  } catch (error) {
    if (error instanceof UploadTooLarge) return authResponse({ error: "The upload is too large." }, 413);
    return authResponse({ error: "Could not read the result and photos." }, 400);
  }

  const [result] = form.getAll("result");
  let payload: unknown;
  if (typeof result === "string" && result.length <= 16_384
    && form.getAll("result").length === 1 && [...form.keys()].every((key) => key === "result" || key === "photos")) {
    try { payload = JSON.parse(result); } catch { /* Handled by validation below. */ }
  }
  const parsed = submissionSchema.safeParse(payload);
  if (!parsed.success) return authResponse({ error: parsed.error.issues[0].message }, 400);
  const photos = submissionPhotos.safeParse(form.getAll("photos"));
  if (!photos.success) return authResponse({ error: "Add 1 to 6 JPEG or PNG photos, up to 5 MB each." }, 400);

  const ids: string[] = [];
  let uploading = false;
  try {
    const data = parsed.data;
    const unit = await findSubmissionUnit(data.unitCode);
    if (!unit) return authResponse({ error: "Polling unit not found." }, 404);
    if (await hasSubmitted(user.id, unit.id)) return authResponse(duplicate, 409);

    const parties = await getActiveParties(false);
    if (!parties.length) return authResponse({ error: "Active parties are unavailable. Try again." }, 503);
    const submittedIds = new Set(data.scores.map(({ partyId }) => partyId));
    if (data.scores.length !== parties.length || parties.some(({ id }) => !submittedIds.has(id))) {
      return authResponse({ error: "Enter one score for every active party. Reload the page if the party list changed." }, 400);
    }

    const buffers: Buffer[] = [];
    try {
      for (const file of photos.data) buffers.push(await validatePhoto(file));
    } catch {
      return authResponse({ error: "A photo could not be read as a JPEG or PNG. Choose another image." }, 400);
    }
    if (!hasPhotoStorage()) return authResponse({ error: storageUnavailable }, 503);

    const hashes = [];
    for (const buffer of buffers) hashes.push(await hashPhoto(buffer));

    const urls: string[] = [];
    uploading = true;
    for (const buffer of buffers) {
      const id = photoId();
      ids.push(id);
      urls.push(await uploadPhoto(buffer, id));
    }
    uploading = false;

    const { duplicatePhoto } = await saveSubmission(user.id, unit.id, data, urls, hashes);
    const message = duplicatePhoto
      ? "Possible duplicate photo detected. Your result was saved and flagged for review."
      : data.sheetDoesNotAddUp ? "Result submitted and flagged for review." : "Result submitted.";
    return authResponse({ message, duplicatePhoto,
      unitCode: unit.code }, 201);
  } catch (error) {
    if (!(error instanceof SubmissionCommitError)) await removePhotos(ids);
    if (error && typeof error === "object" && "code" in error && error.code === "ER_DUP_ENTRY") {
      return authResponse(duplicate, 409);
    }
    console.error(uploading ? "Could not upload result photos." : "Could not save result submission.");
    return authResponse({ error: uploading ? "Could not upload the photos. Try again." : "Could not save the result. Try again." }, uploading ? 502 : 503);
  }
}
