'use client'

import React, { useMemo } from 'react'
import {
  useCommunityPosts,
  useFeaturedPosts,
  useSparkCommunityPost,
  useStashCommunityPost,
  useViewCommunityPost,
  useDeleteCommunityPost,
  usePinCommunityPost,
  useFeatureCommunityPost,
} from '@/hooks/useCommunityPosts'
import { useBatchProfiles } from '@/hooks/useProfile'
import { useAuthUser } from '@/store/auth'
import { Home, Star } from 'lucide-react'
import CommunityPostCard from '@/components/communities/CommunityPostCard'
import CommunityPostComposer from '@/components/communities/CommunityPostComposer'
import type { CommunityRole } from '@/types/communities'

interface CommunityFeedTabProps {
  communityId: string
  isMember: boolean
  viewerRole?: CommunityRole | string
}

export default function CommunityFeedTab({ communityId, isMember, viewerRole }: CommunityFeedTabProps) {
  const authUser = useAuthUser()
  const { data: rawPosts, isLoading } = useCommunityPosts(communityId)
  const { data: featuredPosts } = useFeaturedPosts(communityId)

  // Engagement mutations
  const sparkMut = useSparkCommunityPost(communityId)
  const stashMut = useStashCommunityPost(communityId)
  const viewMut = useViewCommunityPost(communityId)
  const deleteMut = useDeleteCommunityPost(communityId)
  const pinMut = usePinCommunityPost(communityId)
  const featureMut = useFeatureCommunityPost(communityId)

  // Batch-fetch author profiles
  const posts = rawPosts ?? []
  const authorIds = useMemo(() => [...new Set(posts.map(p => p.author_id))], [posts])
  const { data: profileMap } = useBatchProfiles(authorIds)

  // Enrich posts with author name/avatar
  const enrichedPosts = useMemo(() => posts.map(post => {
    const profile = profileMap?.get(post.author_id)
    if (!profile) return post
    return {
      ...post,
      author_name: profile.display_name || profile.username || (post as any).author_name,
      author_avatar_url: profile.avatar_media_id
        ? `/v1/media/${profile.avatar_media_id}/serve`
        : (post as any).author_avatar_url,
    }
  }), [posts, profileMap])

  // Filter out child posts (comments) — only show top-level
  const topLevelPosts = useMemo(() => enrichedPosts.filter(p => !p.parent_post_id), [enrichedPosts])

  // Split pinned vs regular
  const pinnedPosts = useMemo(() => topLevelPosts.filter(p => p.is_pinned), [topLevelPosts])
  const regularPosts = useMemo(() => topLevelPosts.filter(p => !p.is_pinned), [topLevelPosts])

  // Callbacks
  const handleSpark = (postId: string) => sparkMut.mutate(postId)
  const handleStash = (postId: string) => stashMut.mutate(postId)
  const handleView = (postId: string) => viewMut.mutate(postId)
  const handleDelete = (postId: string) => {
    if (confirm('Delete this post?')) deleteMut.mutate(postId)
  }
  const handlePin = (postId: string) => pinMut.mutate(postId)
  const handleFeature = (postId: string, featured: boolean) => featureMut.mutate({ postId, featured })

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white border border-brand-divider rounded-2xl p-4 animate-pulse">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-full bg-brand-bg" />
              <div className="flex-1">
                <div className="h-3 w-24 bg-brand-bg rounded mb-1" />
                <div className="h-2 w-16 bg-brand-bg rounded" />
              </div>
            </div>
            <div className="h-3 w-full bg-brand-bg rounded mb-2" />
            <div className="h-3 w-3/4 bg-brand-bg rounded" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Composer */}
      {isMember && (
        <CommunityPostComposer communityId={communityId} />
      )}

      {/* Featured strip */}
      {featuredPosts && featuredPosts.length > 0 && (
        <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4">
          <div className="flex items-center gap-1.5 text-violet-700 text-xs font-bold uppercase tracking-wider mb-2">
            <Star className="w-3.5 h-3.5" /> Featured
          </div>
          <div className="space-y-2">
            {featuredPosts.slice(0, 3).map(fp => (
              <div key={fp.id} className="text-sm text-brand-text/80 truncate">
                {fp.title || fp.body?.slice(0, 100)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pinned posts */}
      {pinnedPosts.map(post => (
        <CommunityPostCard
          key={post.id}
          post={post}
          communityId={communityId}
          viewerRole={viewerRole}
          isAuthor={authUser?.id === post.author_id}
          onSpark={handleSpark}
          onStash={handleStash}
          onView={handleView}
          onDelete={handleDelete}
          onPin={handlePin}
          onFeature={handleFeature}
        />
      ))}

      {/* Regular posts */}
      {regularPosts.map(post => (
        <CommunityPostCard
          key={post.id}
          post={post}
          communityId={communityId}
          viewerRole={viewerRole}
          isAuthor={authUser?.id === post.author_id}
          onSpark={handleSpark}
          onStash={handleStash}
          onView={handleView}
          onDelete={handleDelete}
          onPin={handlePin}
          onFeature={handleFeature}
        />
      ))}

      {/* Empty state */}
      {topLevelPosts.length === 0 && (
        <div className="bg-white rounded-2xl border border-brand-divider p-8 text-center">
          <Home className="w-8 h-8 text-brand-text/20 mx-auto mb-2" />
          <p className="text-sm font-semibold text-brand-text/50">
            No posts yet
          </p>
          <p className="text-xs text-brand-text/30 mt-1">
            {isMember ? 'Be the first to share something!' : 'Join the community to start posting'}
          </p>
        </div>
      )}
    </div>
  )
}
