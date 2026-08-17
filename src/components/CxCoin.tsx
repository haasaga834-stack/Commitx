/**
 * Cute Cx Coin symbol — a small hand-drawn style coin with "Cx" on the face.
 * Purely presentational; sizing comes from the className.
 */
export function CxCoin({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      role="img"
      aria-label="Cx Coin"
    >
      <defs>
        <linearGradient id="cxcoin-face" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F5D98B" />
          <stop offset="55%" stopColor="#E3B85A" />
          <stop offset="100%" stopColor="#C9973C" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill="url(#cxcoin-face)" />
      <circle
        cx="12"
        cy="12"
        r="8.2"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.5"
        strokeWidth="1.1"
      />
      <ellipse cx="9" cy="8" rx="2.6" ry="1.7" fill="#fff" opacity="0.35" />
      <text
        x="12"
        y="15.6"
        textAnchor="middle"
        fontSize="8.5"
        fontWeight="700"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fill="#7A5418"
      >
        Cx
      </text>
    </svg>
  );
}
