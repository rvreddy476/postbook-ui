import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import PostControls, { type PostControlsProps } from '../PostControls';

const noop = () => {};
const props: PostControlsProps = {
  own: false, pinned: false, deleting: false,
  onRecommend: noop, onHide: noop, onMute: noop, onEmbed: noop,
  onReport: noop, onBlock: noop, onPin: noop, onDelete: noop, onClose: noop,
};

describe('post controls', () => {
  test('one flat menu exposes every non-owner action with an explicit name', () => {
    const html = renderToStaticMarkup(<PostControls {...props} canEmbed canEdit onEdit={noop} />);
    expect(html.match(/role="menu"/g)).toHaveLength(1);
    expect(html.match(/role="menuitem"/g)).toHaveLength(6);
    for (const name of ['Recommend similar', 'Hide this update', 'Mute this author', 'Copy embed code', 'Report a concern', 'Block this account']) {
      expect(html).toContain(`aria-label="${name}"`);
    }
    for (const removed of ['Save post', 'More options', 'Interested', 'Not interested', "We won&#x27;t tell", 'Delete post', 'Edit post']) expect(html).not.toContain(removed);
  });
  test('owners see Edit post, Pin post and Delete post, in that order', () => {
    const html = renderToStaticMarkup(<PostControls {...props} own canEdit onEdit={noop} />);
    expect(html.match(/role="menuitem"/g)).toHaveLength(3);
    const order = ['Edit post', 'Pin post', 'Delete post'].map((l) => html.indexOf(`aria-label="${l}"`));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).toContain('Manage post');
    for (const old of ['Pin update', 'Delete update', 'Manage update']) expect(html).not.toContain(old);
    expect(html).not.toContain('Block this account');
    expect(html).not.toContain('Recommend similar');
  });
  test('a pinned post offers Unpin post', () => {
    const html = renderToStaticMarkup(<PostControls {...props} own pinned />);
    expect(html).toContain('aria-label="Unpin post"');
  });
  test('no Edit post where editing is not offered (a repost)', () => {
    expect(renderToStaticMarkup(<PostControls {...props} own canEdit={false} onEdit={noop} />)).not.toContain('Edit post');
    expect(renderToStaticMarkup(<PostControls {...props} own canEdit />)).not.toContain('Edit post');
  });
  test('an in-flight deletion stays disabled', () => {
    const html = renderToStaticMarkup(<PostControls {...props} own deleting />);
    expect(html).toMatch(/aria-label="Delete post"[^>]*disabled=""/);
  });
});
