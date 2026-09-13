/** Compact, original break artwork. Decorative only; session state lives elsewhere. */
export function BreakIllustration() {
  return (
    <svg
      viewBox="0 0 220 112"
      className="h-24 w-full max-w-[13rem] overflow-visible"
      role="img"
      aria-label="A student relaxing under a tree"
    >
      <ellipse cx="110" cy="101" rx="92" ry="8" className="fill-primary/10" />
      <g className="motion-safe:animate-gentle-float">
        <path d="M43 94c11-28 13-47 10-72 13 24 13 49 4 73Z" className="fill-clay" />
        <circle cx="53" cy="27" r="22" className="fill-primary/20" />
        <circle cx="33" cy="39" r="17" className="fill-primary/15" />
        <circle cx="73" cy="41" r="18" className="fill-primary/25" />
      </g>
      <g className="motion-safe:animate-break-breathe">
        <circle cx="126" cy="55" r="11" className="fill-accent/55" />
        <path d="M115 69c7-8 21-8 28 1l8 21h-45Z" className="fill-primary/70" />
        <path d="m112 78-20 13m48-13 19 13" className="stroke-foreground/45" strokeWidth="5" strokeLinecap="round" />
        <path d="m111 91-20 7m55-7 19 7" className="stroke-foreground/55" strokeWidth="6" strokeLinecap="round" />
        <path d="M120 51c4-8 14-9 20-3-4 1-7 4-8 9Z" className="fill-foreground/70" />
      </g>
      <g className="motion-safe:animate-break-cup">
        <path d="M171 79h20v17h-20Z" className="fill-accent/45" />
        <path d="M191 83c9 0 9 10 0 10" className="fill-none stroke-accent/70" strokeWidth="3" />
        <path d="M177 75c-4-6 5-7 1-13m8 13c-4-6 5-7 1-13" className="fill-none stroke-muted-foreground/45" strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  );
}