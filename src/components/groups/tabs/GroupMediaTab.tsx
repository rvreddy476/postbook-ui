'use client'

import React, { useMemo, useState } from 'react'
import { useGroupMedia } from '@/hooks/useGroups'
import { Image as ImageIcon, Play } from 'lucide-react'

interface GroupMediaTabProps {
  groupId: string
}

type MediaFilter = 'photos' | 'videos'

/**
 * Media grid for a space — flattens every attachment from published
 * posts into tiles, with Photos / Videos sub-tabs. Tiles open the raw
 * media in a new tab.
 */
export default function GroupMediaTab({ groupId }: GroupMediaTabProps) {
  const [filter, setFilter] = useState<MediaFilter>('photos')
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useGroupMedia(groupId)

  const items = useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data])

  // One tile per attachment, tagged with the post's content type.
  const tiles = useMemo(
    () =>
      items.flatMap((post) =>
        (post.attachments ?? [])
          .filter((a): a is string => typeof a === 'string' && a.length > 0)
          .map((mediaId, idx) => ({
            key: `${post.post_id}-${idx}`,
            mediaId,
            isVideo: post.content_type === 'video' || post.content_type === 'flick' || post.content_type === 'reel',
          })),
      ),
    [items],
  )

  const photos = tiles.filter((t) => !t.isVideo)
  const videos = tiles.filter((t) => t.isVideo)
  const visible = filter === 'photos' ? photos : videos

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="aspect-square animate-pulse rounded-xl bg-brand-secondary" />
        ))}
      </div>
    )
  }

  if (tiles.length === 0) {
    return (
      <div className="py-20 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-secondary">
          <ImageIcon className="h-8 w-8 text-brand-text/20" />
        </div>
        <p className="text-sm font-semibold text-brand-text/60">No media yet</p>
        <p className="mt-1 text-xs text-brand-text/30">Photos and videos shared in this space will appear here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Photos / Videos sub-tabs */}
      <div className="flex items-center gap-2">
        {(
          [
            { key: 'photos' as const, label: `Photos${photos.length ? ` (${photos.length})` : ''}` },
            { key: 'videos' as const, label: `Videos${videos.length ? ` (${videos.length})` : ''}` },
          ]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
              filter === t.key ? 'bg-brand-text text-brand-bg' : 'bg-brand-text/8 text-brand-text/60 hover:bg-brand-text/12'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-brand-text/40">
          No {filter} shared in this space yet.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
          {visible.map((tile) => (
            <a
              key={tile.key}
              href={`/v1/media/${tile.mediaId}/serve`}
              target="_blank"
              rel="noreferrer"
              className="group relative aspect-square overflow-hidden rounded-xl bg-brand-secondary"
            >
              {tile.isVideo ? (
                <>
                  <video
                    src={`/v1/media/${tile.mediaId}/serve`}
                    className="h-full w-full object-cover"
                    muted
                    preload="metadata"
                  />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50">
                      <Play className="h-5 w-5 fill-white text-white" />
                    </span>
                  </span>
                </>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/v1/media/${tile.mediaId}/serve`}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              )}
            </a>
          ))}
        </div>
      )}

      {hasNextPage && (
        <div className="flex justify-center pb-4 pt-2">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="rounded-xl border border-brand-divider bg-brand-card px-6 py-2.5 text-xs font-bold text-brand-highlight transition-all hover:text-brand-text hover:shadow-md disabled:opacity-50"
          >
            {isFetchingNextPage ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  )
}
