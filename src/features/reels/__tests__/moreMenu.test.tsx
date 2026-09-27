import { expect, test } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { toReelItem } from '../model';
import { ReelMoreMenu, speedChipLabel } from '../components/ReelMoreMenu';
import { MENU_SPEEDS } from '../menu';
import { DEFAULT_PREFS } from '../playback/playerPrefs';

const other = toReelItem({
  id: 'r3', author_id: 'b', content_type: 'reel', text: 'a caption', tags: ['x'],
  author: { id: 'b', username: 'bee', display_name: 'Bee' },
  media: [{ media_id: 'm', kind: 'video' }],
})!;
const noop = () => {};
const base = {
  open: true, onClose: noop, reel: { ...other, downloadAllowed: true, reasonText: 'Popular' }, isOwn: false, following: false as const,
  prefs: DEFAULT_PREFS, onPrefsChange: noop, qualityHeights: [720, 1080], captionsAvailable: 'unknown' as const,
  onCopyLink: noop, onDescription: noop, onInterested: noop, onToggleFollow: noop, onBlock: noop, onDelete: noop,
  onClearScreen: noop, onTheater: noop, onNotInterested: noop, onDontRecommend: noop, onReport: noop,
};

test('one card: the playback rows first, then the mapped rows in menu.ts order, Report last', () => {
  const html = renderToStaticMarkup(<ReelMoreMenu {...base} anchor="below" />);
  const marks = [
    'data-row="speed"', 'data-row="quality"', 'data-row="auto-scroll"', 'data-row="theater"', 'data-row="captions"',
    '>Copy link<', '>Description<', '>Download<', ">Why you&#x27;re seeing this<", '>Interested<', '>Follow @bee<', '>Block @bee<',
    '>Clear screen<', '>Not interested<', ">Don&#x27;t recommend @bee<", '>Report<',
  ];
  const at = marks.map((m) => html.indexOf(m));
  for (const [i, pos] of at.entries()) expect(pos, marks[i]).toBeGreaterThan(-1);
  expect([...at].sort((a, b) => a - b)).toEqual(at);
  expect(html.lastIndexOf('role="menuitem"')).toBeLessThan(html.indexOf('>Report<'));
  // Playback rows keep the menu open (no run(): they are radios / a submenu / checkboxes), Report is the danger row.
  expect(html).toContain('role="radiogroup" aria-label="Playback speed"');
  expect(html).toContain('aria-haspopup="menu" class="reel-more-menu__row" data-row="quality"');
  expect(html).toContain('role="menuitemcheckbox" aria-checked="false" data-row="auto-scroll"');
  expect(html).toContain('role="menuitemcheckbox" aria-checked="false" data-row="captions"');
  expect(html).toContain('class="reel-more-menu__row is-danger"');
  // Nothing from the retired playback-settings popover.
  expect(html).not.toContain('Playback settings');
  expect(html).not.toContain('Auto-advance');
  // The stage tone, hung under the three dots.
  expect(html).toContain('reel-frame-popover');
  expect(html).toContain('reel-more-menu');
  expect(html).not.toContain('bg-brand-card');
});

test('the speed control lists exactly 0.75 · 1.0 · 1.25 · 1.5 · 2.0 and marks the current one', () => {
  expect([...MENU_SPEEDS].map(speedChipLabel)).toEqual(['0.75', '1.0', '1.25', '1.5', '2.0']);
  const html = renderToStaticMarkup(<ReelMoreMenu {...base} prefs={{ ...DEFAULT_PREFS, speed: 1.5 }} />);
  const chips = html.match(/role="radio" aria-checked="(true|false)" class="reel-more-menu__chip">([^<]+)</g) ?? [];
  expect(chips.map((c) => c.replace(/.*>([^<]+)</, '$1'))).toEqual(['0.75', '1.0', '1.25', '1.5', '2.0']);
  expect(chips.filter((c) => c.includes('aria-checked="true"')).map((c) => c.replace(/.*>([^<]+)</, '$1'))).toEqual(['1.5']);
  expect(html).not.toContain('>0.5<');
});

test('quality shows the current value and a chevron; captions disable with a hint when the reel has none', () => {
  const auto = renderToStaticMarkup(<ReelMoreMenu {...base} />);
  expect(auto).toContain('class="reel-more-menu__value">Auto<svg');
  const p720 = renderToStaticMarkup(<ReelMoreMenu {...base} prefs={{ ...DEFAULT_PREFS, quality: '720p' }} />);
  expect(p720).toContain('class="reel-more-menu__value">720p<svg');
  const none = renderToStaticMarkup(<ReelMoreMenu {...base} captionsAvailable="no" />);
  expect(none).toContain('None for this reel');
  expect(none).toContain('aria-checked="false" disabled="" data-row="captions"');
  const on = renderToStaticMarkup(<ReelMoreMenu {...base} prefs={{ ...DEFAULT_PREFS, captions: true, onEnd: 'next' }} />);
  expect(on).toContain('aria-checked="true" data-row="auto-scroll"');
  expect(on).toContain('aria-checked="true" data-row="captions"');
  expect((on.match(/reel-more-menu__switch" data-on=""/g) ?? []).length).toBe(2);
});

test('own reel: Delete instead of the relationship and feedback rows; the playback rows stay', () => {
  const html = renderToStaticMarkup(<ReelMoreMenu {...base} isOwn following={undefined} />);
  expect(html).toContain('>Delete reel<');
  for (const gone of ['Block', 'Follow', 'Report', 'Not interested']) expect(html).not.toContain(`>${gone}`);
  for (const key of ['speed', 'quality', 'auto-scroll', 'theater', 'captions']) expect(html).toContain(`data-row="${key}"`);
});

test("TikTok's card in CSS: 320 wide, radius 16, the on-video pair at .92 behind a 12px blur, 44px rows, chips 28, switches 44×24 with a 20px knob", () => {
  const css = readFileSync(resolve(import.meta.dir, '../components/reels-screen.css'), 'utf8');
  expect(css).toContain('.reel-more-menu[role="menu"] { padding: 8px; background: rgb(var(--reel-stage) / .92); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); color: rgb(var(--reel-on-stage)); box-shadow: 0 12px 32px rgb(0 0 0 / .35); }');
  expect(css).toContain('.reel-more-menu[role="menu"] { width: 320px; border-radius: 16px;');
  expect(css).toContain('.reel-more-menu__row { display: flex; width: 100%; height: 44px; align-items: center; gap: 12px; padding: 0 12px; border: 0; border-radius: 10px; background: transparent; color: inherit; font-size: 15px; font-weight: 600;');
  expect(css).toContain('.reel-more-menu__row:hover { background: rgb(var(--reel-on-stage) / .08); }');
  expect(css).toContain('.reel-more-menu__row.is-danger { color: rgb(var(--danger)); }');
  expect(css).toContain('.reel-more-menu__icon { display: inline-flex; flex: 0 0 20px; width: 20px; height: 20px; align-items: center; justify-content: center; color: rgb(var(--reel-on-stage) / .9); }');
  expect(css).toContain('.reel-more-menu__divider { height: 1px; margin: 6px 0; background: rgb(var(--reel-on-stage) / .12); }');
  expect(css).toContain('.reel-more-menu__segmented { display: inline-flex; flex: 0 0 auto; align-items: center; gap: 2px; padding: 2px; border-radius: 999px; background: rgb(var(--reel-on-stage) / .12); }');
  expect(css).toContain('.reel-more-menu__chip { display: inline-flex; height: 28px;');
  expect(css).toContain('.reel-more-menu__chip[aria-checked="true"] { background: rgb(var(--reel-on-stage)); color: rgb(var(--reel-stage)); }');
  expect(css).toContain('.reel-more-menu__switch { position: relative; display: inline-block; flex: 0 0 44px; width: 44px; height: 24px;');
  expect(css).toContain('.reel-more-menu__knob { position: absolute; top: 2px; left: 2px; width: 20px; height: 20px;');
  expect(css).toContain('.reel-more-menu__switch[data-on] { background: rgb(var(--reel-on-stage)); }');
  expect(css).toContain('.reel-more-menu__switch[data-on] .reel-more-menu__knob { background: rgb(var(--reel-stage)); transform: translateX(20px); }');
  // The only literal colour in the block is the black shadow under the dark card.
  const block = css.slice(css.indexOf('.reel-more-menu[role="menu"]'), css.indexOf('.reel-more-menu__switch[data-on] .reel-more-menu__knob'));
  expect(block.match(/#[0-9a-f]{3,8}\b/gi)).toBeNull();
  expect(block.match(/rgba?\((?!var\()[^)]*\)/g)).toEqual(['rgb(0 0 0 / .35)']);
});
