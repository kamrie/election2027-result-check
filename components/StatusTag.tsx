export type StatusKey = "no-results" | "unverified" | "confirmed" | "matches" | "mismatch" | "conflicting" | "pending" | "removed";

const styles: Record<StatusKey, string> = {
  "no-results": "bg-[#EEF0EF] text-[#5A6560]",
  unverified: "bg-[#FEF0C7] text-[#93370D]",
  confirmed: "bg-[#E3F1EA] text-brand-dark",
  matches: "bg-[#CFE8DA] text-brand-dark",
  mismatch: "bg-[#FEE4E2] text-[#B42318]",
  conflicting: "bg-[#FEF0C7] text-[#93370D]",
  pending: "bg-[#EBF8FF] text-[#2B6CB0]",
  removed: "bg-[#FFF5F5] text-[#C53030]",
};

const labels: Record<StatusKey, string> = {
  "no-results": "No results yet",
  unverified: "Unverified",
  confirmed: "Confirmed",
  matches: "Matches IReV",
  mismatch: "Mismatch",
  conflicting: "Conflicting",
  pending: "Pending",
  removed: "Removed",
};

export function StatusTag({ status }: { status: StatusKey }) {
  return (
    <span className={`inline-flex px-2 py-1 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
