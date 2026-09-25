'use client'

import React, { useMemo } from 'react'
import { ImageIcon } from 'lucide-react'
import { useGroupMedia } from '@/hooks/useGroups'

/**
 * Recent media, beside the discussion.
 *
 * This is the only card in the right rail. The About card that used to sit
 * above it is gone: About is now a tab of its own, and a rail card repeating
 * the same description beside the feed made it the third place the same
 * sentence appeared on one screen.
 */
/**
 * The tiles, and whether we are still finding out.
 *
 * Exported because GroupView needs the same answer to decide whether to
 * reserve a rail column at all. Both callers share one `useGroupMedia`
 * cache entry, so asking twice costs nothing.
 */
export function useRecentMediaTiles(groupId: string | undefined) {
    const { data, isLoading } = useGroupMedia(groupId)

    /*
      Six tiles from the attachments the group already has.

      Each post carries an `attachments` array, so one post with four photos
      fills the rail on its own. Flattening to individual media ids rather
      than showing one tile per post means "recent media" is recent media and
      not "recent posts that happened to have a picture".
    */
    const tiles = useMemo(() => {
        const items = data?.pages.flatMap((p) => p.data) ?? []
        const out: { postId: string; mediaId: string }[] = []
        for (const item of items) {
            let ids: unknown = item.attachments
            if (typeof ids === 'string') {
                try {
                    ids = JSON.parse(ids)
                } catch {
                    ids = []
                }
            }
            if (!Array.isArray(ids)) continue
            for (const id of ids) {
                if (typeof id === 'string' && id) out.push({ postId: item.post_id, mediaId: id })
                if (out.length >= 6) return out
            }
        }
        return out
    }, [data])

    return { tiles, isLoading }
}

export default function RecentMediaCard({
    groupId,
    onSeeAll,
}: {
    groupId: string
    onSeeAll: () => void
}) {
    const { tiles, isLoading } = useRecentMediaTiles(groupId)

    // Nothing to show is not worth a card. An empty grid with a heading is
    // more noise beside a feed than no card at all.
    if (!isLoading && tiles.length === 0) return null

    return (
        <section className="rounded-2xl border border-brand-divider bg-brand-card">
            <header className="flex items-center justify-between gap-3 border-b border-brand-divider px-4 py-3">
                <h3 className="flex items-center gap-2 text-[14px] font-semibold text-brand-text">
                    <ImageIcon className="h-4 w-4 text-brand-text/45" strokeWidth={1.9} />
                    Recent media
                </h3>
                <button
                    onClick={onSeeAll}
                    className="text-[12px] font-medium text-primary-ink hover:underline"
                >
                    See all
                </button>
            </header>

            <div className="grid grid-cols-3 gap-1.5 p-3">
                {isLoading
                    ? Array.from({ length: 6 }).map((_, i) => (
                          <div key={i} className="aspect-square animate-pulse rounded-lg bg-brand-secondary" />
                      ))
                    : tiles.map((t) => (
                          <button
                              key={`${t.postId}-${t.mediaId}`}
                              onClick={onSeeAll}
                              className="aspect-square overflow-hidden rounded-lg bg-brand-secondary transition-opacity hover:opacity-85"
                          >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                  src={`/v1/media/${t.mediaId}/serve`}
                                  alt=""
                                  loading="lazy"
                                  className="h-full w-full object-cover"
                              />
                          </button>
                      ))}
            </div>
        </section>
    )
}
