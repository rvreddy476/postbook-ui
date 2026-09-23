import { describe, it, expect } from 'bun:test';
import { feedPostFromCreate } from '../feedPostFromCreate';
import type { PostDetail } from '@/types/profile';

/**
 * The card is rendered from this before the server has hydrated anything, so
 * what matters is that nothing PostCard reads comes back undefined.
 */
const created = (over: Partial<PostDetail> = {}): PostDetail => ({
  id: 'p1',
  author_id: 'u1',
  text: 'hello',
  visibility: 'public',
  content_type: 'post',
  is_pinned: false,
  created_at: '2026-09-23T10:00:00Z',
  updated_at: '2026-09-23T10:00:00Z',
  ...over,
});

describe('feedPostFromCreate', () => {
  it('fills the counts a create response never carries', () => {
    const post = feedPostFromCreate(created());
    expect(post.counts).toEqual({ likes: 0, comments: 0, shares: 0 });
    expect(post.viewer_reaction).toBeNull();
    expect(post.is_bookmarked).toBe(false);
  });

  it('uses the composer media when the server sent none', () => {
    const post = feedPostFromCreate(created(), [{ media_id: 'm1', kind: 'image' }]);
    expect(post.media).toEqual([{ media_id: 'm1', kind: 'image' }]);
  });

  it('prefers the server media when there is any', () => {
    const post = feedPostFromCreate(
      created({ media: [{ media_id: 'server', kind: 'video' }] }),
      [{ media_id: 'local', kind: 'image' }],
    );
    expect(post.media).toEqual([{ media_id: 'server', kind: 'video' }]);
  });

  it('falls back on an EMPTY server array, not just a missing one', () => {
    // The `||` this asserts is deliberate. With `??`, an empty array from the
    // server would win over the media the composer actually uploaded, and a
    // photo post would render with no photo.
    const post = feedPostFromCreate(created({ media: [] }), [{ media_id: 'm1', kind: 'image' }]);
    expect(post.media).toEqual([{ media_id: 'm1', kind: 'image' }]);
  });

  it('never leaves media undefined', () => {
    expect(feedPostFromCreate(created()).media).toEqual([]);
  });

  it('keeps everything the server did send, including the journal document', () => {
    const rich = { format: 'tiptap' as const, title: 'My Entry', doc: { type: 'doc' } };
    const post = feedPostFromCreate(created({ rich_text: rich, text: 'body' }));
    expect(post.rich_text).toEqual(rich);
    expect(post.text).toBe('body');
    expect(post.id).toBe('p1');
  });

  it('does not clobber counts the server did send', () => {
    const post = feedPostFromCreate(created({ counts: { likes: 3, comments: 1 } }));
    expect(post.counts).toEqual({ likes: 3, comments: 1 });
  });
});
