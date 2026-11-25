"use client";

import { useEffect, useRef, useState } from "react";
import { drawCard, loadCardFonts } from "./card";

const button = "flex min-h-12 items-center justify-center gap-2 px-2 text-xs font-bold sm:text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60";
const primary = " bg-brand text-white hover:bg-brand-dark";
const secondary = " border border-brand bg-white text-brand-dark hover:border-brand";

export default function IveVotedPage() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [name, setName] = useState("");
  const [request, setRequest] = useState({ name: "" });
  const [ready, setReady] = useState<{ request: typeof request; file: File } | null>(null);
  const [message, setMessage] = useState("");
  const current = ready?.request === request ? ready.file : null;

  useEffect(() => {
    let active = true;
    const element = canvas.current;
    if (!element) return;

    async function render() {
      try {
        await loadCardFonts(request.name);
        if (!active || !element) return;
        drawCard(element, request.name);
        element.toBlob((blob) => {
          if (!active) return;
          if (!blob) {
            setMessage("Could not create the image. Try Generate Card again.");
            return;
          }
          const file = new File([blob], "ive-voted-tallyvote.png", { type: "image/png" });
          setReady({ request, file });
        }, "image/png");
      } catch {
        if (active) setMessage("Could not load the card font. Try Generate Card again.");
      }
    }

    void render();
    return () => { active = false; };
  }, [request]);

  function generate(value: string) {
    setMessage("");
    setRequest({ name: value.trim() });
  }

  function download() {
    if (!current) return;
    const url = URL.createObjectURL(current);
    const link = document.createElement("a");
    link.href = url;
    link.download = current.name;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function share() {
    if (!current) return;
    const data = { files: [current], title: "I’ve voted!" };
    try {
      if (typeof navigator.share !== "function" || typeof navigator.canShare !== "function" || !navigator.canShare(data)) {
        setMessage("Download the PNG to share it in your preferred app.");
        return;
      }
      await navigator.share(data);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage("Sharing is unavailable. Download the PNG to share it yourself.");
    }
  }

  return (
    <main className="bg-page px-3 pb-8 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <section className="relative isolate overflow-hidden px-4 pb-4 pt-3 text-center sm:px-12 sm:pb-7 sm:pt-6">
          <svg aria-hidden="true" viewBox="0 0 150 100" className="absolute right-0 top-0 -z-10 w-20 sm:w-36">
            <path fill="#008751" d="M0 0h150v100C87 88 71 71 51 44C32 17 16 8 0 0Z" />
            <path fill="#005C37" d="M47 0h103v88C97 76 77 40 47 0Z" />
            <path fill="#fff" d="M68 0h40c15 21 26 33 42 47v31c-43-23-60-53-82-78Z" />
          </svg>
          <p className="inline-block bg-[#D6EEDF] px-3 py-1 text-[0.65rem] font-extrabold uppercase tracking-[0.08em] text-brand-dark">Nigeria 2027</p>
          <h1 className="mt-1 flex flex-wrap items-center justify-center gap-x-3 text-[clamp(2rem,8vw,4.5rem)] font-black leading-tight tracking-tight text-[#073C30]">
            I&apos;ve Voted!
            <span role="img" aria-label="Nigeria" className="grid h-[0.58em] w-[0.96em] grid-cols-3 border border-brand bg-white">
              <span className="bg-brand" /><span /><span className="bg-brand" />
            </span>
          </h1>
          <p className="mx-auto mt-1 max-w-[23rem] text-sm leading-snug text-muted sm:text-base">
            Celebrate your participation in Nigeria&apos;s 2027 general election. Create your card and share it with friends.
          </p>
        </section>

        <div className="mx-auto grid max-w-md min-w-0 items-start gap-2 sm:gap-4 lg:max-w-none lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
          <form onSubmit={(event) => { event.preventDefault(); generate(name); }}
            className="min-w-0 border border-line bg-white p-3 shadow-[0_7px_10px_-8px_#14201A66] sm:p-6">
            <label htmlFor="voter-nickname" className="block text-sm font-bold text-ink">Name or nickname (optional)</label>
            <input id="voter-nickname" type="text" autoComplete="off" maxLength={50} value={name}
              placeholder="Enter your name or nickname" onChange={(event) => setName(event.target.value)}
              className="mt-2 h-10 w-full border border-line bg-white px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-brand" />
            <button type="submit" className={button + primary + " mt-2 min-h-10 w-full"}><Icon name="image" />Generate Card</button>
          </form>

          <section aria-label="Card preview and actions" className="min-w-0 bg-white p-3 shadow-[0_7px_10px_-8px_#14201A66] sm:p-5">
            <h2 className="mb-2 text-sm font-extrabold text-ink">Your Card Preview</h2>
            <canvas ref={canvas} width={1080} height={1080} aria-label="Preview of your personal voting statement card"
              className="mx-auto block aspect-square h-auto w-full max-w-[17rem] bg-brand-dark sm:max-w-[24rem]" />
            <div className="mt-3 grid grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)_minmax(0,0.9fr)] gap-2">
              <button type="button" className={button + primary} disabled={!current} onClick={download}><Icon name="download" />Download PNG</button>
              <button type="button" className={button + secondary} disabled={!current} onClick={() => void share()}><Icon name="share" />Share</button>
              <button type="button" className={button + secondary} onClick={() => { setName(""); generate(""); }}><Icon name="reset" />Reset</button>
            </div>
            {message && <p className="mt-3 text-sm text-brand-dark" role="status">{message}</p>}
            <p className="mt-5 border-l-2 border-brand bg-page px-3 py-2.5 text-xs leading-relaxed text-muted">
              This card is a personal statement of participation, not official proof of voting. We never ask who you voted for.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

function Icon({ name }: { name: "image" | "download" | "share" | "reset" }) {
  const paths = {
    image: "M3 4h18v16H3zM3 16l5-5 4 4 3-3 6 5M15 8h.01",
    download: "M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4",
    share: "M8 11l8-5M8 13l8 5M8 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm14-7a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm0 14a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
    reset: "M20 9a8 8 0 1 0 0 7M20 3v6h-6",
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}