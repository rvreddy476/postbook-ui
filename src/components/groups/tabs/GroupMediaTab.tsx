'use client'

import React from 'react'
import { useGroupMedia } from '@/hooks/useGroups'
import { ImageIcon, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface GroupMediaTabProps {
  groupId: string
}

export default function GroupMediaTab({ groupId }: GroupMediaTabProps) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useGroupMedia(groupId)

  const posts = data?.pages.flatMap((p) => p.data) ?? []

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
          <div key={i} className="aspect-square bg-brand-secondary rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-brand-secondary mx-auto mb-4 flex items-center justify-center">
          <ImageIcon className="w-8 h-8 text-brand-secondary" />
        </div>
        <p className="text-sm font-semibold text-brand-text/60">No media yet</p>
        <p className="text-xs text-brand-text/30 mt-1">Photos and videos shared in this space will appear here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
        {posts.map((post) => (
          <Link href={`/post/${post.post_id}`} key={post.post_id}>
            <div className="relative aspect-square bg-brand-secondary rounded-xl overflow-hidden cursor-pointer group hover:opacity-90 transition-all">
              <div className="w-full h-full bg-gradient-to-br from-brand-secondary to-brand-secondary flex items-center justify-center">
                <ImageIcon className="w-6 h-6 text-brand-text/30 group-hover:scale-110 transition-transform" />
              </div>
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all" />
            </div>
          </Link>
        ))}
      </div>

      {hasNextPage && (
        <div className="flex justify-center pt-2 pb-4">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="flex items-center gap-2 px-6 py-2.5 bg-brand-card rounded-xl font-bold text-xs text-brand-highlight hover:text-brand-text hover:shadow-md transition-all border border-brand-divider disabled:opacity-50"
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Loading...
              </>
            ) : (
              'Load more media'
            )}
          </button>
        </div>
      )}
    </div>
  )
}
