import { describe, expect, test } from 'bun:test';
import {
  MAX_POST_TEXT,
  buildPostEditBody,
  editedFields,
  hasEdits,
  mergePostEdit,
  postEditErrorCopy,
  postEditFormFrom,
  postEditProblem,
  visibilityOptionsFor,
  type EditablePost,
} from '../postEdit';

const post: EditablePost & Record<string, unknown> = {
  id: 'p1',
  text: 'Hello #world',
  visibility: 'followers',
  no_comments: false,
  hide_like_count: false,
  media: [],
  tier_required_id: 'tier-1',
  action: { label: 'shop', url: 'https://example.com' },
};

describe('edit body', () => {
  test('no change sends nothing', () => {
    const body = buildPostEditBody(post, postEditFormFrom(post));
    expect(body).toEqual({});
    expect(hasEdits(body)).toBe(false);
  });

  test('only the changed field is sent', () => {
    const form = postEditFormFrom(post);
    expect(buildPostEditBody(post, { ...form, text: 'Hello again' })).toEqual({ text: 'Hello again' });
    expect(buildPostEditBody(post, { ...form, visibility: 'public' })).toEqual({ visibility: 'public' });
    expect(buildPostEditBody(post, { ...form, allowComments: false })).toEqual({ no_comments: true });
    expect(buildPostEditBody(post, { ...form, hideLikeCount: true })).toEqual({ hide_like_count: true });
  });

  test('several changes go together, and never the members-only gate or the Action button', () => {
    const body = buildPostEditBody(post, { text: 'x', visibility: 'private', allowComments: false, hideLikeCount: true });
    expect(body).toEqual({ text: 'x', visibility: 'private', no_comments: true, hide_like_count: true });
    expect(Object.keys(body)).not.toContain('tier_required_id');
    expect(Object.keys(body)).not.toContain('action');
    expect(JSON.stringify(body)).not.toContain('null');
  });

  test('turning comments back on sends no_comments false', () => {
    const closed = { ...post, no_comments: true };
    expect(buildPostEditBody(closed, { ...postEditFormFrom(closed), allowComments: true })).toEqual({ no_comments: false });
  });

  test('a visibility the server would refuse is never sent', () => {
    expect(buildPostEditBody(post, { ...postEditFormFrom(post), visibility: 'staged' })).toEqual({});
  });

  test('a post with missing fields reads as the defaults', () => {
    expect(postEditFormFrom({ id: 'p' })).toEqual({ text: '', visibility: 'public', allowComments: true, hideLikeCount: false });
  });
});

describe('edit problems', () => {
  test('text over the ceiling is caught before sending, counted in code points', () => {
    const form = postEditFormFrom(post);
    expect(postEditProblem(post, { ...form, text: 'a'.repeat(MAX_POST_TEXT) })).toBeNull();
    expect(postEditProblem(post, { ...form, text: 'a'.repeat(MAX_POST_TEXT + 1) })).toContain('5,000');
    expect(postEditProblem(post, { ...form, text: '\u{1F600}'.repeat(MAX_POST_TEXT) })).toBeNull();
  });

  test('emptying a text-only post is refused; a post with a photo may lose its text', () => {
    const form = postEditFormFrom(post);
    expect(postEditProblem(post, { ...form, text: '   ' })).toContain('needs some text');
    expect(postEditProblem({ ...post, media: [{}] }, { ...form, text: '' })).toBeNull();
  });
});

describe('edit refusals read as sentences', () => {
  const refused = (status: number, code?: string) => ({ response: { status, data: code ? { error: { code, message: 'raw' } } : {} } });
  test('copyright review explains members-only', () => {
    const copy = postEditErrorCopy(refused(409, 'COPYRIGHT_REVIEW'));
    expect(copy).toContain('copyright review');
    expect(copy).toContain('members-only');
  });
  test('each code the route answers has its own sentence', () => {
    expect(postEditErrorCopy(refused(422, 'EMPTY_POST'))).toContain('needs some text');
    expect(postEditErrorCopy(refused(422, 'TEXT_TOO_LONG'))).toContain('5,000');
    expect(postEditErrorCopy(refused(422, 'INVALID_VISIBILITY'))).toContain('who can see');
    expect(postEditErrorCopy(refused(403, 'FORBIDDEN'))).toContain('Only the person');
    expect(postEditErrorCopy(refused(404, 'NOT_FOUND'))).toContain('no longer exists');
    expect(postEditErrorCopy(refused(503, 'MEMBERSHIP_TIERS_UNAVAILABLE'))).toContain('nothing was saved');
    expect(postEditErrorCopy(refused(422, 'TOO_MANY_HASHTAGS'))).toContain('too many hashtags');
  });
  test('statuses without a known code, offline, and anything else', () => {
    expect(postEditErrorCopy(refused(404))).toContain('no longer exists');
    expect(postEditErrorCopy(refused(429))).toContain('Too many');
    expect(postEditErrorCopy(refused(503))).toContain('Nothing was saved');
    expect(postEditErrorCopy({ isAxiosError: true })).toContain('offline');
    expect(postEditErrorCopy(new Error('x'))).toBe('Your changes couldn’t be saved. Please try again.');
    expect(postEditErrorCopy(refused(500, 'INTERNAL_ERROR'))).not.toContain('raw');
  });
});

describe('visibility options', () => {
  test('the four composer audiences, plus the post’s own when it is another', () => {
    expect(visibilityOptionsFor('public').map((o) => o.value)).toEqual(['public', 'followers', 'friends', 'private']);
    expect(visibilityOptionsFor('unlisted').map((o) => o.value)).toEqual(['public', 'followers', 'friends', 'private', 'unlisted']);
    expect(visibilityOptionsFor('staged').at(-1)?.value).toBe('staged');
  });
});

describe('cache merge', () => {
  test('edited fields land on the cached row; the server text and hashtags win', () => {
    const fields = editedFields({ text: 'new #tag', no_comments: true }, { text: 'new #tag', hashtags: ['tag'], visibility: 'followers' });
    expect(fields).toEqual({ text: 'new #tag', no_comments: true, hashtags: ['tag'] });
    expect(editedFields({ visibility: 'public' }, null)).toEqual({ visibility: 'public' });
  });

  test('merges into the post wherever it sits; the same reference when it is absent', () => {
    const cache = { pages: [{ data: [{ id: 'a' }] }, { data: [{ id: 'p1', text: 'old' }, { id: 'b' }] }], pageParams: [null, 'c'] };
    const next = mergePostEdit(cache, 'p1', { text: 'new' });
    expect(next.pages[1].data[0]).toEqual({ id: 'p1', text: 'new' });
    expect(next.pages[0]).toBe(cache.pages[0]);
    expect(mergePostEdit(cache, 'zzz', { text: 'x' })).toBe(cache);
    expect(mergePostEdit(undefined, 'p1', {})).toBeUndefined();
  });
});
