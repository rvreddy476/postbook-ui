import { Check, Copy } from "lucide-react";

import { Card, Field, inputClass, pillButtonClass } from "./ui";
import type { FeedCopyTarget, FeedProps } from "./view";

/*
  RSS feed — read-only. The address podcast apps and feed readers subscribe
  to (/posttube/channel/<handle>/feed.xml), the same feed narrowed to the
  Podcasts topic, and what the apps take from the channel: its picture as
  artwork. Nothing here is saved; the feed follows the channel.
*/

function AddressRow({ id, label, hint, url, target, copied, onCopy }: { id: string; label: string; hint: string; url: string; target: FeedCopyTarget; copied: boolean; onCopy: (t: FeedCopyTarget) => void }) {
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <div className="flex items-center gap-2">
        <input id={id} readOnly value={url} spellCheck={false} onFocus={(e) => e.currentTarget.select()} className={`${inputClass} min-w-0 flex-1`} data-feed-url={target} />
        <button type="button" className={`${pillButtonClass} shrink-0`} onClick={() => onCopy(target)} aria-label={`Copy the ${label.toLowerCase()} address`}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
    </Field>
  );
}

export function FeedSection(p: FeedProps) {
  return (
    <Card id="feed" title="RSS feed" hint="An address podcast apps and feed readers can subscribe to. It lists your public long videos, newest first.">
      <div className="space-y-4">
        <AddressRow id="feed-url" label="Feed" hint="Every public long video on your channel." url={p.feedUrl} target="feed" copied={p.copied === "feed"} onCopy={p.onCopy} />
        <AddressRow id="feed-url-podcasts" label="Podcasts only" hint="Only the videos filed under the Podcasts topic." url={p.podcastsUrl} target="podcasts" copied={p.copied === "podcasts"} onCopy={p.onCopy} />
        {p.hasHandle ? null : (
          <p className="rounded-lg border border-dashed border-border px-3 py-2.5 text-[12px] text-muted-foreground" data-feed-handle-hint>
            Set a handle to get a stable feed address.
          </p>
        )}
        <p className="text-[11px] leading-relaxed text-muted-foreground" data-feed-artwork-hint>
          Podcast apps use your channel picture as artwork. Upload a square picture at least 1400×1400 for the best result.
        </p>
      </div>
    </Card>
  );
}
