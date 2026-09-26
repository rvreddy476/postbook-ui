import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import MobileBottomNav from '@/components/MobileBottomNav';
import { editorialFormat } from '@/components/feed/editorialFormat';
import type { PostDetail } from '@/types/profile';
import HomePage from '@/app/page';
import FeedPage from '@/app/feed/page';
import CreativeHome from '@/components/home/CreativeHome';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const post = (fields: Partial<PostDetail>) => ({ id: 'post', ...fields } as PostDetail);
describe('editorial presentation is isolated from canonical posts', () => {
  test('plain, photo, video and poll presentations follow actual payloads', () => {
    expect(editorialFormat(post({ text: 'A thought' }))).toBe('text');
    expect(editorialFormat(post({ media: [{ media_id: 'image', kind: 'image' }] }))).toBe('photo');
    expect(editorialFormat(post({ media: [{ media_id: 'video', kind: 'video' }] }))).toBe('video');
    expect(editorialFormat(post({ content_type: 'poll' }))).toBe('poll');
  });
  test('author styling is not overwritten by the editorial text treatment', () => {
    expect(editorialFormat(post({ rich_text: { background: '#123456' } }))).toBe('styled');
    const journal = post({ rich_text: { format: 'tiptap', doc: { type: 'doc', content: [] } } });
    const snapshot = JSON.stringify(journal);
    expect(editorialFormat(journal)).toBe('journal');
    expect(JSON.stringify(journal)).toBe(snapshot);
  });
});
test('default and preserved feed routes have explicit independent surfaces', () => {
  expect(HomePage().props.children.props.initialSurface).toBe('Home');
  expect(FeedPage().props.children.props.initialSurface).toBe('Feed');
  expect(HomePage().props.children.key).not.toBe(FeedPage().props.children.key);
});
test('mobile feed is an actual route link, independently of other page callbacks', () => {
  const html = renderToStaticMarkup(<MobileBottomNav activeTab="Feed" onChange={() => {}} />);
  expect(html).toContain('href="/feed"');
  expect(html).toContain('aria-label="Home"');
  expect(html).toContain('aria-label="Feed" aria-current="page"');
  expect(html).toContain('aria-label="Messenger"');
});

describe('launch Home is a service destination, not another feed', () => {
  const html = () => renderToStaticMarkup(<CreativeHome onCreateClick={() => {}} />);
  test('all entrances resolve to existing web pages; long and short video stay separate', () => {
    const markup = html();
    const paths = [...markup.matchAll(/href="([^"]+)"/g)].map(match => match[1]);
    for (const path of paths) {
      expect(existsSync(join(process.cwd(), 'src/app', path, 'page.tsx'))).toBe(true);
    }
    for (const path of ['/feed', '/messenger', '/groups', '/reels', '/posttube', '/saved', '/posttube/history']) {
      expect(paths).toContain(path);
    }
    expect(paths.filter(path => path === '/feed')).toHaveLength(1);
  });
  test('renders without providers, account data, posts or media downloads', () => {
    const markup = html();
    expect(markup).toContain('<h1>Home</h1>');
    expect(markup).not.toMatch(/<(video|audio|img)\b/);
    expect(markup).not.toContain('home-feed');
    expect(markup).not.toContain('post-card');
  });
  test('future services are labelled non-actionable and disclosure is closed initially', () => {
    const markup = html();
    expect(markup).toContain('In development · not available yet');
    expect(markup).toContain('<details class="home-directory">');
    expect(markup).not.toMatch(/href="[^\"]*(commerce|mopedu|food|wallet|dating)/);
  });
  test('create retains the existing composer callback', () => {
    let calls = 0;
    const tree = CreativeHome({ onCreateClick: () => { calls++; } });
    const header = tree.props.children[0];
    header.props.children[1].props.onClick();
    expect(calls).toBe(1);
  });
});
