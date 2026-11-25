"use client";

import { useEffect, useRef, useState } from "react";
import type { Party } from "@/lib/parties";
import type { OcrSuggestions } from "./ocr-suggestions";
import { readPhoto, type OcrDiagnostics } from "./read-photo";

type Photo = { file: File; url: string };

export default function PhotoOcr({ photos, parties, disabled, onSuggestions, onRunningChange }: {
  photos: Photo[];
  parties: Party[];
  disabled: boolean;
  onSuggestions: (suggestions: OcrSuggestions) => void;
  onRunningChange: (running: boolean) => void;
}) {
  const [selected, setSelected] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [diagnostics, setDiagnostics] = useState<OcrDiagnostics | null>(null);
  const [debugError, setDebugError] = useState("");
  const [suggestionCount, setSuggestionCount] = useState<number | null>(null);
  const currentScan = useRef<AbortController | null>(null);
  const photo = photos.find(({ url }) => url === selected) ?? photos[0];

  useEffect(() => () => currentScan.current?.abort(), []);

  function finish() {
    currentScan.current = null;
    setRunning(false);
    onRunningChange(false);
  }

  function cancel() {
    currentScan.current?.abort();
    finish();
    setMessage("Scan cancelled. You can enter the figures manually.");
  }

  async function scan() {
    if (!photo || disabled || currentScan.current) return;
    const controller = new AbortController();
    currentScan.current = controller;
    setRunning(true);
    onRunningChange(true);
    setProgress(null);
    setMessage("");
    if (process.env.NODE_ENV === "development") {
      setDiagnostics(null);
      setDebugError("");
      setSuggestionCount(null);
    }
    try {
      const suggestions = await readPhoto(photo.file, parties, controller.signal, setProgress,
        process.env.NODE_ENV === "development" ? setDiagnostics : undefined);
      if (controller.signal.aborted) return;
      if (process.env.NODE_ENV === "development") setSuggestionCount(suggestions.size);
      onSuggestions(suggestions);
      setMessage(suggestions.size
        ? "Review the suggestions against the sheet. Enter any remaining figures manually."
        : "No figures could be read reliably. The photo may be blurry or the handwriting unclear. Try a clearer photo or enter the figures manually.");
    } catch (error) {
      if (!controller.signal.aborted) {
        if (process.env.NODE_ENV === "development") {
          setDebugError(error instanceof Error ? error.message : String(error));
        }
        setMessage("Could not read this photo. Try a clearer, upright image or enter the figures manually.");
      }
    } finally {
      if (currentScan.current === controller) finish();
    }
  }

  if (!photo) return null;

  return (
    <div className="mt-4 border border-line bg-white p-4">
      {photos.length > 1 && (
        <label className="mb-3 block text-sm font-bold text-ink">
          Photo to scan
          <select value={photo.url} onChange={(event) => setSelected(event.target.value)}
            disabled={disabled || running}
            className="mt-2 block h-11 w-full border border-line bg-white px-3 text-ink focus:border-brand sm:max-w-xs">
            {photos.map(({ url }, index) => <option key={url} value={url}>Photo {index + 1}</option>)}
          </select>
        </label>
      )}
      {running ? (
        <button type="button" onClick={cancel} className="min-h-11 border border-brand px-4 py-2 text-sm font-bold text-brand">
          Cancel scan
        </button>
      ) : (
        <button type="button" onClick={() => void scan()} disabled={disabled}
          className="min-h-11 border border-brand px-4 py-2 text-sm font-bold text-brand disabled:opacity-60">
          Read scores from photo
        </button>
      )}
      <p className="mt-2 text-sm text-muted">Optional. Handwritten numbers can be misread.</p>
      {running && (
        <div className="mt-3 text-sm text-muted">
          <p role="status">{progress === null ? "Preparing the scanner..." : "Scanning photo... " + progress + "%"}</p>
          <progress aria-label="Scanning progress" max={100} value={progress ?? undefined} className="mt-2 block w-full accent-[#008751]" />
        </div>
      )}
      {message && <p role="status" className="mt-3 text-sm font-medium text-ink">{message}</p>}
      {process.env.NODE_ENV === "development" && (diagnostics || debugError) && (
        <details className="mt-4 border border-line p-3 text-sm text-ink">
          <summary className="cursor-pointer font-bold text-brand">OCR diagnostics (development only)</summary>
          <p className="mt-2">Active party abbreviations: {parties.map(({ abbreviation }) => abbreviation).join(", ")}</p>
          {debugError && <p className="mt-2 break-words">Scanner error: {debugError}</p>}
          {diagnostics && (
            <>
              <p className="mt-2">Scan pass: {diagnostics.mode}.</p>
              <p className="mt-2">Page confidence: {diagnostics.confidence.toFixed(1)} / 100.
                {" "}Recognized lines: {diagnostics.lines.length}.
                {" "}Accepted suggestions: {suggestionCount ?? "Unavailable"}.</p>
              {diagnostics.cellReads.length > 0 && (
                <p className="mt-2 break-words">Focused cell reads: {diagnostics.cellReads.join(" | ")}</p>
              )}
              <h3 className="mt-3 font-bold">Raw OCR text</h3>
              <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap break-words bg-[#F7FAF8] p-2">
                {diagnostics.text || "(No text recognized)"}
              </pre>
              <h3 className="mt-3 font-bold">Line and word confidence</h3>
              <ol className="mt-1 max-h-64 list-decimal space-y-2 overflow-auto pl-6">
                {diagnostics.lines.map((line, index) => (
                  <li key={index} className="break-words">
                    {line.confidence.toFixed(1)} / 100 {line.text}
                    <div className="text-xs text-muted">
                      {line.words.map((word) =>
                        JSON.stringify(word.text) + " " + word.confidence.toFixed(1) + " / 100 at (" + word.x + ", " + word.y + ")"
                      ).join(" | ")}
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
        </details>
      )}
    </div>
  );
}
