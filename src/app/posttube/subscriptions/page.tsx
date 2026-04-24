'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSession } from '@/services/authService'
import { useMyChannelSubscriptions } from '@/hooks/usePosttubeExtras'

function mediaUrl(mediaId: string) {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || ''
  return `${base}/v1/media/${mediaId}/serve`
}

export default function PosttubeSubscriptionsPage() {
  const [userId, setUserId] = useState<string | undefined>()
  useEffect(() => { setUserId(getSession()?.id) }, [])

  const { data, isLoading } = useMyChannelSubscriptions(userId)

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl p-6">
        <Link href="/posttube" className="text-sm text-gray-500 hover:text-violet-600">
          ← PostTube
        </Link>
        <h1 className="text-2xl font-semibold mt-2 mb-6">Subscriptions</h1>

        {isLoading ? (
          <div className="py-12 text-center text-gray-500">Loading…</div>
        ) : !data || data.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <p>You haven&apos;t subscribed to any channels yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {data.map((s) => {
              const c = s.channel
              return (
                <Link
                  key={s.id}
                  href={c?.handle ? `/posttube/channel/${c.handle}` : '#'}
                  className="block rounded-xl border border-gray-200 bg-white p-4 hover:border-violet-400 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center text-gray-400">
                      {c?.avatar_media_id ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mediaUrl(c.avatar_media_id)} alt={c.name} className="w-full h-full object-cover" />
                      ) : (
                        (c?.name ?? 'C').charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{c?.name ?? 'Channel'}</div>
                      <div className="text-xs text-gray-500">
                        {(c?.subscriber_count ?? 0).toLocaleString()} subscribers
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
