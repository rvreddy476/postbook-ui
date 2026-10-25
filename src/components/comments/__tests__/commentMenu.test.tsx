import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '@/contexts/ToastContext'
import { CommentNode } from '@/components/CommentSection'
import CommentMenu, { commentMenuItems, type CommentMenuContext } from '../CommentMenu'
import { commentCreatorTools } from '../creatorTools'
import type { CommentItem } from '@/types/profile'

const base: CommentMenuContext = {
  isOwn: false, isPostAuthor: false, isReply: false, canEdit: false,
  pinned: false, hearted: false, creatorTools: true, signedIn: true,
}
const actions = (over: Partial<CommentMenuContext>) => commentMenuItems({ ...base, ...over }).map(item => item.action)

describe('comment menu rows', () => {
  test('a viewer on someone else\'s comment can only report it', () => {
    expect(actions({})).toEqual(['report'])
    expect(actions({ isReply: true })).toEqual(['report'])
  })
  test('the writer of a comment gets Edit inside the window and Delete, never Report', () => {
    expect(actions({ isOwn: true, canEdit: true })).toEqual(['edit', 'delete'])
    expect(actions({ isOwn: true, canEdit: false })).toEqual(['delete'])
  })
  test('the post author on someone else\'s comment: Pin, Love, Report — no Delete (the server refuses it)', () => {
    expect(actions({ isPostAuthor: true })).toEqual(['pin', 'heart', 'report'])
    expect(actions({ isPostAuthor: true, pinned: true, hearted: true })).toEqual(['unpin', 'unheart', 'report'])
  })
  test('the post author on a reply: Love and Report, no Pin (replies cannot be pinned)', () => {
    expect(actions({ isPostAuthor: true, isReply: true })).toEqual(['heart', 'report'])
  })
  test('the post author on their own comment: Pin, Edit, Delete — no Love, no Report', () => {
    expect(actions({ isPostAuthor: true, isOwn: true, canEdit: true })).toEqual(['pin', 'edit', 'delete'])
  })
  test('without the creator tools the post author gets the ordinary rows only', () => {
    expect(actions({ isPostAuthor: true, creatorTools: false })).toEqual(['report'])
  })
  test('signed out, or an unsent row, has no menu', () => {
    expect(actions({ signedIn: false })).toEqual([])
    expect(actions({ isOwn: true, pending: true })).toEqual([])
  })
  test('labels say what happens', () => {
    const labels = commentMenuItems({ ...base, isPostAuthor: true }).map(item => item.label)
    expect(labels).toEqual(['Pin comment', 'Love this comment', 'Report'])
  })
})

describe('the menu button', () => {
  test('is a closed, labelled menu button until pressed', () => {
    const html = renderToStaticMarkup(<CommentMenu items={[{ action: 'report', label: 'Report' }]} onSelect={() => {}} />)
    expect(html).toContain('aria-haspopup="menu"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('aria-label="More actions for this comment"')
    expect(html).not.toContain('role="menu"')
  })
  test('renders nothing when there are no rows', () => {
    expect(renderToStaticMarkup(<CommentMenu items={[]} onSelect={() => {}} />)).toBe('')
  })
})

const comment: CommentItem = {
  id: 'c1', post_id: 'p1', author_id: 'writer', body: 'nice', like_count: 0, dislike_count: 0, reply_count: 0, is_reply: false,
  created_at: new Date().toISOString(), updated_at: new Date().toISOString(), reactions: [], reaction_count: 0, viewer_reaction: null,
}

function render(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return renderToStaticMarkup(<QueryClientProvider client={qc}><ToastProvider>{node}</ToastProvider></QueryClientProvider>)
}

describe('comment rows', () => {
  test('one menu per row and no loose Report/Delete/Pin buttons in the action bar', () => {
    const html = render(<CommentNode comment={comment} postId="p1" postAuthorId="creator" parentId="c1" isReply={false} myId="creator" notifyError={() => {}} creatorTools={commentCreatorTools} />)
    expect(html.match(/data-comment-menu="true"/g)).toHaveLength(1)
    expect(html).not.toContain('data-creator-pin')
    expect(html).not.toContain('>Delete<')
    expect(html).not.toContain('>Report<')
  })
  test('pinned and loved marks show to every viewer, with or without creator tools', () => {
    const html = render(<CommentNode comment={{ ...comment, pinned: true, hearted_by_author: true }} postId="p1" postAuthorId="creator" parentId="c1" isReply={false} myId="viewer" notifyError={() => {}} />)
    expect(html).toContain('data-comment-pinned')
    expect(html).toContain('aria-label="Loved by the creator"')
  })
  test('a signed-out reader sees no menu', () => {
    const html = render(<CommentNode comment={comment} postId="p1" postAuthorId="creator" parentId="c1" isReply={false} notifyError={() => {}} />)
    expect(html).not.toContain('data-comment-menu')
  })
  test('the focused reply is tinted and focusable', () => {
    const html = render(<CommentNode comment={comment} postId="p1" postAuthorId="creator" parentId="c1" isReply={false} myId="viewer" highlightId="c1" notifyError={() => {}} />)
    expect(html).toContain('data-comment-focused="true"')
    expect(html).toContain('tabindex="-1"')
    expect(html).toContain('bg-primary-tint')
  })
  test('an email address in a comment is not linked, a mention beside it is', () => {
    const html = render(<CommentNode comment={{ ...comment, body: 'mail bob@example.com or ask @ann_b' }} postId="p1" postAuthorId="creator" parentId="c1" isReply={false} myId="viewer" notifyError={() => {}} />)
    expect(html).toContain('href="/u/ann_b"')
    expect(html).not.toContain('href="/u/example')
    expect(html).toContain('bob@example.com')
  })
})
