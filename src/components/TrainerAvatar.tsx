import Image from "next/image";

const PALETTE = [
  ["#C8A882", "#8B6F5C"],
  ["#D4B896", "#A5825B"],
  ["#B8956A", "#8B6F5C"],
  ["#E8D5C4", "#B8956A"],
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Avatar trenerki: zdjęcie jeśli jest, w przeciwnym razie elegancki
 * monogram serif na piaskowym gradiencie (SSR, zero JS).
 */
export function TrainerAvatar({
  name,
  avatarUrl,
  size = 48,
  className = "",
}: {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
}) {
  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={`Zdjęcie: ${name}`}
        width={size}
        height={size}
        className={`rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  const [from, to] = PALETTE[name.length % PALETTE.length];
  const gradId = `av-${name.replace(/[^a-z]/gi, "").slice(0, 12)}-${size}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={`Monogram: ${name}`}
      className={`rounded-full ${className}`}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${gradId})`} />
      <text
        x="50"
        y="54"
        dominantBaseline="middle"
        textAnchor="middle"
        fontFamily="var(--font-playfair), Georgia, serif"
        fontSize="38"
        fontWeight="600"
        fill="#FFF9F5"
        letterSpacing="2"
      >
        {initials(name)}
      </text>
    </svg>
  );
}
