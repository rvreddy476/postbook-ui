"use client";

export type ReelFeedTab = "for-you" | "following";

interface ReelFeedTabsProps {
  value: ReelFeedTab;
  onChange: (tab: ReelFeedTab) => void;
}

const TABS: { key: ReelFeedTab; label: string }[] = [
  { key: "for-you", label: "For you" },
  { key: "following", label: "Following" },
];

/*
  "For you | Following" above the stage. A tablist with roving arrows, so
  the keyboard reaches both without tabbing through the stage first.
*/
export function ReelFeedTabs({ value, onChange }: ReelFeedTabsProps) {
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const i = TABS.findIndex((t) => t.key === value);
    const next = TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
    onChange(next.key);
    (e.currentTarget.querySelector(`[data-tab="${next.key}"]`) as HTMLButtonElement | null)?.focus();
  };
  return (
    <div role="tablist" aria-label="Reels feed" className="reel-feed-tabs" onKeyDown={onKey} onClick={(e) => e.stopPropagation()}>
      {TABS.map((tab) => {
        const selected = tab.key === value;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            data-tab={tab.key}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.key)}
            className={`reel-feed-tab ${selected ? "is-selected" : ""}`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
