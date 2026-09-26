import type { PostDetail } from '@/types/profile';

/** Presentation only: never changes eligibility, ranking, media or author styling. */
export function editorialFormat(post: PostDetail) {
  if (post.poll || post.content_type === 'poll') return 'poll';
  if (post.media?.length) return post.media.some(m => m.kind === 'video') ? 'video' : 'photo';
  if (post.rich_text?.background || post.rich_text?.background_media_id) return 'styled';
  if (post.rich_text?.format === 'tiptap' && post.rich_text.doc) return 'journal';
  return 'text';
}
