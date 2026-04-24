'use client'

import { use } from 'react'
import Link from 'next/link'
import {
  usePlaylist,
  usePlaylistItems,
  useRemovePlaylistItem,
} from '@/hooks/usePosttubeExtras'

export default function PlaylistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: playlist, isLoading: pLoading } = usePlaylist(id)
  const { data: items, isLoading: iLoading } = usePlaylistItems(id)
  const remove = useRemovePlaylistItem(id)

  if (pLoading) return <div className="p-8">Loading playlist…</div>
  if (!playlist) return <div className="p-8 text-red-600">Playlist not found</div>

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl p-6">
        <Link href="/posttube/playlists" className="text-sm text-gray-500 hover:text-violet-600">
          ← Playlists
        </Link>
        <h1 className="text-2xl font-semibold mt-2">{playlist.title}</h1>
        {playlist.description ? (
          <p className="text-gray-600 mt-1">{playlist.description}</p>
        ) : null}
        <div className="text-sm text-gray-500 mt-1">
          {playlist.item_count} video{playlist.item_count === 1 ? '' : 's'} · {playlist.is_public ? 'Public' : 'Private'}
        </div>

        <div className="mt-6">
          {iLoading ? (
            <div className="py-12 text-center text-gray-500">Loading…</div>
          ) : !items || items.length === 0 ? (
            <div className="py-16 text-center text-gray-500">
              No videos in this playlist yet.
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((it) => (
                <div key={it.post_id} className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-3">
                  <div className="w-24 aspect-video rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xs overflow-hidden">
                    {it.post?.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.post.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      'No thumb'
                    )}
                  </div>
                  <Link
                    href={`/posttube/watch/${it.post_id}`}
                    className="flex-1 min-w-0 text-sm font-medium hover:text-violet-600"
                  >
                    {it.post?.title ?? it.post_id}
                  </Link>
                  <button
                    onClick={() => remove.mutate(it.post_id)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
