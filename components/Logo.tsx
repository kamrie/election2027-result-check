export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <svg
        aria-hidden="true"
        viewBox="0 0 32 32"
        className="h-8 w-8 text-brand"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g stroke="currentColor" strokeWidth="2.8" strokeLinecap="square">
          <path d="M5 5V27" />
          <path d="M9 5V27" />
          <path d="M13 5V27" />
          <path d="M17 5V27" />
          <path d="M21 6L27 26" />
        </g>
      </svg>
      <span className="text-[1.1rem] font-bold text-brand-dark">
        Result Check
      </span>
    </div>
  );
}
