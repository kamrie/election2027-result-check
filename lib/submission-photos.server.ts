import "server-only";

import { randomUUID } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";

export const storageUnavailable = "Photo storage is not configured. Please contact the site administrator.";

export function hasPhotoStorage() {
  try {
    const settings = cloudinary.config();
    return Boolean(settings.cloud_name && settings.api_key && settings.api_secret);
  } catch {
    return false;
  }
}

export async function validatePhoto(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const image = sharp(buffer, { limitInputPixels: 16_000_000, failOn: "warning" });
  const { format, pages } = await image.metadata();
  if (format !== (file.type === "image/jpeg" ? "jpeg" : "png") || (pages ?? 1) !== 1) {
    throw new Error("Incorrect photo format");
  }
  await image.stats();
  return buffer;
}

export function photoId() {
  return "result-check/ec8a/" + randomUUID();
}

export function uploadPhoto(buffer: Buffer, publicId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      resource_type: "image", public_id: publicId, overwrite: false, timeout: 30_000,
    }, (error, result) => {
      if (error || !result?.secure_url) reject(new Error("Photo upload failed"));
      else resolve(result.secure_url);
    });
    stream.on("error", () => reject(new Error("Photo upload failed")));
    stream.end(buffer);
  });
}

export async function removePhotos(ids: string[]) {
  const results = await Promise.allSettled(ids.map((id) => cloudinary.uploader.destroy(id, { invalidate: true })));
  if (results.some((result) => result.status === "rejected")) {
    console.error("Could not remove one or more incomplete result uploads.");
  }
}
