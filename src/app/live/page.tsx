"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, Radio, Users } from "lucide-react"

import { useLiveStreams, type LiveStream } from "@/hooks/useLiveV2"
import { useBatchProfiles } from "@/hooks/useProfile"

// Live-now grid. Cursor-paginated via TanStack's useInfiniteQuery.
//
// Each card shows the cover thumbnail (if a cover media id is set), the
// creator's display name (hydrated through useBatchProfiles), a Live
// badge, and the peak viewer count as published by the backend.

export default function LiveListPage() {
  const router = useRouter()
  const query = useLiveStreams(24)

  const streams = query.data?.pages.flatMap((p: { items: LiveStream[] }) => p.items) ?? []
  const creatorIds = Array.from(new Set(streams.map((s) => s.creator_user_id)))
  const profiles = useBatchProfiles(creatorIds)
  // useBatchProfiles returns a Map<string, UserProfile> directly.
  const profileMap: Map<string, { id: string; display_name?: string }> | null =
    profiles.data instanceof Map ? (profiles.data as Map<string, { id: string; display_name?: string }>) : null

  return (
    <div className="min-h-screen bg-brand-bg py-8 px-4">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-brand-text">
              <Radio className="h-6 w-6 text-rose-500" />
              Live now
            </h1>
            <p className="mt-1 text-xs text-brand-text/60">
              Real-time broadcasts from creators across VChat.
            </p>
          </div>
          <button
            onClick={() => router.push("/live/new")}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2 text-sm font-bold text-white hover:bg-rose-600"
          >
            <Radio className="h-4 w-4" />
            Go Live
          </button>
        </div>

        {query.isLoading ? (
          <div className="flex items-center justify-center py-20 text-brand-text/40">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : streams.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-brand-divider bg-brand-card p-10 text-center">
            <Radio className="mx-auto mb-3 h-8 w-8 text-brand-text/30" />
            <div className="text-sm font-semibold text-brand-text">No live streams right now</div>
            <div className="mt-1 text-xs text-brand-text/60">
              Be the first — start your own broadcast.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {streams.map((stream) => (
              <LiveCard
                key={stream.id}
                stream={stream}
                creatorName={profileMap?.get(stream.creator_user_id)?.display_name ?? "Creator"}
              />
            ))}
          </div>
        )}

        {query.hasNextPage && (
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => query.fetchNextPage()}
              disabled={query.isFetchingNextPage}
              className="rounded-xl border border-brand-divider bg-brand-card px-5 py-2 text-sm font-bold text-brand-text hover:border-purple-400 disabled:opacity-50"
            >
              {query.isFetchingNextPage ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function LiveCard({ stream, creatorName }: { stream: LiveStream; creatorName: string }) {
  const coverSrc = stream.cover_media_id
    ? `/v1/media/${stream.cover_media_id}/serve`
    : null

  return (
    <Link
      href={`/live/${stream.id}`}
      className="group block overflow-hidden rounded-2xl border border-brand-divider bg-brand-card transition-all hover:border-purple-400 hover:shadow-md"
    >
      <div className="relative aspect-video w-full bg-black">
        {coverSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverSrc}
            alt={stream.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-rose-500/40 via-purple-500/30 to-blue-500/40">
            <Radio className="h-10 w-10 text-white/80" />
          </div>
        )}
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-white">
          <span className="block h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          Live
        </span>
        <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white">
          <Users className="h-3 w-3" /> {stream.viewer_peak.toLocaleString()}
        </span>
      </div>
      <div className="p-3">
        <div className="line-clamp-2 text-sm font-semibold text-brand-text group-hover:text-purple-600">
          {stream.title}
        </div>
        <div className="mt-1 text-[11px] text-brand-text/60">{creatorName}</div>
      </div>
    </Link>
  )
}
