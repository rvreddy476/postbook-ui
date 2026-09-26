import { expect, test } from 'bun:test';
import { QueryClient } from '@tanstack/react-query';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CommentChangeGate, PostRoomSubscriptions, bindPostThread, groupTypingSignal, type CommentChange } from '../postThreadLive';
import { applyPostCommentCount } from '../commentCache';
import { toReelItem } from '@/features/reels/model';
import { setAccessToken, peekAccessToken } from '../accessToken';
import { connectToHub, subscribeToPostRoom, unsubscribeFromPostRoom, subscribeToCommentChanges, subscribeToHubConnected } from '@/services/messageService';

const event = (patch: Partial<CommentChange> = {}): CommentChange => ({
  event_id: 'e1', version: 1790418995849403, post_id: 'p', comment_id: 'c',
  actor_id: 'a', change: 'created', comments: 2, ...patch,
});

test('comment changes dedupe event IDs even if the duplicate claims a newer version', () => {
  const gate = new CommentChangeGate();
  expect(gate.accept(event())).toBe(true);
  expect(gate.accept(event())).toBe(false);
  expect(gate.accept(event({ version: event().version + 1 }))).toBe(false);
});

test('equal and older versions are dropped per post; a newer total can fall to zero', () => {
  const gate = new CommentChangeGate();
  expect(gate.accept(event())).toBe(true);
  expect(gate.accept(event({ event_id: 'equal' }))).toBe(false);
  expect(gate.accept(event({ event_id: 'older', version: event().version - 1 }))).toBe(false);
  expect(gate.accept(event({ event_id: 'next', version: event().version + 1, comments: 0, change: 'deleted' }))).toBe(true);
  expect(gate.accept(event({ post_id: 'other', version: 1 }))).toBe(true);
});

test('malformed events cannot poison the version watermark or replace counts', () => {
  const gate = new CommentChangeGate();
  for (const patch of [{ comments: -1 }, { comments: NaN }, { version: Infinity }, { version: 1.5 }, { event_id: '' }, { change: 'bogus' }]) {
    expect(gate.accept({ ...event(), ...patch })).toBe(false);
  }
  expect(gate.accept(null)).toBe(false);
  expect(gate.accept(event())).toBe(true);
});

test('first socket open and every reconnect subscribe exactly once per active post', () => {
  const frames: object[] = [];
  const rooms = new PostRoomSubscriptions(frame => frames.push(frame));
  rooms.subscribe('p');
  expect(frames).toEqual([]);
  rooms.onOpen();
  rooms.onClose();
  rooms.onOpen();
  rooms.onClose();
  rooms.onOpen();
  expect(frames).toEqual(Array(3).fill({ type: 'subscribe_post', post_id: 'p' }));
  rooms.unsubscribe('p');
  expect(frames.at(-1)).toEqual({ type: 'unsubscribe_post', post_id: 'p' });
  rooms.onClose();
  rooms.onOpen();
  expect(frames.length).toBe(4);
});

test('leaving offline queues no stale room, and overlapping reel/drawer owners retain the room', () => {
  const frames: object[] = [];
  const rooms = new PostRoomSubscriptions(frame => frames.push(frame));
  rooms.subscribe('gone'); rooms.unsubscribe('gone'); rooms.onOpen();
  expect(frames).toEqual([]);
  rooms.subscribe('p'); rooms.subscribe('p'); rooms.unsubscribe('p');
  expect(frames).toEqual([{ type: 'subscribe_post', post_id: 'p' }]);
  rooms.onClose(); rooms.onOpen();
  expect(frames.length).toBe(2);
  rooms.unsubscribe('p');
  expect(frames.at(-1)).toEqual({ type: 'unsubscribe_post', post_id: 'p' });
});

test('refresh retries silently refused subscriptions without changing ownership', () => {
  const frames: object[] = [];
  const rooms = new PostRoomSubscriptions(frame => frames.push(frame));
  rooms.subscribe('p'); rooms.refresh(); expect(frames).toEqual([]);
  rooms.onOpen(); rooms.refresh(); rooms.unsubscribe('p'); rooms.refresh();
  expect(frames.map((f: any) => f.type)).toEqual(['subscribe_post', 'subscribe_post', 'unsubscribe_post']);
});

test('real thread binding refetches on reconnect and every change, patches legacy totals, cleans up', () => {
  const counts: number[] = [];
  const frames: object[] = [];
  let refreshes = 0, threadReads = 0;
  const connected = new Set<() => void>();
  const changes = new Set<(e: CommentChange) => void>();
  const updates = new Set<(e: {post_id:string; comments?:number}) => void>();
  const rooms = new PostRoomSubscriptions(frame => frames.push(frame));
  const dispose = bindPostThread('p', {
    subscribe: id => rooms.subscribe(id), unsubscribe: id => rooms.unsubscribe(id),
    onConnected: cb => { connected.add(cb); return () => { connected.delete(cb); }; },
    onChange: cb => { changes.add(cb); return () => { changes.delete(cb); }; },
    onUpdate: cb => { updates.add(cb); return () => { updates.delete(cb); }; },
    setCount: count => counts.push(count), refresh: () => { refreshes++; },
    refreshThread: () => { threadReads++; },
  });
  for (let i = 0; i < 3; i++) { rooms.onClose(); rooms.onOpen(); connected.forEach(cb => cb()); }
  expect(refreshes).toBe(3);
  expect(frames.length).toBe(3);
  for (const change of ['created','replied','edited','deleted','moderated','reaction'] as const) {
    changes.forEach(cb => cb(event({ change, comments: 7 })));
  }
  changes.forEach(cb => cb(event({ post_id: 'other' })));
  updates.forEach(cb => cb({ post_id: 'p', comments: 0 }));
  expect(counts).toEqual([7,7,7,7,7,7,0]);
  expect(threadReads).toBe(7);
  dispose();
  expect(connected.size + changes.size + updates.size).toBe(0);
  expect(frames.at(-1)).toEqual({ type: 'unsubscribe_post', post_id: 'p' });
});

test('server totals patch cached reel/detail/feed copies without using the loaded comment page', () => {
  const qc = new QueryClient();
  const post = {id:'p',counts:{likes:5,comments:100}};
  qc.setQueryData(['post-detail','p'],post);
  qc.setQueryData(['home-feed'],{pages:[{data:[post]}],pageParams:[]});
  qc.setQueryData(['comments','p'],[{id:'only-loaded-comment'}]);
  qc.setQueryData(['reels','pinned','p'],{id:'p',commentCount:100});
  qc.setQueryData(['reels','live','p'],{id:'p',commentCount:100});
  qc.setQueryData(['reels','feed'],{pages:[{items:[{id:'p',commentCount:100}]}],pageParams:[]});
  for (const total of [12,12,0]) {
    applyPostCommentCount(qc,'p',total);
    expect((qc.getQueryData(['post-detail','p']) as any).counts).toEqual({likes:5,comments:total});
    expect((qc.getQueryData(['reels','pinned','p']) as any).commentCount).toBe(total);
    expect((qc.getQueryData(['reels','live','p']) as any).commentCount).toBe(total);
    expect((qc.getQueryData(['home-feed']) as any).pages[0].data[0].counts.comments).toBe(total);
    expect((qc.getQueryData(['reels','feed']) as any).pages[0].items[0].commentCount).toBe(total);
  }
  applyPostCommentCount(qc,'p',undefined);
  expect((qc.getQueryData(['reels','pinned','p']) as any).commentCount).toBe(0);
  qc.clear();
});

test('detail author and reply-inclusive count map directly; description is never a title', () => {
  const post = {id:'p',author_id:'legacy',text:'Not a title',content_type:'reel',counts:{comments:12},
    author:{id:'author',display_name:'Real name',username:'real',avatar_media_id:'avatar'},media:[{media_id:'m',kind:'video'}]};
  const reel = toReelItem(post)!;
  expect([reel.authorId,reel.authorName,reel.authorUsername,reel.commentCount,reel.title]).toEqual(['author','Real name','real',12,'']);
  expect(reel.authorAvatarUrl).toBe('/v1/media/avatar/serve');
  expect(toReelItem({...post,author:{...post.author,avatar_url:'/avatar.png'}})!.authorAvatarUrl).toBe('/avatar.png');
});

test('group typing intentionally strips any identity, including a legacy server payload', () => {
  const frame = {post_id:'p',user_id:'secret',display_name:'Secret name'};
  expect(groupTypingSignal(frame)).toEqual({post_id:'p'});
  expect(groupTypingSignal({})).toBeNull();
});

test('production socket invokes tested gates and reconnect lifecycle; anonymous rooms stay off', () => {
  const service = readFileSync(resolve(import.meta.dir,'../../services/messageService.ts'),'utf8');
  expect(service).toContain('commentChangeGate.accept(data.payload)');
  expect(service).toContain('postRooms.onOpen()');
  expect(service).toContain('hubConnectedListeners.forEach(cb => cb())');
  const group = readFileSync(resolve(import.meta.dir,'../../components/groups/GroupPostCommentSection.tsx'),'utf8');
  expect(group).toContain('useGroupPostCommentRoom(undefined, groupId, handleRealtimeEvent)');
  expect(group).toContain('Someone is typing...');
  expect(group).not.toContain('evt.user_id');
});

test('production WebSocket handlers resubscribe and refetch after reconnect without replaying stale changes', async () => {
  const names = ['window','localStorage','WebSocket','fetch','setTimeout'] as const;
  const originals = names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis,name)] as const);
  const previousToken = peekAccessToken();
  let signedIn = true;
  let retry: (() => Promise<void>) | undefined;
  const sockets: FakeSocket[] = [];
  class FakeSocket {
    static OPEN = 1; static CONNECTING = 0;
    readyState = 0;
    frames: string[] = [];
    onopen?: () => void;
    onclose?: () => void;
    onmessage?: (e: {data:string}) => void;
    constructor(_url: string) { sockets.push(this); }
    send(frame: string) { this.frames.push(frame); }
    close() { this.readyState = 3; this.onclose?.(); }
    open() { this.readyState = 1; this.onopen?.(); }
    receive(payload: CommentChange) { this.onmessage?.({data:JSON.stringify({type:'comment_change',payload})}); }
  }
  const replace = (name: string, value: unknown) => Object.defineProperty(globalThis,name,{configurable:true,writable:true,value});
  let received = 0, reconnectReads = 0;
  const unchange = subscribeToCommentChanges(() => { received++; });
  const unconnected = subscribeToHubConnected(() => { reconnectReads++; });
  try {
    replace('window',{location:{protocol:'https:',host:'test.invalid',hostname:'test.invalid'}});
    replace('localStorage',{getItem:() => signedIn ? JSON.stringify({id:'viewer'}) : null});
    replace('WebSocket',FakeSocket);
    replace('fetch',async () => new Response(JSON.stringify({token:'in-test-token'}),{headers:{'content-type':'application/json'}}));
    replace('setTimeout',(cb: () => Promise<void>) => { retry = cb; return 0; });
    setAccessToken('in-test-access-token');
    subscribeToPostRoom('live-p');
    await connectToHub(() => {});
    const first = sockets[0];
    expect(first.frames).toEqual([]);
    first.open();
    expect(first.frames).toEqual(['{"type":"subscribe_post","post_id":"live-p"}']);
    first.receive(event({post_id:'live-p'}));
    first.close();
    expect(retry).toBeDefined();
    await retry!();
    const second = sockets[1];
    second.open();
    expect(second.frames).toEqual(['{"type":"subscribe_post","post_id":"live-p"}']);
    second.receive(event({post_id:'live-p'}));
    second.receive(event({post_id:'live-p',event_id:'older',version:1}));
    second.receive(event({post_id:'live-p',event_id:'new',version:event().version+1}));
    expect(received).toBe(2);
    expect(reconnectReads).toBe(2);
    unsubscribeFromPostRoom('live-p');
    expect(second.frames.at(-1)).toBe('{"type":"unsubscribe_post","post_id":"live-p"}');
  } finally {
    unsubscribeFromPostRoom('live-p');
    unchange(); unconnected();
    signedIn = false;
    sockets.at(-1)?.close();
    setAccessToken(previousToken);
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis,name,descriptor);
      else Reflect.deleteProperty(globalThis,name);
    }
  }
});
