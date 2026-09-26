import { expect, test } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { otherReelCreators, ReelDiscoveryPanel } from '../components/ReelDiscoveryPanel';
import { ReelOverlay } from '../components/ReelOverlay';
import { toReelItem } from '../model';

const reel=(id:string, author:string)=>toReelItem({id,author_id:author,author:{id:author,display_name:`Creator ${author}`,username:`handle-${author}`},title:'Real title',content_type:'reel',media:[{media_id:'media',kind:'video'}]})!;

test('other creators are unique real reel authors, excluding viewer and active author',()=>{
  const result=otherReelCreators([reel('1','active'),reel('2','viewer'),reel('3','a'),reel('4','a'),reel('5','b'),reel('6','c'),reel('7','d'),reel('8','e')],'active','viewer');
  expect(result.map(item=>item.id)).toEqual(['3','5','6','7']);
});

test('empty discovery is honest and still offers a working create route',()=>{
  const active=reel('1','viewer');
  const html=renderToStaticMarkup(<ReelDiscoveryPanel reels={[active]} active={active} viewerId="viewer" onOpenReel={()=>{}} canLoadMore={false} loadingMore={false} onLoadMore={()=>{}}/>);
  expect(html).toContain('No other creators in this selection yet.');
  expect(html).toContain('href="/reels/create"');
  expect(html).not.toContain('Follow</button>');
});

test('video overlay keeps playback and title but does not duplicate creator identity',()=>{
  const html=renderToStaticMarkup(<ReelOverlay reel={reel('1','creator')} isOwn={false} following={false} followPending={false} onToggleFollow={()=>{}} sound={false} volume={1} onVolumeChange={()=>{}} onToggleSound={()=>{}} onOpenSettings={()=>{}}/>);
  expect(html).not.toContain('Creator creator');
  expect(html).not.toContain('handle-creator');
  expect(html).not.toContain('/u/');
  expect(html).toContain('Real title');
  expect(html).toContain('Playback settings');
  expect(html).not.toContain('reel-view-count');
});
