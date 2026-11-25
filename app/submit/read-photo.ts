import type { Worker as OcrWorker, PSM as PageSegMode } from "tesseract.js";
import type { Party } from "@/lib/parties";
import { agreedRowScores, extractSuggestions, focusedScore, inkCellCandidates, scoreCellCandidates } from "./ocr-suggestions";

export type OcrDiagnostics = {
  mode: string;
  cellReads: string[];
  text: string;
  confidence: number;
  lines: {
    text: string;
    confidence: number;
    words: { text: string; confidence: number; x: number; y: number }[];
  }[];
};

async function scanImage(file: File, enhance = false) {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare scan image.");
    if (enhance) context.filter = "grayscale(100%) contrast(1.35)";
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not prepare scan image.")), "image/png");
    });
    return { blob, width: canvas.width, height: canvas.height, canvas };
  } finally {
    bitmap.close();
  }
}

function isolateBlueInk(source: HTMLCanvasElement, area: { left: number; top: number; width: number; height: number }) {
  const context = source.getContext("2d");
  if (!context || area.left + area.width > source.width || area.top + area.height > source.height) return;
  const pixels = context.getImageData(area.left, area.top, area.width, area.height);
  let left = pixels.width, right = 0, top = pixels.height, bottom = 0;
  let ink = 0;
  for (let offset = 0; offset < pixels.data.length; offset += 4) {
    const [red, green, blue] = pixels.data.subarray(offset, offset + 3);
    const blueInk = red < 150 && blue - red > 22 && blue - green > 12;
    const shade = blueInk ? 0 : 255;
    pixels.data[offset] = pixels.data[offset + 1] = pixels.data[offset + 2] = shade;
    if (!blueInk) continue;
    const x = (offset / 4) % pixels.width;
    const y = Math.floor(offset / 4 / pixels.width);
    left = Math.min(left, x);
    right = Math.max(right, x);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
    ink++;
  }
  // Reject a mark that reaches either row boundary, where neighboring ink may intrude.
  if (ink < 12 || top === 0 || bottom >= pixels.height - 1) return;
  const mask = document.createElement("canvas");
  mask.width = pixels.width;
  mask.height = pixels.height;
  mask.getContext("2d")?.putImageData(pixels, 0, 0);
  const output = document.createElement("canvas");
  const width = right - left + 1;
  const height = bottom - top + 1;
  output.width = width * 4 + 32;
  output.height = height * 4 + 32;
  const drawing = output.getContext("2d");
  if (!drawing) return;
  drawing.fillStyle = "white";
  drawing.fillRect(0, 0, output.width, output.height);
  drawing.drawImage(mask, left, top, width, height, 16, 16, width * 4, height * 4);
  return new Promise<Blob | null>((resolve) => output.toBlob(resolve, "image/png"));
}

export async function readPhoto(
  file: File, parties: Party[], signal: AbortSignal, onProgress: (progress: number) => void,
  onDiagnostics?: (diagnostics: OcrDiagnostics) => void,
) {
  const { createWorker, OEM, PSM } = await import("tesseract.js");
  signal.throwIfAborted();

  let worker: OcrWorker | undefined;
  let fail: (error: unknown) => void = () => {};
  const interrupted = new Promise<never>((_, reject) => { fail = reject; });
  const cancel = () => fail(signal.reason);
  signal.addEventListener("abort", cancel, { once: true });
  const timeout = window.setTimeout(() => fail(new Error("OCR timed out.")), 120_000);
  let finished = false;
  let secondPass = false;
  let readingCells = false;
  try {
    const starting = createWorker("eng", OEM.LSTM_ONLY, {
      logger: ({ status, progress }) => {
        if (!finished && !signal.aborted && !readingCells && status === "recognizing text") {
          onProgress(Math.max(0, Math.min(100, Math.floor(progress * 50) + (secondPass ? 50 : 0))));
        }
      },
      errorHandler: fail,
    }).then(async (started) => {
      if (finished || signal.aborted) {
        await started.terminate();
        throw new Error("Scan stopped.");
      }
      worker = started;
      return started;
    });

    const [activeWorker, image] = await Promise.race([Promise.all([starting, scanImage(file)]), interrupted]);
    async function recognize(picture: Blob, mode: PageSegMode, rectangle?: { left: number; top: number; width: number; height: number }) {
      await Promise.race([activeWorker.setParameters({ tessedit_pageseg_mode: mode }), interrupted]);
      const { data } = await Promise.race([
        activeWorker.recognize(picture, rectangle ? { rectangle } : {}, { blocks: true }),
        interrupted,
      ]);
      const lines = data.blocks?.flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines)) ?? [];
      return { data, lines, suggestions: extractSuggestions(lines, parties) };
    }

    const cellReads: string[] = [];
    const first = await recognize(image.blob, PSM.SINGLE_BLOCK);
    let scan = first;
    let mode = "Single block";
    const hasPartyScore = (result: typeof scan) => [...result.suggestions.keys()].some((key) => typeof key === "number");
    if (!hasPartyScore(scan)) {
      secondPass = true;
      onProgress(50);
      const enhanced = await Promise.race([scanImage(file, true), interrupted]);
      const retry = await recognize(enhanced.blob, PSM.AUTO);
      const agreed = agreedRowScores(scan.lines, retry.lines, parties);
      if (hasPartyScore(retry) || retry.suggestions.size > scan.suggestions.size
        || (scan.suggestions.size === 0 && retry.data.confidence > scan.data.confidence)) {
        scan = retry;
        mode = "Auto layout and enhanced contrast";
      }
      let addedAgreedScore = false;
      for (const [field, value] of agreed) {
        if (scan.suggestions.has(field)) continue;
        scan.suggestions.set(field, value);
        addedAgreedScore = true;
      }
      if (addedAgreedScore) mode += " + matching rows from both passes";

      if (!hasPartyScore(scan)) {
        const firstCells = scoreCellCandidates(first.lines, parties);
        for (const cell of scoreCellCandidates(retry.lines, parties).slice(0, 6)) {
          const other = firstCells.find(({ id }) => id === cell.id);
          if (other && other.value !== cell.value) continue;
          const { rectangle } = cell;
          if (rectangle.left + rectangle.width > enhanced.width || rectangle.top + rectangle.height > enhanced.height) continue;
          const focused = await recognize(enhanced.blob, PSM.SINGLE_LINE, rectangle);
          if (focusedScore(focused.lines) === cell.value) scan.suggestions.set(cell.id, cell.value);
        }
        if (hasPartyScore(scan)) mode += " + confirmed score cells";
      }
      readingCells = true;
      onProgress(95);
      const cells = [...inkCellCandidates(retry.lines, parties), ...inkCellCandidates(first.lines, parties)];
      const scannedAreas = new Set<string>();
      const recovered = new Map<(typeof cells)[number]["field"], string | null>();
      for (const { field, rectangle } of cells) {
        const key = JSON.stringify([field, rectangle]);
        if (scan.suggestions.has(field) || scannedAreas.has(key)) continue;
        scannedAreas.add(key);
        const label = typeof field === "number" ? parties.find(({ id }) => id === field)?.abbreviation : field;
        const describe = (result: Awaited<ReturnType<typeof recognize>>) =>
          result.data.text.trim() + " (" + result.data.confidence + "/100)";
        const ink = await Promise.race([isolateBlueInk(image.canvas, rectangle), interrupted]);
        const reads = ink ? [
          await recognize(ink, PSM.SINGLE_WORD),
          await recognize(ink, PSM.SINGLE_LINE),
        ] : [];
        const initial = reads.map(({ lines }) => focusedScore(lines));
        if (ink && !(initial[0] && initial[0] === initial[1])) {
          reads.push(await recognize(ink, PSM.RAW_LINE));
        }
        const accepted = reads.map(({ lines }) => focusedScore(lines)).filter((value) => value !== null);
        const verified = accepted.length >= 2 && accepted.every((value) => value === accepted[0])
          ? accepted[0]
          : null;
        if (onDiagnostics) cellReads.push(label + ": " + (reads.length ? reads.map(describe).join(" / ") : "no isolated ink"));
        if (verified !== null) {
          const existing = recovered.get(field);
          recovered.set(field, existing === undefined || existing === verified ? verified : null);
        }
      }
      for (const [field, value] of recovered) {
        if (value !== null) scan.suggestions.set(field, value);
      }
      if ([...recovered.values()].some((value) => value !== null)) mode += " + isolated blue ink";

    }
    onProgress(100);
    const { data, lines, suggestions } = scan;
    onDiagnostics?.({
      mode,
      cellReads,
      text: data.text,
      confidence: data.confidence,
      lines: lines.map((line) => ({
        text: line.text,
        confidence: line.confidence,
        words: line.words.map((word) => ({
          text: word.text,
          confidence: word.confidence,
          x: word.bbox.x0,
          y: word.bbox.y0,
        })),
      })),
    });
    return suggestions;
  } finally {
    finished = true;
    window.clearTimeout(timeout);
    signal.removeEventListener("abort", cancel);
    await worker?.terminate().catch(() => {});
  }
}
