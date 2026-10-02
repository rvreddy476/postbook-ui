/*
  The progress ring of a save: a quiet track and an arc in the accent.
  `progress` null = size unknown: the arc spins instead (offline.css).
  Colours come from the tokens through offline.css; nothing is set here.
*/

export interface OfflineProgressRingProps {
  /** 0..1, or null while the size is unknown. */
  progress: number | null;
  size?: number;
  label?: string;
}

const R = 9;
const C = 2 * Math.PI * R;

export function ringDashOffset(progress: number | null): number {
  const p = progress === null ? 0.25 : Math.max(0, Math.min(1, progress));
  return C * (1 - p);
}

export function OfflineProgressRing({ progress, size = 20, label }: OfflineProgressRingProps) {
  const pct = progress === null ? undefined : Math.round(Math.max(0, Math.min(1, progress)) * 100);
  return (
    <svg
      className={`offline-ring${progress === null ? " is-unknown" : ""}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="progressbar"
      aria-label={label ?? "Saving offline"}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
    >
      <circle className="offline-ring__track" cx="12" cy="12" r={R} fill="none" strokeWidth="2.5" />
      <circle className="offline-ring__arc" cx="12" cy="12" r={R} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={ringDashOffset(progress)} transform="rotate(-90 12 12)" />
    </svg>
  );
}
