import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import EditPostSheet from '../EditPostSheet';

const post = { id: 'p1', text: 'Hello', visibility: 'friends', no_comments: true, hide_like_count: true, media: [] };
const noop = () => {};

describe('edit post sheet', () => {
  test('a labelled modal dialog, filled from the post', () => {
    const html = renderToStaticMarkup(<EditPostSheet post={post} saving={false} error={null} onSave={noop} onClose={noop} />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toMatch(/aria-labelledby="([^"]+)"[\s\S]*id="\1"[^>]*>Edit post</);
    expect(html).toContain('>Hello</textarea>');
    expect(html).toMatch(/value="friends"[^>]*checked=""|checked=""[^>]*value="friends"/);
    expect(html).toMatch(/data-row="allow-comments"[^>]*|aria-checked="false"[^>]*data-row="allow-comments"/);
    expect(html).toMatch(/aria-checked="false" data-row="allow-comments"/);
    expect(html).toMatch(/aria-checked="true" data-row="hide-like-count"/);
  });

  test('nothing changed: Save waits', () => {
    const html = renderToStaticMarkup(<EditPostSheet post={post} saving={false} error={null} onSave={noop} onClose={noop} />);
    expect(html).toMatch(/<button type="submit" disabled=""/);
  });

  test('a refusal shows as a sentence; while saving the sheet cannot close', () => {
    const html = renderToStaticMarkup(<EditPostSheet post={post} saving error="This post no longer exists." onSave={noop} onClose={noop} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('This post no longer exists.');
    expect(html).toContain('Saving…');
    expect(html).toMatch(/aria-label="Close"[^>]*disabled=""|disabled=""[^>]*aria-label="Close"/);
  });
});
