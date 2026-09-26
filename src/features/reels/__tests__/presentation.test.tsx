import { expect, test } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient } from '@tanstack/react-query';
import { toReelItem } from '../model';
import { ReelOverlay } from '../components/ReelOverlay';
import { ReelRail } from '../components/ReelRail';
import { ReelExpandedDetails } from '../components/ReelExpandedDetails';
import { COMMENTS_COLUMN_WIDTH } from '../stage';
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
  expect(css).toContain('width: min(280px,100%)');
  expect(css).toContain('top: calc(100% + 8px)');
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

test('the phone rail carries the same avatar and badge', () => {
  const html=renderToStaticMarkup(<ReelRail {...railBase} variant="phone" following={false}/>);
  expect(html).toContain('reel-action-rail is-phone');
  expect(html).toContain('reel-rail-avatar-wrap');
  expect(html).toContain('lucide-plus');
});

test('comments column is a fixed 380px panel driven by the constant; the hover card is gone', () => {
  const css=readFileSync(resolve(import.meta.dir,'../components/reels-screen.css'),'utf8');
  expect(COMMENTS_COLUMN_WIDTH).toBe(380);
  expect(css).toContain('grid-template-columns: minmax(0,1fr) var(--reel-comments-w, 380px)');
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
