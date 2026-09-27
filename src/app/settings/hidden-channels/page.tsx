"use client";

import Link from "next/link";
import { UserX } from "lucide-react";

import AppShell from "@/components/AppShell";
import { useGlobalToast } from "@/contexts/ToastContext";
import { useHiddenAuthors, useShowAuthorAgain } from "@/features/reels/hooks/useHiddenAuthors";
import { useBatchProfiles } from "@/hooks/useProfile";

function mediaUrl(mediaId: string) {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "";
  return `${base}/v1/media/${mediaId}/serve`;
}

/*
  The channels a viewer asked not to be recommended ("Don't recommend this
  channel" on a reel or a video). Reversible here: "Show again" sends the
  positive signal and their content returns to the feeds.
*/
export default function HiddenChannelsPage() {
  const toast = useGlobalToast();
  const hidden = useHiddenAuthors();
  const showAgain = useShowAuthorAgain();
  const items = hidden.data ?? [];
  const { data: profileMap } = useBatchProfiles(items.map((h) => h.author_id));

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl p-4">
        <Link href="/settings" className="text-sm text-brand-text/60 hover:text-brand-text">
          ← Settings
        </Link>
        <h1 className="mb-1 mt-2 text-2xl font-semibold text-brand-text">Hidden channels</h1>
        <p className="mb-6 text-sm text-brand-text/70">Channels you asked us not to recommend. Their reels and videos stay out of your feeds until you show them again.</p>

        {hidden.isPending ? (
          <div className="py-12 text-center text-brand-text/60">Loading…</div>
        ) : hidden.isError ? (
          <div className="py-12 text-center text-brand-text/60">Couldn't load this list. Try again in a moment.</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-brand-text/60">
            <UserX className="h-7 w-7 opacity-60" />
            You haven't hidden any channels.
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((h) => {
              const p = profileMap?.get(h.author_id);
              const name = p?.display_name ?? p?.username ?? "Channel";
              return (
                <li key={h.author_id} className="flex items-center gap-4 rounded-xl border border-border bg-brand-card p-4">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-brand-secondary text-brand-text/60">
                    {p?.avatar_media_id ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mediaUrl(p.avatar_media_id)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-brand-text">{name}</div>
                    {p?.username ? <div className="text-xs text-brand-text/60">@{p.username}</div> : null}
                    <div className="mt-0.5 text-xs text-brand-text/50">Hidden {new Date(h.created_at).toLocaleDateString()}</div>
                  </div>
                  <button
                    type="button"
                    disabled={showAgain.isPending}
                    onClick={() =>
                      showAgain.mutate(h.author_id, {
                        onSuccess: () => toast({ type: "success", title: `${name} will be recommended again` }),
                        onError: () => toast({ type: "error", title: "Could not update that preference" }),
                      })
                    }
                    className="rounded-full bg-brand-secondary px-3 py-1.5 text-[13px] font-semibold text-brand-text transition hover:bg-brand-divider disabled:opacity-50"
                  >
                    Show again
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
