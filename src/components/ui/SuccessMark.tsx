/** Confirms a settled payment: the ring pops in, then the check draws itself. Static when motion is reduced. */
export function SuccessMark() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true" className="mx-auto motion-safe:animate-pop-in">
      <circle cx="32" cy="32" r="30" className="fill-accent/15 stroke-accent" strokeWidth="2" />
      <path
        d="M21 33l7 7 15-16"
        fill="none"
        className="stroke-accent motion-safe:animate-check-draw"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="24 24"
        pathLength={24}
      />
    </svg>
  );
}
