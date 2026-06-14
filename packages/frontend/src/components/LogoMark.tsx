import { useId } from 'react';

/**
 * The Dynamically logo mark — four cells, one shifted.
 * Gradient: violet (#7c5cff) → cyan (#3ad1c6), rx=28 container.
 */
export function LogoMark({ size = 28 }: { size?: number }) {
  const uid    = useId();
  const gradId = `dyn-g-${uid}`;
  const clipId = `dyn-c-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0"   stopColor="#7c5cff" />
          <stop offset="1"   stopColor="#3ad1c6" />
        </linearGradient>
        <clipPath id={clipId}>
          <rect x="0" y="0" width="120" height="120" rx="28" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        {/* Background */}
        <rect x="0" y="0" width="120" height="120" fill={`url(#${gradId})`} />
        {/* Top-left cell */}
        <rect x="22" y="22" width="32" height="32" rx="7" fill="#fff" />
        {/* Top-right cell */}
        <rect x="66" y="22" width="32" height="32" rx="7" fill="#fff" opacity="0.92" />
        {/* Bottom-left cell */}
        <rect x="22" y="66" width="32" height="32" rx="7" fill="#fff" opacity="0.92" />
        {/* Bottom-right — the "rearranging cell" (taller) */}
        <rect x="66" y="66" width="32" height="50" rx="7" fill="#fff" />
      </g>
    </svg>
  );
}
