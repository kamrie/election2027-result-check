import { maxPhotoBytes, photoTypes } from "@/lib/submission-validation";

export async function compressPhoto(file: File) {
  if (!photoTypes.some((type) => type === file.type)) throw new Error("Choose a JPEG or PNG photo.");
  const image = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare the photo.");
    let scale = Math.min(1, 3200 / Math.max(image.width, image.height));
    for (let attempt = 0; attempt < 5; attempt++) {
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
      if (blob && blob.size <= maxPhotoBytes) return new File([blob], "result-sheet.jpg", { type: "image/jpeg" });
      scale *= 0.8;
    }
    throw new Error("Could not compress the photo to 5 MB.");
  } finally {
    image.close();
  }
}

export function sendSubmission(form: FormData, onProgress: (percent: number) => void) {
  return new Promise<{ message: string; unitCode: string }>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/api/submit");
    request.responseType = "json";
    request.timeout = 240_000;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.floor(event.loaded * 100 / event.total));
    };
    request.upload.onload = () => onProgress(100);
    request.onload = () => {
      const response = request.response;
      if (request.status === 201 && typeof response?.unitCode === "string" && typeof response?.message === "string") {
        resolve(response);
      } else {
        reject(new Error(typeof response?.error === "string" ? response.error : "Could not submit the result. Try again."));
      }
    };
    request.onerror = request.ontimeout = () => reject(new Error("Could not complete the upload. Try again."));
    request.send(form);
  });
}
