import type { Party } from "@/lib/parties";
import { maxVoteCount } from "@/lib/submission-validation";

export type TotalField = "accredited" | "valid" | "rejected";
export type ScoreField = number | TotalField;
export type OcrSuggestions = Map<ScoreField, string>;

type Word = { text: string; confidence: number; bbox?: { x0: number; x1: number; y0: number; y1: number } };
type Located = Word & { bbox: NonNullable<Word["bbox"]> };
type Line = { words: Word[] };
const labelConfidence = 85;
const scoreConfidence = 90;

function readNumber(words: Word[]) {
  if (words.length !== 1) return null;
  const [word] = words;
  if (word.confidence < scoreConfidence || !/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(word.text)) return null;
  const value = Number(word.text.replaceAll(",", ""));
  return value <= maxVoteCount ? String(value) : null;
}

function record(candidates: Map<ScoreField, string | null>, field: ScoreField, value: string | null) {
  candidates.set(field, candidates.has(field) ? null : value);
}

function totalField(label: string): TotalField | undefined {
  if (/^(?:TOTAL )?(?:NUMBER OF )?ACCREDITED VOTERS$/.test(label)) return "accredited";
  if (/^(?:TOTAL )?(?:NUMBER OF )?VALID VOTES$/.test(label)) return "valid";
  if (/^(?:TOTAL )?(?:NUMBER OF )?REJECTED (?:VOTES|BALLOTS|BALLOT PAPERS)$/.test(label)) return "rejected";
}

const x = ({ bbox }: Located) => (bbox.x0 + bbox.x1) / 2;
const y = ({ bbox }: Located) => (bbox.y0 + bbox.y1) / 2;
const height = ({ bbox }: Located) => bbox.y1 - bbox.y0;
const upper = ({ text }: Word) => text.trim().toUpperCase();

function visualRows(lines: Line[]) {
  const words = lines.flatMap(({ words }) => words).filter((word): word is Located =>
    Boolean(word.bbox && word.bbox.y1 > word.bbox.y0 && word.bbox.x1 > word.bbox.x0),
  ).sort((a, b) => y(a) - y(b));
  const rows: Located[][] = [];
  for (const word of words) {
    const row = rows.at(-1);
    // Compare with the first word so adjacent rows cannot be joined by a chain of overlaps.
    if (row && y(word) - y(row[0]) <= Math.min(height(word), height(row[0])) / 2) row.push(word);
    else rows.push([word]);
  }
  return rows.map((row) => row.sort((a, b) => x(a) - x(b)));
}

function headerColumns(row: Located[]) {
  const tokens = row.map((word) => upper(word).replace(/:$/, ""));
  const parties = tokens.flatMap((token, i) => token === "PARTY" ? [i] : []);
  const figures = tokens.flatMap((token, i) => /^FIGURES?$/.test(token) ? [i] : []);
  const scores = tokens.flatMap((token, i) =>
    /^SCORES?$/.test(token) && !tokens.slice(i + 1, i + 3).includes("WORDS") ? [i] : [],
  );
  const headings = figures.length ? figures : scores;
  if (parties.length !== 1 || headings.length !== 1 || parties[0] >= headings[0]) return null;
  const [partyEnd] = parties;
  const [scoreEnd] = headings;
  const partyStart = tokens[partyEnd - 1] === "POLITICAL" ? partyEnd - 1 : partyEnd;
  let scoreStart = scoreEnd;
  if (tokens[scoreEnd - 1] === "IN") {
    scoreStart--;
    if (/^(?:VOTES|SCORES?)$/.test(tokens[scoreStart - 1] ?? "")) scoreStart--;
  }
  if (row.slice(partyStart, partyEnd + 1).some((word) => word.confidence < labelConfidence)
    || row.slice(scoreStart, scoreEnd + 1).some((word) => word.confidence < labelConfidence)) return null;

  const party = (row[partyStart].bbox.x0 + row[partyEnd].bbox.x1) / 2;
  const score = (row[scoreStart].bbox.x0 + row[scoreEnd].bbox.x1) / 2;
  const beforeScore = row[scoreStart - 1];
  const afterScore = row[scoreEnd + 1];
  if (scoreStart <= partyEnd || score - party < height(row[partyEnd]) * 2) return null;

  return {
    partyLeft: partyStart > 0 ? (row[partyStart - 1].bbox.x1 + row[partyStart].bbox.x0) / 2 : row[partyStart].bbox.x0 - height(row[partyEnd]) * 2,
    partyRight: (row[partyEnd].bbox.x1 + row[partyEnd + 1].bbox.x0) / 2,
    scoreLeft: (beforeScore.bbox.x1 + row[scoreStart].bbox.x0) / 2,
    scoreRight: afterScore ? (row[scoreEnd].bbox.x1 + afterScore.bbox.x0) / 2
      : row[scoreEnd].bbox.x1 + Math.min((score - x(beforeScore)) / 2, height(row[scoreEnd]) * 3),
  };
}

function wrappedHeader(rows: Located[][], index: number) {
  const abbreviations = rows[index].filter((word) => /^ABBREVIATIONS?$/.test(upper(word)) && word.confidence >= labelConfidence);
  if (abbreviations.length !== 1) return null;
  const [abbreviation] = abbreviations;
  const band = rows.flat().filter((word) => Math.abs(y(word) - y(abbreviation)) <= height(abbreviation) * 3.5);
  const party = band.find((word) => upper(word) === "PARTY" && word.confidence >= labelConfidence
    && y(word) < y(abbreviation) && x(word) > abbreviation.bbox.x0 && x(word) < abbreviation.bbox.x1);
  const political = band.filter((word) => upper(word) === "POLITICAL" && word.confidence >= labelConfidence
    && word.bbox.x0 > abbreviation.bbox.x1);
  const figures = band.filter((word) => /^FIGURES?$/.test(upper(word)) && word.confidence >= labelConfidence
    && word.bbox.x0 > abbreviation.bbox.x1);
  if (!party || political.length !== 1 || figures.length !== 1 || x(political[0]) >= x(figures[0])) return null;

  const [figure] = figures;
  const [name] = political;
  const votes = band.find((word) => upper(word) === "VOTES" && word.confidence >= labelConfidence
    && y(word) < y(figure) && Math.abs(x(word) - x(figure)) <= height(figure) * 5);
  if (!votes) return null;
  const serial = band.find((word) => /^(?:S[/.]N|NO[.]?)$/.test(upper(word)) && x(word) < abbreviation.bbox.x0);
  const margin = height(abbreviation) * 2;
  return {
    index: rows.indexOf(rows.find((row) => row.includes(figure))!),
    columns: {
      partyLeft: serial ? (serial.bbox.x1 + abbreviation.bbox.x0) / 2 : abbreviation.bbox.x0 - margin,
      partyRight: (abbreviation.bbox.x1 + name.bbox.x0) / 2,
      scoreLeft: (name.bbox.x1 + Math.min(figure.bbox.x0, votes.bbox.x0)) / 2,
      scoreRight: Math.max(figure.bbox.x1, votes.bbox.x1) + height(figure) * 5,
    },
  };
}

function tableScores(lines: Line[], partyIds: Map<string, number>) {
  const rows = visualRows(lines);
  const wrapped = rows.flatMap((_, index) => {
    const header = wrappedHeader(rows, index);
    return header ? [header] : [];
  });
  const headers = wrapped.length ? wrapped : rows.flatMap((row, index) => {
    const columns = headerColumns(row);
    return columns ? [{ index, columns }] : [];
  });
  const candidates = new Map<ScoreField, string | null>();
  if (!headers.length) {
    const tableLike = rows.some((row) => {
      const text = row.map(upper).join(" ");
      return /\bPARTY\b/.test(text) && /\b(?:FIGURES?|SCORES?|WORDS)\b/.test(text);
    });
    return tableLike ? candidates : null;
  }
  if (headers.length > 1) return candidates;

  const [{ index, columns }] = headers;
  for (const row of rows.slice(index + 1)) {
    if (/\b(?:TOTAL|NUMBER OF) (?:NUMBER OF )?(?:ACCREDITED|VALID|REJECTED|VOTES)\b/.test(row.map(upper).join(" "))) break;

    const labels = row.filter((word) => x(word) > columns.partyLeft && x(word) < columns.partyRight && partyIds.has(upper(word)));
    const cell = row.filter((word) => x(word) > columns.scoreLeft && x(word) < columns.scoreRight);
    const inside = cell.length === 1 && cell[0].bbox.x0 > columns.scoreLeft && cell[0].bbox.x1 < columns.scoreRight;
    const printedCode = wrapped.length ? row
      .filter((word) => x(word) > columns.partyRight && x(word) < columns.scoreLeft)
      .map(upper).join(" ").match(/\(([A-Z]{1,8})\)\s*$/)?.[1] : undefined;
    for (const label of labels) {
      const id = partyIds.get(upper(label))!;
      record(candidates, id, labels.length === 1 && label.confidence >= labelConfidence && inside
        && (!printedCode || printedCode === upper(label)) ? readNumber(cell) : null);
    }
  }
  return candidates;
}

function corroboratedRows(rows: Word[][], partyIds: Map<string, number>) {
  const candidates = new Map<ScoreField, string | null>();
  for (const row of rows) {
    const words = row.filter((word) => word.text.trim());
    if (words.length < 5 || /^(?:\([A-Z]{1,8}\)|\))$/.test(upper(words.at(-1)!))) continue;
    const [serial, label] = words;
    if (!serial || !label || !/^[1-9]\d?[.)]?$|^0[1-9]$/.test(serial.text.trim())) continue;
    const abbreviation = upper(label);
    const id = partyIds.get(abbreviation);
    if (id === undefined) continue;

    const score = words.at(-1)!;
    const suffixLength = upper(words.at(-2) ?? score) === ")" ? 3 : 1;
    const suffix = words.slice(-1 - suffixLength, -1);
    const name = words.slice(2, -1 - suffixLength);
    const repeated = /^\(([A-Z]{1,8})\)$/.exec(suffix.map(upper).join(""))?.[1];
    const clear = repeated === abbreviation && label.confidence >= labelConfidence
      && suffix.every((word) => word.confidence >= labelConfidence) && name.length > 0
      && name.every((word) => /^[A-Z][A-Z'.-]*$/.test(upper(word)));
    record(candidates, id, clear ? readNumber([score]) : null);
  }
  return candidates;
}

export function scoreCellCandidates(lines: Line[], parties: Pick<Party, "id" | "abbreviation">[]) {
  const ids = new Map(parties.map(({ id, abbreviation }) => [abbreviation.toUpperCase(), id]));
  const rows = visualRows(lines);
  const proposed = corroboratedRows(rows, ids);
  const logical = corroboratedRows(lines.map(({ words }) => words), ids);
  return rows.flatMap((row) => {
    const id = row[1] && ids.get(upper(row[1]));
    if (id === undefined) return [];
    const value = proposed.get(id);
    const score = row.at(-1)!;
    const suffix = row.at(-2)!;
    if (!value || (logical.has(id) && logical.get(id) !== value) || readNumber([score]) !== value || !suffix) return [];
    const gap = score.bbox.x0 - suffix.bbox.x1;
    const size = height(score);
    // Reject densely packed or split cells. Include space left of the read token
    // so a missed leading digit is visible in the second, focused read.
    if (gap < size * 2) return [];
    const left = Math.max(suffix.bbox.x1 + 1, score.bbox.x0 - size * 4);
    const top = Math.max(0, score.bbox.y0 - Math.round(size / 5));
    return [{
      id, value, rectangle: { left, top, width: score.bbox.x1 + size * 2 - left, height: Math.round(size * 1.4) },
    }];
  });
}

export function inkCellCandidates(lines: Line[], parties: Pick<Party, "id" | "abbreviation">[]) {
  const ids = new Map(parties.map(({ id, abbreviation }) => [abbreviation.toUpperCase(), id]));
  const cells = new Map<ScoreField, { field: ScoreField; rectangle: { left: number; top: number; width: number; height: number } } | null>();
  const totals: NonNullable<ReturnType<typeof cells.get>>[] = [];
  for (const line of lines) {
    const words = line.words.filter((word): word is Located => Boolean(word.bbox && word.text.trim()));
    if (words.length < 3) continue;
    const anchor = words.at(-1)!;
    const label = words.slice(0, -1);
    const normalized = label.map(upper);
    const total = totalField(normalized.join(" ").replace(/^\d{1,2}[.)]?\s+/, "").replace(/:$/, ""));
    const abbreviation = normalized[1];
    const named = /^\d{1,2}[.)]?$/.test(normalized[0]) && ids.has(abbreviation)
      && normalized.at(-1) === "(" + abbreviation + ")";
    const field = total ?? (named ? ids.get(abbreviation) : undefined);
    if (field === undefined) continue;
    const printed = total ? label : [label[1], label.at(-1)!];
    const size = height(label.at(-1)!);
    const gap = anchor.bbox.x0 - label.at(-1)!.bbox.x1;
    if (printed.some((word) => word.confidence < labelConfidence) || gap < size * 4
      || height(anchor) < size * 0.35 || height(anchor) > size * 2) continue;

    const left = Math.max(label.at(-1)!.bbox.x1 + 1, anchor.bbox.x0 - size * 5);
    const top = Math.max(0, anchor.bbox.y0 - Math.round(size * 0.18));
    const rectangle = {
      left, top, width: anchor.bbox.x1 + size * 2 - left,
      height: anchor.bbox.y1 - top + Math.round(size * 0.16),
    };
    if (total) totals.push({ field, rectangle });
    else cells.set(field, cells.has(field) ? null : { field, rectangle });
  }
  return [...totals, ...[...cells.values()].filter((cell) => cell !== null)];
}

export function focusedScore(lines: Line[]) {
  return readNumber(lines.flatMap(({ words }) => words));
}

export function agreedRowScores(first: Line[], second: Line[], parties: Pick<Party, "id" | "abbreviation">[]): OcrSuggestions {
  const partyIds = new Map(parties.map((party) => [party.abbreviation.toUpperCase(), party.id]));
  function candidates(lines: Line[]) {
    const logical = corroboratedRows(lines.map(({ words }) => words), partyIds);
    const spatial = corroboratedRows(visualRows(lines), partyIds);
    for (const [field, value] of spatial) {
      const existing = logical.get(field);
      if (existing === undefined) logical.set(field, value);
      else if (existing !== null && value !== null && existing !== value) logical.set(field, null);
    }
    return logical;
  }

  const firstRows = candidates(first);
  const secondRows = candidates(second);
  const scores: OcrSuggestions = new Map();
  // Treat a missing or conflicting read as manual entry, even if one pass was confident.
  for (const [field, value] of firstRows) {
    if (value !== null && secondRows.get(field) === value) scores.set(field, value);
  }
  return scores;
}

export function extractSuggestions(lines: Line[], parties: Pick<Party, "id" | "abbreviation">[]): OcrSuggestions {
  const partyIds = new Map(parties.map((party) => [party.abbreviation.toUpperCase(), party.id]));
  const table = tableScores(lines, partyIds);
  const candidates = table ?? new Map<ScoreField, string | null>();

  for (const line of lines) {
    const words = line.words.flatMap((word) =>
      upper(word).split(/([:=])/).filter(Boolean).map((text) => ({ text, confidence: word.confidence })),
    );
    if (/^\d{1,2}[.)]$/.test(words[0]?.text ?? "")) words.shift();
    if (words.length < 2) continue;

    let length = 1;
    let field: ScoreField | undefined = table ? undefined : partyIds.get(words[0].text);
    if (field === undefined) {
      for (; length < words.length && length <= 8; length++) {
        field = totalField(words.slice(0, length).map((word) => word.text).join(" "));
        if (field !== undefined) break;
      }
    }
    if (field === undefined) continue;

    const label = words.slice(0, length);
    const tail = words.slice(length);
    if (/^[:=]$/.test(tail[0]?.text ?? "")) tail.shift();
    record(candidates, field, label.every((word) => word.confidence >= labelConfidence) ? readNumber(tail) : null);
  }

  return new Map([...candidates].filter((entry): entry is [ScoreField, string] => entry[1] !== null));
}
