import { expect, test } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { toReelItem } from '../model';
import { ReelMoreMenu, speedChipLabel, speedValueLabel } from '../components/ReelMoreMenu';
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
  onClearScreen: noop, onNotInterested: noop, onDontRecommend: noop, onReport: noop,
};

test("ascending alphabetical, always: Audio track, Auto scroll, Captions, Description, Don't recommend, Not interested, Playback speed, Quality, Report", () => {
  const html = renderToStaticMarkup(<ReelMoreMenu {...base} anchor="below" />);
  const marks = ['data-row="audio"', 'data-row="auto-scroll"', 'data-row="captions"', 'data-row="description"', 'data-row="dont-recommend"', 'data-row="not-interested"', 'data-row="speed"', 'data-row="quality"', 'data-row="report"'];
  const at = marks.map((m) => html.indexOf(m));
  for (const [i, pos] of at.entries()) expect(pos, marks[i]).toBeGreaterThan(-1);
  expect([...at].sort((a, b) => a - b)).toEqual(at);
  // Audio track is offered even with nothing but the original; the value is the current track.
  expect(html).toContain('class="reel-more-menu__value">Original<svg');
  expect(html).toContain('class="reel-more-menu__value">Off<svg');
  expect(html).toContain('class="reel-more-menu__value">Normal<svg');
  expect(html).toContain('class="reel-more-menu__value">Auto<svg');
  expect(html).toContain('role="menuitemcheckbox" aria-checked="false" data-row="auto-scroll"');
  expect(html).toContain("Don&#x27;t recommend this channel");
  expect(html).toContain('class="reel-more-menu__row is-danger"');
  expect(html).not.toContain('role="radiogroup"');
  // One audio row only, never a second "Audio tracks" row.
  expect((html.match(/data-row="audio"/g) ?? []).length).toBe(1);
  expect(html).not.toContain('data-row="manage-audio"');
  expect(html).toContain('reel-frame-popover');
});

test('the speed value reads Normal at 1× and the chip labels are 0.25 · 1.0 · 1.25 · 1.5 · 2.0', () => {
  expect([...MENU_SPEEDS].map(speedChipLabel)).toEqual(['0.25', '1.0', '1.25', '1.5', '2.0']);
  expect(speedValueLabel(1)).toBe('Normal');
  expect(speedValueLabel(1.5)).toBe('1.5x');
  expect(speedValueLabel(1.05)).toBe('1.05x');
  const html = renderToStaticMarkup(<ReelMoreMenu {...base} prefs={{ ...DEFAULT_PREFS, speed: 1.5 }} />);
  expect(html).toContain('class="reel-more-menu__value">1.5x<svg');
});

test('quality and captions show their current value; captions is disabled with None when the reel has none', () => {
  const p720 = renderToStaticMarkup(<ReelMoreMenu {...base} prefs={{ ...DEFAULT_PREFS, quality: '720p' }} />);
  expect(p720).toContain('class="reel-more-menu__value">720p<svg');
  const none = renderToStaticMarkup(<ReelMoreMenu {...base} captionsAvailable="no" />);
  expect(none).toContain('disabled="" data-row="captions"');
  expect(none).toContain('class="reel-more-menu__value">None<svg');
  const on = renderToStaticMarkup(<ReelMoreMenu {...base} prefs={{ ...DEFAULT_PREFS, captions: true, onEnd: 'next' }} />);
  expect(on).toContain('class="reel-more-menu__value">On<svg');
  expect(on).toContain('aria-checked="true" data-row="auto-scroll"');
  expect((on.match(/reel-more-menu__switch" data-on=""/g) ?? []).length).toBe(1);
});

test('the owner sees one Audio track row (manage lives inside its pane) and no feedback rows', () => {
  const html = renderToStaticMarkup(<ReelMoreMenu {...base} isOwn following={undefined} onManageAudio={() => {}} audioTracks={[{ id: 'original', label: 'Original' }, { id: 't1', label: 'Hindi' }, { id: 't2', label: 'Tamil' }]} currentAudioTrack="t1" />);
  expect((html.match(/data-row="audio"/g) ?? []).length).toBe(1);
  expect(html).toContain('class="reel-more-menu__value">Hindi<svg');
  expect(html).not.toContain('data-row="manage-audio"');
  for (const gone of ['data-row="report"', 'data-row="not-interested"', 'data-row="dont-recommend"']) expect(html).not.toContain(gone);
});

test("the card in CSS: the theme surface, radius 12, 4px padding, 40px rows 12px in with a 20px icon and 14/500 labels, 12px values; the speed pane; no literal colours but the shadow", () => {
  const css = readFileSync(resolve(import.meta.dir, '../components/reels-screen.css'), 'utf8');
  expect(css).toContain('.reel-more-menu[role="menu"] { padding: 4px; background: rgb(var(--brand-card)); color: rgb(var(--brand-text)); box-shadow: 0 12px 32px rgb(0 0 0 / .28); }');
  expect(css).toContain('.reel-more-menu[role="menu"] { width: 100%; border-radius: 12px;');
  expect(css).toContain('.reel-more-menu__row { display: flex; width: 100%; min-width: 0; height: 40px; align-items: center; gap: 10px; padding: 0 12px; border: 0; border-radius: 8px; background: transparent; color: inherit; font-size: 14px; font-weight: 500;');
  expect(css).toContain('.reel-more-menu__icon { display: inline-flex; flex: 0 0 20px; width: 20px; height: 20px;');
  expect(css).toContain('.reel-more-menu__value { display: inline-flex; flex: 0 0 auto; align-items: center; gap: 2px; font-size: 12px; font-weight: 400; color: rgb(var(--brand-text) / .6); }');
  expect(css).toContain('.reel-speed-panel__readout { font-size: 20px; font-weight: 700;');
  expect(css).toContain('.reel-speed-panel__slider input[type="range"] { flex: 1 1 auto; min-width: 0; height: 4px; margin: 0; accent-color: rgb(var(--brand-text)); cursor: pointer; }');
  expect(css).toContain('.reel-more-menu__chip { display: inline-flex; height: 30px;');
  expect(css).toContain('.reel-more-menu__switch { position: relative; display: inline-block; flex: 0 0 40px; width: 40px; height: 22px;');
  const block = css.slice(css.indexOf('.reel-more-menu[role="menu"]'), css.indexOf('.reel-speed-panel__normal'));
  expect(block.match(/#[0-9a-f]{3,8}\b/gi)).toBeNull();
  expect(block.match(/rgba?\((?!var\()[^)]*\)/g)).toEqual(['rgb(0 0 0 / .28)']);
});

test('own reel: no Report or Not interested; the playback rows stay; Theater is not a row', () => {
  const html = renderToStaticMarkup(<ReelMoreMenu {...base} isOwn following={undefined} />);
  for (const gone of ['Block', 'Follow', 'Report', 'Not interested', 'Delete reel', 'Theater mode', 'Copy link']) expect(html).not.toContain(`>${gone}`);
  for (const key of ['audio', 'speed', 'quality', 'auto-scroll', 'captions']) expect(html).toContain(`data-row="${key}"`);
  expect(html).not.toContain('data-row="theater"');
});
