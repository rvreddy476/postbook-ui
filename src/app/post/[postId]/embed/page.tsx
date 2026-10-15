'use client';

import { useParams } from 'next/navigation';

import PostEmbedView from '@/components/PostEmbedView';
import { usePostDetail } from '@/hooks/useFeedPosts';

/*
  /post/<id>/embed — the page the "Copy embed code" iframe points at.
  /post/ is a public prefix in middleware, so it opens signed out; the read
  is post-service's direct-link GET, which already 404s what a stranger may
  not see. PostEmbedView refuses everything that is not a public video.
*/

export default function PostEmbedPage() {
  const params = useParams<{ postId: string }>();
  const postId = typeof params?.postId === 'string' ? params.postId : '';
  const { data: post, isLoading, isError } = usePostDetail(postId || undefined);

  return <PostEmbedView post={post} loading={isLoading && !!postId} failed={isError || !postId} />;
}
