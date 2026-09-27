import { expect, test } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { CreateButton, createMenuItems } from '../components/CreateButton';

test('Create offers exactly two rows: Photos → /create/post, Videos → the reel composer inside Reels, the PostTube upload elsewhere', () => {
  expect(createMenuItems('/reels').map((i) => [i.label, i.href])).toEqual([['Photos', '/create/post'], ['Videos', '/reels/create']]);
  expect(createMenuItems('/reels/abc').map((i) => i.href)).toEqual(['/create/post', '/reels/create']);
  expect(createMenuItems('/posttube').map((i) => [i.label, i.href])).toEqual([['Photos', '/create/post'], ['Videos', '/posttube/upload?type=long']]);
  expect(createMenuItems('/posttube/watch/1').map((i) => i.href)).toEqual(['/create/post', '/posttube/upload?type=long']);
  expect(createMenuItems(null).map((i) => i.href)).toEqual(['/create/post', '/posttube/upload?type=long']);
  expect(createMenuItems('/reelsfeed').map((i) => i.href)[1]).toBe('/reels/create');
  expect(createMenuItems('/').map((i) => i.hint)).toEqual(['Post photos', 'Upload a video or reel']);
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
