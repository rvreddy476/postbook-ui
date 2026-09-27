import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '@/contexts/ToastContext'
import CommentReactions from '../CommentReactions'
import MentionText from '../MentionText'
import CommentSection, { CommentNode, repliesLabel } from '@/components/CommentSection'
import type { CommentItem } from '@/types/profile'

const comment: CommentItem = {
  id: 'c1', post_id: 'p1', author_id: 'author', body: 'thanks @raghu, nice one', like_count: 4, dislike_count: 0, reply_count: 3, is_reply: false,
  created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  reactions: [{ emoji: '❤️', count: 2 }, { emoji: '😂', count: 1 }, { emoji: '👍', count: 1 }], reaction_count: 4, viewer_reaction: '😂',
}

function wrap(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return renderToStaticMarkup(<QueryClientProvider client={qc}><ToastProvider>{node}</ToastProvider></QueryClientProvider>)
}

describe('CommentReactions at rest', () => {
  test('shows the viewer emoji, the total and the top three chips', () => {
    const html = renderToStaticMarkup(<CommentReactions item={comment} onChange={() => undefined} />)
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('aria-label="Remove your Haha reaction"')
    expect(html).toContain('class="comment-reaction-emoji" aria-hidden="true">😂<')
    expect(html).toContain('aria-label="4 reactions">4</span>')
    expect(html).toContain('Top reactions: Love 2, Haha 1, Like 1')
    expect(html).not.toContain('role="toolbar"') // the bar only opens on hover, press or keyboard
  })
  test('with no reaction it shows an outline heart and a zero', () => {
    const html = renderToStaticMarkup(<CommentReactions item={{ ...comment, viewer_reaction: null, reactions: [], reaction_count: 0, like_count: 0 }} onChange={() => undefined} />)
    expect(html).toContain('aria-pressed="false"')
    expect(html).toContain('aria-label="React to this comment"')
    expect(html).toContain('lucide-heart')
    expect(html).toContain('aria-label="0 reactions">0</span>')
    expect(html).not.toContain('comment-reaction-chips')
  })
})

describe('comment thread', () => {
  test('a comment with three replies offers "View 3 replies" and links its mentions', () => {
    const html = wrap(<CommentNode comment={comment} postId="p1" postAuthorId="author" parentId="c1" isReply={false} myId="viewer" notifyError={() => {}} />)
    expect(html).toContain('View 3 replies')
    expect(html).toContain('href="/u/raghu"')
    expect(html).toContain('>Reply</button>')
    expect(html).not.toContain('lucide-thumbs-down')
    expect(repliesLabel(1)).toBe('View 1 reply')
  })
  test('a single previewed reply needs no toggle, and the preview gets its own Reply action', () => {
    const reply: CommentItem = { ...comment, id: 'r1', is_reply: true, reply_count: 0, body: 'sure', reactions: [], reaction_count: 0, viewer_reaction: null }
    const html = wrap(<CommentNode comment={{ ...comment, reply_count: 1, reply }} postId="p1" postAuthorId="author" parentId="c1" isReply={false} notifyError={() => {}} />)
    expect(html).not.toContain('View 1 reply')
    expect(html.match(/>Reply<\/button>/g)).toHaveLength(2)
    expect(html).toContain('id="comment-r1"')
  })
  test('the full section renders seeded comments with the mention-aware composer', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    qc.setQueryData(['comments', 'p1'], [comment])
    const html = renderToStaticMarkup(<QueryClientProvider client={qc}><ToastProvider><CommentSection postId="p1" postAuthorId="author" commentsCount={1} alwaysExpanded /></ToastProvider></QueryClientProvider>)
    expect(html).toContain('View 3 replies')
    expect(html).toContain('role="combobox"')
    expect(html).toContain('aria-label="Add emoji"')
    qc.clear()
  })
})

test('MentionText leaves punctuation outside the link', () => {
  const html = renderToStaticMarkup(<MentionText body="hi @bob." />)
  expect(html).toContain('href="/u/bob"')
  expect(html).toContain('</a><span>.</span>')
})
