type StatCardProps = {
  label: string;
  value: number | string;
};

export function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="border border-line bg-white p-4 shadow-[0_8px_12px_-8px_rgba(0,0,0,0.3)]">
      <p className="text-sm font-normal text-muted">{label}</p>
      <p className="mt-3 text-[2.2rem] font-bold leading-none text-brand">
        {value}
      </p>
    </div>
  );
}
