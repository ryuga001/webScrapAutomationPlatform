interface LogoProps {
  size?: number;
  className?: string;
}

// WebBot brand mark: a dark rounded tile with a check inside a dashed ring.
// Self-contained (includes its own background), so no wrapper box is needed.
export function Logo({ size = 40, className }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 40 40"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="WebBot logo"
    >
      <rect width="40" height="40" rx="8" fill="#0f172a" />
      <path
        d="M12 20L18 26L28 14"
        stroke="white"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle
        cx="20"
        cy="20"
        r="16"
        stroke="white"
        strokeWidth="2"
        strokeDasharray="4 4"
        fill="none"
      />
    </svg>
  );
}
