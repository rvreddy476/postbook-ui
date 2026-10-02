import { CircleCheck } from "lucide-react";

import "./offline.css";

/** The small "Offline copy" marker over a player that is playing the stored copy. */
export function OfflineBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`offline-badge ${className}`.trim()} data-offline-copy>
      <CircleCheck aria-hidden />
      Offline copy
    </span>
  );
}
