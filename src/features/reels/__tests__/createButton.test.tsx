import { expect, test } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PathnameContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';

import { CreateButton, createMenuContext, createMenuItems } from '../components/CreateButton';

/** usePathname() reads this context; outside the app router it is null. */
function at(pathname: string, node: React.ReactNode) {
  return renderToStaticMarkup(<PathnameContext.Provider value={pathname}>{node}</PathnameContext.Provider>);
}

test('Create offers two rows outside PostTube: Photos → /create/post, Videos → the reel composer inside Reels, the PostTube upload elsewhere', () => {
  expect(createMenuItems('/reels').map((i) => [i.label, i.href])).toEqual([['Photos', '/create/post'], ['Videos', '/reels/create']]);
  expect(createMenuItems('/reels/abc').map((i) => i.href)).toEqual(['/create/post', '/reels/create']);
  expect(createMenuItems(null).map((i) => i.href)).toEqual(['/create/post', '/posttube/upload?type=long']);
  expect(createMenuItems('/').map((i) => [i.label, i.href])).toEqual([['Photos', '/create/post'], ['Videos', '/posttube/upload?type=long']]);
  expect(createMenuItems('/feed').map((i) => i.href)).toEqual(['/create/post', '/posttube/upload?type=long']);
  expect(createMenuItems('/reelsfeed').map((i) => i.href)[1]).toBe('/reels/create');
  expect(createMenuItems('/').map((i) => i.hint)).toEqual(['Post photos', 'Upload a video or reel']);
  expect(createMenuItems('/reels').map((i) => i.hint)).toEqual(['Post photos', 'Upload a video or reel']);
});

test('the context comes from the pathname: /reels* → reels, /posttube* and the /tube alias → posttube, anything else → default', () => {
  expect(createMenuContext('/reels')).toBe('reels');
  expect(createMenuContext('/reels/create')).toBe('reels');
  expect(createMenuContext('/posttube')).toBe('posttube');
  expect(createMenuContext('/posttube/watch/1')).toBe('posttube');
  expect(createMenuContext('/posttube/channel')).toBe('posttube');
  expect(createMenuContext('/tube')).toBe('posttube');
  expect(createMenuContext('/tube/watch/1')).toBe('posttube');
  // Only the real prefixes: a sibling route that merely starts with the letters is not PostTube.
  expect(createMenuContext('/posttubers')).toBe('default');
  expect(createMenuContext('/tubes')).toBe('default');
  expect(createMenuContext('/')).toBe('default');
  expect(createMenuContext('/feed')).toBe('default');
  expect(createMenuContext(null)).toBe('default');
  expect(createMenuContext(undefined)).toBe('default');
});

test('inside PostTube the menu offers what a creator can make there: five rows, alphabetical, each to a real route', () => {
  const expected: [string, string, string][] = [
    ['Create post', 'A text or photo post', '/create/post'],
    ['Go live', 'Start a live stream', '/live/new'],
    ['New collection', 'Group videos into a list', '/posttube/playlists?new=1'],
    ['New podcast', 'Upload an episode', '/posttube/upload?type=podcast'],
    ['Upload video', 'Publish a long video', '/posttube/upload?type=long'],
  ];
  for (const path of ['/posttube', '/posttube/watch/1', '/posttube/channel', '/posttube/hub/library', '/tube', '/tube/watch/1']) {
    const rows = createMenuItems(path);
    expect(rows.map((i) => [i.label, i.hint, i.href])).toEqual(expected);
    // Ascending alphabetical, the standing rule for menus.
    const labels = rows.map((i) => i.label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
    // Our words: Collections, never Playlist.
    for (const row of rows) expect(row.label + row.hint).not.toMatch(/playlist/i);
  }
  expect(createMenuItems('/posttube').map((i) => i.key)).toEqual(['post', 'live', 'collection', 'podcast', 'upload']);
});

test('the open menu on a PostTube page renders the five rows as links with role=menuitem and their icons', () => {
  const html = at('/posttube/watch/1', <CreateButton variant="pill" defaultOpen />);
  expect((html.match(/role="menuitem"/g) ?? []).length).toBe(5);
  expect(html).toContain('<a role="menuitem" class="create-menu__row" data-row="post" href="/create/post">');
  expect(html).toContain('<a role="menuitem" class="create-menu__row" data-row="live" href="/live/new">');
  expect(html).toContain('<a role="menuitem" class="create-menu__row" data-row="collection" href="/posttube/playlists?new=1">');
  expect(html).toContain('<a role="menuitem" class="create-menu__row" data-row="podcast" href="/posttube/upload?type=podcast">');
  expect(html).toContain('<a role="menuitem" class="create-menu__row" data-row="upload" href="/posttube/upload?type=long">');
  for (const label of ['Create post', 'Go live', 'New collection', 'New podcast', 'Upload video']) expect(html).toContain(`>${label}<`);
  for (const icon of ['lucide-pen-line', 'lucide-radio', 'lucide-list-plus', 'lucide-mic', 'lucide-upload']) expect(html).toContain(icon);
  // The order in the DOM is the alphabetical order of the data.
  const pos = (row: string) => html.indexOf(`data-row="${row}"`);
  expect(pos('post')).toBeLessThan(pos('live'));
  expect(pos('live')).toBeLessThan(pos('collection'));
  expect(pos('collection')).toBeLessThan(pos('podcast'));
  expect(pos('podcast')).toBeLessThan(pos('upload'));
  for (const gone of ['Photos', 'Videos', 'Playlist', 'New playlist']) expect(html).not.toContain(`>${gone}<`);
  // Reels keeps its two rows.
  const reels = at('/reels', <CreateButton variant="pill" defaultOpen />);
  expect((reels.match(/role="menuitem"/g) ?? []).length).toBe(2);
  expect(reels).toContain('data-row="videos" href="/reels/create"');
});

test('the pill reads Create with a Plus at the left and a chevron at the right; the open menu is two links with role=menuitem', () => {
  // Outside the app router usePathname() is null → the PostTube destinations.
  const html = renderToStaticMarkup(<CreateButton variant="pill" defaultOpen />);
  expect(html).toContain('class="context-app-bar__create" aria-label="Create" aria-haspopup="menu" aria-expanded="true"');
  const plus = html.indexOf('context-app-bar__create-plus');
  const label = html.indexOf('>Create<');
  const chevron = html.indexOf('context-app-bar__create-chevron');
  expect(plus).toBeGreaterThan(-1);
  expect(plus).toBeLessThan(label);
  expect(label).toBeLessThan(chevron);
  expect(html).toContain('role="menu" aria-label="Create new"');
  expect((html.match(/role="menuitem"/g) ?? []).length).toBe(2);
  expect(html).toContain('<a role="menuitem" class="create-menu__row" data-row="photos" href="/create/post">');
  expect(html).toContain('<a role="menuitem" class="create-menu__row" data-row="videos" href="/posttube/upload?type=long">');
  expect(html).toContain('>Photos<');
  expect(html).toContain('>Post photos<');
  expect(html).toContain('>Videos<');
  expect(html).toContain('>Upload a video or reel<');
  expect(html).toContain('lucide-image-plus');
  expect(html).toContain('lucide-clapperboard');
  for (const gone of ['Live', 'Podcast', 'Create Post', 'Reel / Clip']) expect(html).not.toContain(`>${gone}<`);
  // Closed by default.
  expect(renderToStaticMarkup(<CreateButton variant="pill" />)).not.toContain('role="menu"');
});

test('menu style: 240 wide, radius 14, the card surface, 44px rows', () => {
  const css = readFileSync(resolve(import.meta.dir, '../components/app-bar.css'), 'utf8');
  expect(css).toContain('.create-menu { position: absolute; right: 0; top: calc(100% + 8px); z-index: 100; width: 240px; padding: 6px; border: 1px solid var(--brand-divider); border-radius: 14px; background: rgb(var(--brand-card)); color: rgb(var(--brand-text));');
  expect(css).toContain('.create-menu__row { display: flex; width: 100%; height: 44px;');
  expect(css).toContain('.context-app-bar__create-chevron { width: 16px; height: 16px;');
});
