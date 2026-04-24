'use client'

import Link from 'next/link'
import { useContinueWatching, useDeleteWatchProgress } from '@/hooks/usePosttubeExtras'

export default function PosttubeHistoryPage() {
  const { data, isLoading } = useContinueWatching()
  const del = useDeleteWatchProgress()

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl p-6">
        <Link href="/posttube" className="text-sm text-gray-500 hover:text-violet-600">
          ← PostTube
        </Link>
        <h1 className="text-2xl font-semibold mt-2 mb-6">Continue watching</h1>

        {isLoading ? (
          <div className="py-12 text-center text-gray-500">Loading…</div>
        ) : !data || data.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <p>No watch history yet.</p>
            <Link href="/posttube" className="text-violet-600 hover:underline mt-2 inline-block">
              Browse videos →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {data.map((e) => {
              const pct = e.duration_sec > 0 ? Math.min(100, (e.watched_sec / e.duration_sec) * 100) : 0
              return (
                <div key={e.post_id} className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-3">
                  <div className="w-32 aspect-video rounded bg-gray-100 relative overflow-hidden flex items-center justify-center text-gray-400 text-xs">
                    {e.post?.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={e.post.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      'No thumb'
                    )}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
                      <div className="h-full bg-red-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <Link
                    href={`/posttube/watch/${e.post_id}`}
                    className="flex-1 min-w-0 text-sm font-medium hover:text-violet-600"
                  >
                    <div>{e.post?.title ?? e.post_id}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {Math.round(pct)}% watched · last {new Date(e.last_watched_at).toLocaleDateString()}
                    </div>
                  </Link>
                  <button
                    onClick={() => del.mutate(e.post_id)}
                    className="text-sm text-gray-500 hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
