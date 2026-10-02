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
const TRACKS = [{ id: 'original', label: 'Original' }, { id: 't1', label: 'Hindi' }, { id: 't2', label: 'Tamil' }];
/* A reel with everything: three audio tracks, captions, two renditions, downloads allowed. */
const base = {
  open: true, onClose: noop, reel: { ...other, downloadAllowed: true, reasonText: 'Popular' }, isOwn: false,
  prefs: DEFAULT_PREFS, onPrefsChange: noop, qualityHeights: [720, 1080], hasCaptions: true,
  audioTracks: TRACKS, currentAudioTrack: 'original', onAudioTrack: noop, onKeep: noop,
  onCopyLink: noop, onDescription: noop, onShare: noop, onBlock: noop, onDelete: noop,
  onNotInterested: noop, onDontRecommend: noop, onReport: noop, onUseSound: noop,
};

const drawnLabels = (html: string) =>
  html.split('<span class="reel-more-menu__title">').slice(1).map((part) => part.slice(0, part.indexOf('<')).split('&#x27;').join("'"));

test("ascending alphabetical, always: the shared rows (the same as long video) plus Auto scroll and Use this sound", () => {
  const html = renderToStaticMarkup(<ReelMoreMenu {...base} anchor="below" />);
  expect(drawnLabels(html)).toEqual([
    'Audio track', 'Auto scroll', 'Block Bee', 'Captions', 'Copy link', 'Description', "Don't recommend this channel",
    'Keep a copy', 'Not interested', 'Playback speed', 'Quality', 'Report', 'Share', 'Use this sound',
  ]);
  const marks = ['audio', 'auto-scroll', 'block', 'captions', 'copy-link', 'description', 'dont-recommend', 'keep', 'not-interested', 'speed', 'quality', 'report', 'share', 'use-sound'].map((k) => `data-row="${k}"`);
  const at = marks.map((m) => html.indexOf(m));
  for (const [i, pos] of at.entries()) expect(pos, marks[i]).toBeGreaterThan(-1);
  expect([...at].sort((a, b) => a - b)).toEqual(at);
  expect(html).toContain('class="reel-more-menu__value">Original<svg');
  expect(html).toContain('class="reel-more-menu__value">Off<svg');
  expect(html).toContain('class="reel-more-menu__value">Normal<svg');
  expect(html).toContain('class="reel-more-menu__value">Auto<svg');
  expect(html).toContain('role="menuitemcheckbox" aria-checked="false" data-row="auto-scroll"');
  expect(html).toContain("Don&#x27;t recommend this channel");
  // Block, Report: the danger rows.
  expect((html.match(/class="reel-more-menu__row is-danger"/g) ?? []).length).toBe(2);
  expect(html).not.toContain('role="radiogroup"');
  expect((html.match(/data-row="audio"/g) ?? []).length).toBe(1);
  expect(html).not.toContain('data-row="manage-audio"');
  expect(html).toContain('reel-frame-popover');
});

test('a row appears only when it can work: one audio track, no captions, one rendition, sharing off, downloads off', () => {
  const single = renderToStaticMarkup(<ReelMoreMenu {...base} audioTracks={[TRACKS[0]]} />);
  expect(single).not.toContain('data-row="audio"');
  const noCaptions = renderToStaticMarkup(<ReelMoreMenu {...base} hasCaptions={false} />);
  expect(noCaptions).not.toContain('data-row="captions"');
  const oneRung = renderToStaticMarkup(<ReelMoreMenu {...base} qualityHeights={[720]} />);
  expect(oneRung).not.toContain('data-row="quality"');
  const noShare = renderToStaticMarkup(<ReelMoreMenu {...base} reel={{ ...base.reel, shareHidden: true }} />);
  expect(noShare).not.toContain('data-row="share"');
  expect(noShare).toContain('data-row="copy-link"');
  const noDownload = renderToStaticMarkup(<ReelMoreMenu {...base} reel={{ ...base.reel, downloadAllowed: false }} />);
  expect(noDownload).not.toContain('data-row="keep"');
  // No download link at all: the row is left out rather than drawn dead.
  const noLink = renderToStaticMarkup(<ReelMoreMenu {...base} onKeep={undefined} />);
  expect(noLink).not.toContain('data-row="keep"');
});

test('the speed value reads Normal at 1× and the chip labels are 0.25 · 1.0 · 1.25 · 1.5 · 2.0', () => {
  expect([...MENU_SPEEDS].map(speedChipLabel)).toEqual(['0.25', '1.0', '1.25', '1.5', '2.0']);
  expect(speedValueLabel(1)).toBe('Normal');
  expect(speedValueLabel(1.5)).toBe('1.5x');
  expect(speedValueLabel(1.05)).toBe('1.05x');
  const html = renderToStaticMarkup(<ReelMoreMenu {...base} prefs={{ ...DEFAULT_PREFS, speed: 1.5 }} />);
  expect(html).toContain('class="reel-more-menu__value">1.5x<svg');
});

test('quality, captions and audio show their current value; Auto scroll is a switch', () => {
  const p720 = renderToStaticMarkup(<ReelMoreMenu {...base} prefs={{ ...DEFAULT_PREFS, quality: '720p' }} />);
  expect(p720).toContain('class="reel-more-menu__value">720p<svg');
  const on = renderToStaticMarkup(<ReelMoreMenu {...base} prefs={{ ...DEFAULT_PREFS, captions: true, onEnd: 'next' }} />);
  expect(on).toContain('class="reel-more-menu__value">On<svg');
  expect(on).toContain('aria-checked="true" data-row="auto-scroll"');
  expect((on.match(/reel-more-menu__switch" data-on=""/g) ?? []).length).toBe(1);
  const hindi = renderToStaticMarkup(<ReelMoreMenu {...base} currentAudioTrack="t1" />);
  expect(hindi).toContain('class="reel-more-menu__value">Hindi<svg');
});

test('own reel: Audio tracks and Delete, no Edit, no feedback rows; the playback rows stay; Theater is not a row', () => {
  const html = renderToStaticMarkup(<ReelMoreMenu {...base} isOwn onManageAudio={noop} currentAudioTrack="t1" />);
  expect(drawnLabels(html)).toEqual([
    'Audio track', 'Audio tracks', 'Auto scroll', 'Captions', 'Copy link', 'Delete', 'Description', 'Keep a copy', 'Playback speed', 'Quality', 'Share', 'Use this sound',
  ]);
  expect((html.match(/data-row="audio"/g) ?? []).length).toBe(1);
  expect((html.match(/data-row="manage-audio"/g) ?? []).length).toBe(1);
  for (const gone of ['block', 'report', 'not-interested', 'dont-recommend', 'edit', 'theater']) expect(html).not.toContain(`data-row="${gone}"`);
  // Without the audio dialog there is no Audio tracks row.
  const noDialog = renderToStaticMarkup(<ReelMoreMenu {...base} isOwn />);
  expect(noDialog).not.toContain('data-row="manage-audio"');
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

test('Use this sound: last in the list, one row, gone when the creator turned reuse off, waiting while the request runs', () => {
  const html = renderToStaticMarkup(<ReelMoreMenu {...base} />);
  expect((html.match(/data-row="use-sound"/g) ?? []).length).toBe(1);
  expect(html).toContain('<span class="reel-more-menu__title">Use this sound</span>');
  expect(html.indexOf('data-row="use-sound"')).toBeGreaterThan(html.indexOf('data-row="share"'));
  const labels = drawnLabels(html);
  expect(labels.length).toBeGreaterThan(8);
  expect([...labels].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))).toEqual(labels);
  const locked = renderToStaticMarkup(<ReelMoreMenu {...base} reel={{ ...base.reel, soundReuseAllowed: false }} />);
  expect(locked).not.toContain('data-row="use-sound"');
  const own = renderToStaticMarkup(<ReelMoreMenu {...base} isOwn reel={{ ...base.reel, soundReuseAllowed: false }} />);
  expect(own).toContain('data-row="use-sound"');
  const pending = renderToStaticMarkup(<ReelMoreMenu {...base} useSoundPending />);
  expect(pending).toContain('disabled="" data-row="use-sound"');
});
