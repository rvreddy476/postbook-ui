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
    const html = renderToStaticMarkup(<PostControls {...props} />);
    expect(html.match(/role="menu"/g)).toHaveLength(1);
    expect(html.match(/role="menuitem"/g)).toHaveLength(6);
    for (const name of ['Recommend similar', 'Hide this update', 'Mute this author', 'Copy embed code', 'Report a concern', 'Block this account']) {
      expect(html).toContain(`aria-label="${name}"`);
    }
    for (const removed of ['Save post', 'More options', 'Interested', 'Not interested', "We won&#x27;t tell", 'Delete update']) expect(html).not.toContain(removed);
  });
  test('owners only see the existing management actions', () => {
    const html = renderToStaticMarkup(<PostControls {...props} own pinned />);
    expect(html.match(/role="menuitem"/g)).toHaveLength(2);
    expect(html).toContain('aria-label="Unpin update"');
    expect(html).toContain('aria-label="Delete update"');
    expect(html).not.toContain('Block this account');
    expect(html).not.toContain('Recommend similar');
  });
  test('an in-flight deletion stays disabled', () => {
    const html = renderToStaticMarkup(<PostControls {...props} own deleting />);
    expect(html).toMatch(/aria-label="Delete update"[^>]*disabled=""/);
  });
});
