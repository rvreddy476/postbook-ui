"use client"

import Link from "next/link"
import { Radio, Users } from "lucide-react"

import { useLiveStreams, type LiveStream } from "@/hooks/useLiveV2"
import { useBatchProfiles } from "@/hooks/useProfile"
import { Skeleton } from "@/components/ui/skeleton"
import { LiveStatusBadge } from "@/features/live/components/LiveStatus"
import { currentViewerCount, liveStatusView } from "@/features/live/status"
import "@/features/live/live.css"

// Live now. Cursor-paginated. The badge is the stream's own status (a
// stream the host is reconnecting to says so) and the number is the
// current audience without the host — never the peak.

export default function LiveListPage() {
  const query = useLiveStreams(24)

  const streams = query.data?.pages.flatMap((p: { items: LiveStream[] }) => p.items) ?? []
  const creatorIds = Array.from(new Set(streams.map((s) => s.creator_user_id)))
  const profiles = useBatchProfiles(creatorIds)
  const profileMap = profiles.data instanceof Map
    ? (profiles.data as Map<string, { display_name?: string; username?: string }>)
    : null

  return (
    <div className="live-page">
      <div className="live-page__inner">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h1 className="live-page__title flex items-center gap-2">
              <Radio className="h-5 w-5 text-primary-ink" aria-hidden="true" />
              Live now
            </h1>
            <p className="live-page__meta">Real-time broadcasts from creators.</p>
          </div>
          <Link href="/live/new" className="live-btn live-btn--primary">
            Go live
          </Link>
        </div>

        {query.isLoading ? (
          <div className="live-grid">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-video w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <div className="live-panel">
            <div className="live-panel__title">Couldn&apos;t load live streams.</div>
            <button type="button" className="live-btn live-btn--ghost" onClick={() => query.refetch()}>
              Try again
            </button>
          </div>
        ) : streams.length === 0 ? (
          <div className="live-panel">
            <Radio className="live-panel__icon h-8 w-8" aria-hidden="true" />
            <div className="live-panel__title">No one is live right now</div>
            <Link href="/live/new" className="live-btn live-btn--ghost">Go live</Link>
          </div>
        ) : (
          <div className="live-grid">
            {streams.map((stream) => {
              const profile = profileMap?.get(stream.creator_user_id)
              return (
                <LiveCard
                  key={stream.id}
                  stream={stream}
                  creatorName={profile?.display_name || profile?.username || "Creator"}
                />
              )
            })}
          </div>
        )}

        {query.hasNextPage && (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => query.fetchNextPage()}
              disabled={query.isFetchingNextPage}
              className="live-btn live-btn--ghost"
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
  const coverSrc = stream.cover_media_id ? `/v1/media/${stream.cover_media_id}/serve` : null
  const viewers = currentViewerCount(stream, null)
  return (
    <Link href={`/live/${stream.id}`} className="live-card">
      <div className="live-card__cover">
        {coverSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverSrc} alt="" className="live-card__img" />
        ) : (
          <Radio className="h-8 w-8" aria-hidden="true" />
        )}
        <span className="live-card__badge">
          <LiveStatusBadge view={liveStatusView(stream)} />
        </span>
        <span className="live-card__viewers">
          <Users className="h-3 w-3" aria-hidden="true" /> {viewers.toLocaleString()}
        </span>
      </div>
      <div className="live-card__body">
        <div className="live-card__title">{stream.title}</div>
        <div className="live-card__meta">{creatorName}</div>
      </div>
    </Link>
  )
}
