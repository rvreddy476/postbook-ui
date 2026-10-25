import { BadgeDollarSign, Sparkles, Wand2 } from "lucide-react";

import { disclosureLabels, type DisclosureKind, type Disclosures } from "@/lib/disclosures";

const ICONS: Record<DisclosureKind, typeof Sparkles> = { ai: Sparkles, paid: BadgeDollarSign, altered: Wand2 };

/*
  Small pills for a post's disclosures (lib/disclosures.ts). `onMedia` is the
  variant drawn over a playing video (reels stage colours); the default sits
  on a page surface and uses the theme tokens. Renders nothing when the post
  discloses nothing.
*/
export function DisclosureBadges({ disclosures, onMedia = false, className = "" }: { disclosures: Disclosures | null | undefined; onMedia?: boolean; className?: string }) {
  const labels = disclosureLabels(disclosures);
  if (labels.length === 0) return null;
  const pill = onMedia
    ? "bg-[rgb(var(--reel-stage)/0.55)] text-[rgb(var(--reel-on-stage))] ring-1 ring-[rgb(var(--reel-on-stage)/0.3)] backdrop-blur-sm"
    : "bg-brand-secondary text-brand-text ring-1 ring-border";
  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`} aria-label="Creator disclosures" data-disclosures>
      {labels.map(({ kind, label, description }) => {
        const Icon = ICONS[kind];
        return (
          <li key={kind} title={description} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4 ${pill}`} data-disclosure={kind}>
            <Icon className="h-3 w-3 shrink-0" aria-hidden />
            <span>{label}</span>
            <span className="sr-only">: {description}</span>
          </li>
        );
      })}
    </ul>
  );
}
