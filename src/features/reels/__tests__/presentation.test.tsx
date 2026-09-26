import { expect, test } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient } from '@tanstack/react-query';
import { toReelItem } from '../model';
import { ReelOverlay } from '../components/ReelOverlay';
import { ReelExpandedDetails } from '../components/ReelExpandedDetails';
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

test('expanded details carry the creator, title and views outside the portrait video', () => {
  const html=renderToStaticMarkup(<ReelExpandedDetails reel={reel}/>);
  expect(html).toContain('reel-expanded-details');
  expect(html).toContain('Actual title');
  expect(html).toContain('/u/a');
  expect(html).toContain('views');
  expect(html).not.toContain('Description belongs in details');
});

test('reel title is separate from its description, never synthesized from description', () => {
  expect(reel.title).toBe('Actual title');
  expect(reel.caption).toBe('Description belongs in details');
  expect(toReelItem({id:'r2',author_id:'a',text:'Not a title',content_type:'reel',media:[{media_id:'m',kind:'video'}]})!.title).toBe('');
});
test('overlay renders title and the left-side views indicator, not description', () => {
  const html=renderToStaticMarkup(<ReelOverlay reel={reel} isOwn following={undefined} followPending={false} onToggleFollow={()=>{}} sound={false} onToggleSound={()=>{}} onOpenSettings={()=>{}}/>);
  expect(html).toContain('Actual title');
  expect(html).not.toContain('Description belongs in details');
  expect(html).toContain('reel-view-count');
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
