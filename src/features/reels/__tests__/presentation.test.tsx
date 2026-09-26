import { expect, test } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient } from '@tanstack/react-query';
import { toReelItem } from '../model';
import { ReelOverlay } from '../components/ReelOverlay';
import { RAIL_ORDER, ReelRail } from '../components/ReelRail';
import { ReelAuthorCard } from '../components/ReelAuthorCard';
import { ReelExpandedDetails } from '../components/ReelExpandedDetails';
import { COMMENTS_COLUMN_WIDTH, COMMENTS_TRACK_WIDTH } from '../stage';
import { ReelSettingsMenu } from '../components/ReelSettingsMenu';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { patchReelEverywhere } from '../hooks/useReelFeed';
import { refreshCommentSurfaces } from '@/lib/commentCache';

const reel = toReelItem({id:'r1',author_id:'a',title:'Actual title',text:'Description belongs in details',content_type:'reel',counts:{comments:0},media:[{media_id:'m',kind:'video'}]})!;

test('settings anchor below the control bar, not off the left of the portrait frame', () => {
  const html=renderToStaticMarkup(<ReelSettingsMenu open onClose={()=>{}} prefs={{quality:'auto',speed:1,captions:false,onEnd:'loop',sound:false}} onChange={()=>{}} qualityHeights={[720]} captionsAvailable="unknown"/>);
  expect(html).toContain('reel-settings-popover');
  expect(html).not.toContain('md:right-full');
  for(const label of ['Quality','Playback speed','Captions','Auto-advance']) expect(html).toContain(label);
  const css=readFileSync(resolve(import.meta.dir,'../components/reels-screen.css'),'utf8');
  expect(css).toContain('width: 280px');
  expect(css).toContain('top: calc(100% + 8px)');
  // The gear now sits beside the sound control at the top-left, so its card hangs from the left edge.
  expect(css).toContain('.reel-settings-slot .reel-settings-popover[role="menu"] { left: 0; right: auto; }');
});

test('expanded details carry creator and title but never public view counts', () => {
  const html=renderToStaticMarkup(<ReelExpandedDetails reel={reel}/>);
  expect(html).toContain('reel-expanded-details');
  expect(html).toContain('Actual title');
  expect(html).toContain('/u/a');
  expect(html).not.toContain('views');
  expect(html).not.toContain('Description belongs in details');
});

test('reel title is separate from its description, never synthesized from description', () => {
  expect(reel.title).toBe('Actual title');
  expect(reel.caption).toBe('Description belongs in details');
  expect(toReelItem({id:'r2',author_id:'a',text:'Not a title',content_type:'reel',media:[{media_id:'m',kind:'video'}]})!.title).toBe('');
});
test('overlay always carries the author name (a plain link), title, caption and view count; never a Follow pill or a hover anchor', () => {
  const html=renderToStaticMarkup(<ReelOverlay reel={reel} sound={false} volume={1} onVolumeChange={()=>{}} onToggleSound={()=>{}} onOpenSettings={()=>{}}/>);
  expect(html).toContain('Actual title');
  expect(html).toContain('Description belongs in details');
  expect(html).toContain('reel-view-count');
  expect(html).toContain('0 views');
  expect(html).toContain('class="reel-author-row__name" href="/u/a"');
  expect(html).not.toContain('reel-follow-pill');
  expect(html).not.toContain('aria-haspopup="dialog"');
  // TikTok's bottom-left block: 12px in, 16px up, 381px wide at most; the sound control 8px in, 40px square.
  expect(html).toContain('class="reel-overlay-text"');
  const css=readFileSync(resolve(import.meta.dir,'../components/reels-screen.css'),'utf8');
  expect(css).toContain('.reel-overlay-text { max-width: 381px;');
  expect(css).toContain('.reel-overlay-details { pointer-events: none; position: absolute; inset: auto 0 0 0; z-index: 10; padding: 64px 80px 16px 12px;');
  expect(css).toContain('.reel-author-row__name { min-width: 0; font-size: 18px; font-weight: 700;');
  expect(css).toContain('.reel-hashtags { margin: 4px 0 0; display: flex; flex-wrap: wrap; gap: 0 8px; font-size: 14px; font-weight: 700;');
  expect(css).toContain('.reel-view-count { margin: 6px 0 0; font-size: 12px; font-weight: 600; color: rgb(var(--reel-on-stage) / .7);');
  expect(css).toContain('.reel-playback-controls { position: absolute; left: 8px; top: 8px;');
  expect(css).toContain('.reel-playback-button { pointer-events: auto; display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px;');
});

test('frame top-right is More then Cinema, 48px circles 8px in; the old bottom-right expand button is gone', () => {
  const css=readFileSync(resolve(import.meta.dir,'../components/reels-screen.css'),'utf8');
  const screen=readFileSync(resolve(import.meta.dir,'../components/ReelsScreen.tsx'),'utf8');
  expect(css).toContain('.reel-frame-actions { position: absolute; top: 8px; right: 8px; z-index: 30; display: flex; align-items: center; gap: 8px; }');
  expect(css).toContain('.reel-frame-action { display: flex; width: 48px; height: 48px; align-items: center; justify-content: center; border-radius: 50%; background: rgb(var(--reel-stage) / .35); color: rgb(var(--reel-on-stage));');
  expect(css).not.toContain('reel-expand-button');
  expect(screen).not.toContain('reel-expand-button');
  expect(screen).not.toContain('reel-rail-spacer');
  expect(screen).not.toContain('Maximize2');
  // More first (right 56), then Cinema at the far right; More opens the existing menu below its circle.
  const more=screen.indexOf('aria-label="More"');
  const cinema=screen.indexOf('aria-label="Theater mode"');
  expect(more).toBeGreaterThan(-1);
  expect(cinema).toBeGreaterThan(more);
  expect(screen).toContain('moreMenuFor("below")');
  // The desktop rail no longer carries More; the phone rail keeps its own.
  expect(css).toContain('.reel-frame-action-wrap.is-more { display: none; }');
});

const other=toReelItem({id:'r3',author_id:'b',content_type:'reel',author:{id:'b',username:'bee',display_name:'Bee'},media:[{media_id:'m',kind:'video'}]})!;
const railBase={reel:other,isOwn:false,followPending:false,onToggleFollow:()=>{},onLike:()=>{},onComments:()=>{},onShare:()=>{},onSave:()=>{},onMore:()=>{}};

test('rail avatar: a plain profile link with the Follow badge attached; the badge goes once followed, on an own reel, or while unknown', () => {
  const notFollowing=renderToStaticMarkup(<ReelRail {...railBase} following={false}/>);
  expect(notFollowing).toContain('reel-rail-avatar-wrap');
  expect(notFollowing).toContain('class="reel-rail-avatar" aria-label="Bee&#x27;s profile" href="/u/bee"');
  expect(notFollowing).toContain('class="reel-rail-follow"');
  expect(notFollowing).toContain('lucide-plus');
  expect(notFollowing).toContain('aria-label="Follow Bee"');
  expect(notFollowing).not.toContain('aria-haspopup="dialog"');
  expect(renderToStaticMarkup(<ReelRail {...railBase} following={true}/>)).not.toContain('reel-rail-follow');
  expect(renderToStaticMarkup(<ReelRail {...railBase} following={undefined}/>)).not.toContain('reel-rail-follow');
  expect(renderToStaticMarkup(<ReelRail {...railBase} isOwn following={false}/>)).not.toContain('reel-rail-follow');
});

test('rail badge subscribes instead when the reel came through a channel, and still reads Follow', () => {
  const channelReel={...other,channelHandle:'bees'};
  const base={...railBase,reel:channelReel,following:false as const,onToggleSubscribe:()=>{}};
  const unsubscribed=renderToStaticMarkup(<ReelRail {...base} subscribed={false}/>);
  expect(unsubscribed).toContain('lucide-plus');
  expect(unsubscribed).toContain('aria-label="Subscribe to Bee&#x27;s channel"');
  expect(renderToStaticMarkup(<ReelRail {...base} subscribed={true}/>)).not.toContain('reel-rail-follow');
  expect(renderToStaticMarkup(<ReelRail {...base} subscribed={undefined}/>)).not.toContain('reel-rail-follow');
});

test('the phone rail carries the same avatar and badge, and keeps its More', () => {
  const html=renderToStaticMarkup(<ReelRail {...railBase} variant="phone" following={false}/>);
  expect(html).toContain('reel-action-rail is-phone');
  expect(html).toContain('reel-rail-avatar-wrap');
  expect(html).toContain('lucide-plus');
  expect(html).toContain('aria-label="More"');
  expect(renderToStaticMarkup(<ReelRail {...railBase} variant="phone" following={false} onMore={undefined}/>)).not.toContain('aria-label="More"');
});

test('desktop rail reads Share, Save, Comments, Like, Avatar from the bottom — no More — as 48px circles with counts 6px under', () => {
  expect([...RAIL_ORDER].reverse()).toEqual(['share','save','comments','like','avatar']);
  const html=renderToStaticMarkup(<ReelRail {...railBase} following={false}/>);
  const order=['reel-rail-avatar','aria-label="Like"','aria-label="Comments"','aria-label="Save"','aria-label="Share"'].map((m)=>html.indexOf(m));
  for(const at of order) expect(at).toBeGreaterThan(-1);
  expect([...order].sort((a,b)=>a-b)).toEqual(order);
  expect(html).not.toContain('aria-label="More"');
  expect(html).not.toContain('lucide-ellipsis');
  const css=readFileSync(resolve(import.meta.dir,'../components/reels-screen.css'),'utf8');
  expect(css).toContain('.reel-action-rail.is-desktop { gap: 0; padding: 0; border: 0; border-radius: 0; background: transparent; width: var(--reel-rail-w); }');
  expect(css).toContain('.reel-action-rail.is-desktop .reel-action-button { gap: 6px; width: var(--reel-rail-w); min-width: 0; min-height: 0; padding: 0 0 8px;');
  expect(css).toContain('.reel-action-rail.is-desktop .reel-action-icon { width: 48px; height: 48px; border-radius: 50%; background: rgb(var(--brand-secondary));');
  expect(css).toContain('.reel-action-rail.is-desktop .reel-action-count { font-size: 12px; line-height: 16px; font-weight: 700;');
  expect(css).toContain('.reel-action-rail.is-desktop .reel-action-button.is-liked .reel-action-icon { color: rgb(var(--danger)); }');
  expect(css).toContain('.reel-action-rail.is-desktop .reel-action-button.is-saved .reel-action-icon { color: rgb(var(--brand-accent)); }');
  // The plus badge: 24×24, accent, centred on the avatar's bottom edge (top = avatar top + 36 → 20px to the Like circle).
  expect(css).toContain('width: 24px; height: 24px; padding: 0; border: 0; border-radius: 24px; background: rgb(var(--brand-accent));');
  expect(css).toContain('.reel-action-rail.is-desktop .reel-rail-avatar-wrap { padding-bottom: 20px; }');
  expect(css).toContain('.reel-action-rail.is-desktop .reel-rail-follow { bottom: 8px; }');
});

test('the author card: avatar, name link, handle, Follow pill (Following outlined, Subscribe for a channel, nothing when own), counts row', () => {
  const base={reel:other,isOwn:false,followPending:false,onToggleFollow:()=>{},onLike:()=>{},onSave:()=>{},onShare:()=>{}};
  const notFollowing=renderToStaticMarkup(<ReelAuthorCard {...base} following={false}/>);
  expect(notFollowing).toContain('class="reel-author-card__name" href="/u/bee"');
  expect(notFollowing).toContain('@bee');
  expect(notFollowing).toContain('class="reel-panel-follow "');
  expect(notFollowing).toContain('>Follow<');
  expect(renderToStaticMarkup(<ReelAuthorCard {...base} following={true}/>)).toContain('class="reel-panel-follow is-on"');
  expect(renderToStaticMarkup(<ReelAuthorCard {...base} following={undefined}/>)).not.toContain('reel-panel-follow');
  expect(renderToStaticMarkup(<ReelAuthorCard {...base} isOwn following={false}/>)).not.toContain('reel-panel-follow');
  expect(renderToStaticMarkup(<ReelAuthorCard {...base} reel={{...other,channelHandle:'bees'}} following={false} subscribed={false} onToggleSubscribe={()=>{}}/>)).toContain('>Subscribe<');
  for(const label of ['aria-label="Like"','aria-label="0 comments"','aria-label="Save"','aria-label="Share"']) expect(notFollowing).toContain(label);
  const counts=['aria-label="Like"','aria-label="0 comments"','aria-label="Save"','aria-label="Share"'].map((m)=>notFollowing.indexOf(m));
  expect([...counts].sort((a,b)=>a-b)).toEqual(counts);
  // Both the theater panel and the comments column draw it rather than their own copy.
  expect(readFileSync(resolve(import.meta.dir,'../components/ReelTheaterPanel.tsx'),'utf8')).toContain('<ReelAuthorCard');
  const drawer=readFileSync(resolve(import.meta.dir,'../components/ReelCommentsDrawer.tsx'),'utf8');
  expect(drawer).toContain('<ReelAuthorCard');
  expect(drawer.indexOf('reel-comments-panel__author')).toBeLessThan(drawer.indexOf('reel-comments-head'));
  const css=readFileSync(resolve(import.meta.dir,'../components/reels-screen.css'),'utf8');
  expect(css).toContain('.reel-author-card__name { display: block; font-size: 18px; font-weight: 700;');
  expect(css).toContain('.reel-author-card__handle { margin: 2px 0 0; font-size: 14px; font-weight: 500;');
  expect(css).toContain('.reel-panel-follow { flex: 0 0 auto; height: 36px; padding: 0 16px; border-radius: 999px;');
  expect(css).toContain('.reel-author-card__counts { display: flex; flex-wrap: wrap; gap: 8px 20px;');
  expect(css).toContain('.reel-panel-count { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700;');
});

test('comments column is TikTok\'s 352px card in a 368px track driven by the constants; the hover card is gone', () => {
  const css=readFileSync(resolve(import.meta.dir,'../components/reels-screen.css'),'utf8');
  expect(COMMENTS_COLUMN_WIDTH).toBe(352);
  expect(COMMENTS_TRACK_WIDTH).toBe(368);
  expect(css).toContain('grid-template-columns: minmax(0,1fr) var(--reel-comments-w, 368px)');
  expect(css).not.toContain('34vw');
  expect(css).not.toContain('reel-creator-popover');
  expect(css).not.toContain('reel-follow-pill');
  expect(css).toContain('.reel-comments-head__title');
  expect(css).toContain('.reel-rail-follow');
  // No header under the sidebar chrome: the stage height is the viewport's.
  expect(css).not.toContain('100dvh - 4rem');
});

test('volume slider exposes the real level and reports zero while muted', () => {
  for (const [sound,volume,expected] of [[true,.37,37],[true,1,100],[false,.8,0]] as const) {
    const html=renderToStaticMarkup(<ReelOverlay reel={reel} sound={sound} volume={volume} onVolumeChange={()=>{}} onToggleSound={()=>{}} onOpenSettings={()=>{}}/>);
    expect(html).toContain('aria-label="Volume"');
    expect(html).toContain(`aria-valuetext="${expected}%"`);
    expect(html).toContain('min="0" max="100" step="1"');
  }
});

test('hover-only chrome has keyboard and touch exceptions, without hiding the video',()=>{
  const css=readFileSync(resolve(import.meta.dir,'../components/reels-screen.css'),'utf8');
  expect(css).toContain('@media (hover: hover) and (pointer: fine)');
  expect(css).toContain('.reel-stage-cluster:not(:hover):not(:has(:focus-visible))');
  expect(css).toContain('@media (pointer: coarse)');
  expect(css).toContain('.reel-playback-button { width: 40px; height: 40px; }');
});
test('absolute comment reconciliation patches feed variants and deep-link copy without duplicate increments', () => {
  const qc=new QueryClient();
  const key=['reels','feed',{following:false}];
  qc.setQueryData(key,{pages:[{items:[reel],nextCursor:undefined}],pageParams:[undefined]});
  qc.setQueryData(['reels','pinned','r1'],reel);
  patchReelEverywhere(qc,'r1',{commentCount:3});
  patchReelEverywhere(qc,'r1',{commentCount:3});
  expect((qc.getQueryData(key) as any).pages[0].items[0].commentCount).toBe(3);
  expect((qc.getQueryData(['reels','pinned','r1']) as any).commentCount).toBe(3);
  patchReelEverywhere(qc,'r1',{commentCount:2});
  expect((qc.getQueryData(['reels','pinned','r1']) as any).commentCount).toBe(2);
  qc.clear();
});
test('local comment actions invalidate comments, replies/deep links and the reel counter source', () => {
  const qc=new QueryClient();
  const keys=[['comments','r1'],['comments-around','r1','c1'],['reels','live','r1'],['reels','pinned','r1'],['post-detail','r1']];
  keys.forEach(key=>qc.setQueryData(key,{}));
  qc.setQueryData(['comments','other'],{});
  refreshCommentSurfaces(qc,'r1');
  for(const key of keys) expect(qc.getQueryState(key)?.isInvalidated).toBe(true);
  expect(qc.getQueryState(['comments','other'])?.isInvalidated).toBe(false);
  qc.clear();
});
