"use client";

/**
 * Renders a colored circle with the first letter of a name.
 * Used as fallback when user has no profile picture.
 */

const COLORS = [
  "bg-red-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-yellow-500",
  "bg-lime-500",
  "bg-green-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-cyan-500",
  "bg-sky-500",
  "bg-blue-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-purple-500",
  "bg-fuchsia-500",
  "bg-pink-500",
  "bg-rose-500",
];

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

interface LetterAvatarProps {
  name: string;
  seed?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZE_MAP = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-[12px]",
  md: "h-10 w-10 text-[14px]",
  lg: "h-12 w-12 text-[16px]",
  xl: "h-16 w-16 text-[20px]",
};

export function LetterAvatar({
  name,
  seed,
  size = "md",
  className = "",
}: LetterAvatarProps) {
  const letter = (name || "?").charAt(0).toUpperCase();
  const colorIndex = hashSeed(seed || name) % COLORS.length;
  const bg = COLORS[colorIndex];

  return (
    <div
      className={`${bg} ${SIZE_MAP[size]} flex shrink-0 items-center justify-center rounded-full font-bold text-white ${className}`}
    >
      {letter}
    </div>
  );
}

/**
 * Helper: renders <img> if src is available, otherwise renders LetterAvatar.
 */
interface AvatarProps {
  src?: string | null;
  name: string;
  seed?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  imgClassName?: string;
}

const IMG_SIZE_MAP = {
  xs: "h-6 w-6",
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
  xl: "h-16 w-16",
};

export function Avatar({
  src,
  name,
  seed,
  size = "md",
  className = "",
  imgClassName = "",
}: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${IMG_SIZE_MAP[size]} shrink-0 rounded-full object-cover ${imgClassName} ${className}`}
      />
    );
  }

  return <LetterAvatar name={name} seed={seed} size={size} className={className} />;
}
