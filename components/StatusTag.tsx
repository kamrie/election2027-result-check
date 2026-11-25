export type StatusKey = "no-results" | "unverified" | "confirmed" | "matches" | "mismatch" | "conflicting" | "pending" | "flagged" | "removed";

const styles: Record<StatusKey, string> = {
  "no-results": "border-[#CBD5CE] bg-[#EDF3EF] text-[#44534B] shadow-[0_5px_9px_-5px_#718378]",
  unverified: "border-[#E3B83B] bg-[#FFF0A6] text-[#694600] shadow-[0_5px_9px_-5px_#D99A00]",
  confirmed: "border-[#60C88B] bg-[#B8F5CB] text-brand-dark shadow-[0_5px_9px_-5px_#008751]",
  matches: "border-brand-dark bg-brand text-white shadow-[0_5px_10px_-4px_#008751]",
  mismatch: "border-[#A61B15] bg-[#C62D25] text-white shadow-[0_5px_10px_-4px_#C62D25]",
  conflicting: "border-[#ED9E53] bg-[#FFD4A6] text-[#743306] shadow-[0_5px_9px_-5px_#E66A19]",
  pending: "border-[#87B5EC] bg-[#D6E9FF] text-[#174582] shadow-[0_5px_9px_-5px_#367ACE]",
  flagged: "border-[#ED9E53] bg-[#FFD4A6] text-[#743306] shadow-[0_5px_9px_-5px_#E66A19]",
  removed: "border-[#EE9B95] bg-[#FFD5D1] text-[#8B211B] shadow-[0_5px_9px_-5px_#DA4940]",
};

const labels: Record<StatusKey, string> = {
  "no-results": "No results yet",
  unverified: "Unverified",
  confirmed: "Confirmed",
  matches: "Matches IReV",
  mismatch: "Mismatch",
  conflicting: "Conflicting",
  pending: "Pending",
  flagged: "Flagged",
  removed: "Removed",
};

export function StatusTag({ status }: { status: StatusKey }) {
  return (
    <span className={`inline-flex border px-2 py-1 text-xs font-bold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
