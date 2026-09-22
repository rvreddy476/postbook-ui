import { User } from '@/types';
import type { CallSession, JoinResponse } from '@/types/call';
import {
  sendSignaling,
  subscribeToCallSignals,
  subscribeToCallRoom,
  unsubscribeFromCallRoom,
  CallSignal,
} from './messageService';
import { getSession } from './authService';
import api from '@/lib/api';

/**
 * 1:1 calls: direct WebRTC between the two browsers (or browser and phone),
 * with call-service as the authority on who may call whom and ws-gateway as
 * the signalling relay.
 *
 * The protocol is the one Android's core/call speaks, so a web↔phone call
 * rings on both ends:
 *
 *   caller   POST /v1/calls        creates the session; call-service marks
 *                                  the pair `ringing` in Redis, which is what
 *                                  lets ws-gateway relay anything at all
 *   caller   POST /join            ICE servers (managed TURN when configured)
 *   caller → call_ring             {call_id, video}     the callee's phone rings
 *   callee   POST accept, /join    accept flips the pair to `active`, which
 *                                  is what unlocks ice_candidate relaying
 *   callee → call_accept
 *   caller → call_offer            {sdp}
 *   callee → call_answer           {sdp}
 *   both   → ice_candidate         {candidate, sdp_mid, sdp_mline_index}
 *
 * Before this the web sent call_offer first and nothing else, which Android
 * parses as an offer for a call it was never told about; and it sent ICE as
 * an object where Android expects a string, so even a web↔web call could
 * not have interoperated with a phone.
 *
 * Media is direct: LiveKit in this stack is the Live-streaming feature, not
 * calls. call-service's join hands out the relay; that is where TURN comes
 * from, and without one, two peers behind different NATs never connect.
 */

export type CallState = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'active';
export type CallType = 'audio' | 'video';

export interface CallInfo {
  state: CallState;
  type: CallType;
  peerId: string;
  peerName: string;
  peerAvatar: string;
  startedAt?: number;
  localStream?: MediaStream;
  remoteStream?: MediaStream;
  callId?: string;
  callSession?: CallSession;
  joinResponse?: JoinResponse;
  participants?: Array<{ userId: string; audioMuted: boolean; videoMuted: boolean }>;
}

/** Last resort only. A join normally supplies a TURN relay. */
const FALLBACK_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

let callInfo: CallInfo | null = null;
let pc: RTCPeerConnection | null = null;
/** Remote candidates that arrived before the remote description was set. */
let pendingCandidates: RTCIceCandidateInit[] = [];
/**
 * Our own candidates, held until the pair is allowed to exchange them.
 * ws-gateway relays ice_candidate only once the callee's accept has moved
 * the pair to `active`; the caller starts gathering the moment it sets its
 * local description, so anything sent before that was silently dropped.
 */
let localCandidateBuffer: RTCIceCandidateInit[] = [];
let candidatesUnlocked = false;
/** Callee: the invite id accept/decline need; not carried on any socket frame. */
let inviteId: string | undefined;
/** Callee: an offer that arrived before we were ready to answer it. */
let heldOfferSdp: string | undefined;

const stateListeners = new Set<(info: CallInfo | null) => void>();

function notify() {
  const snapshot = callInfo ? { ...callInfo } : null;
  stateListeners.forEach(cb => cb(snapshot));
}

function updateState(patch: Partial<CallInfo>) {
  if (!callInfo) return;
  Object.assign(callInfo, patch);
  notify();
}

function cleanup() {
  if (callInfo?.callId) {
    unsubscribeFromCallRoom(callInfo.callId);
  }
  if (pc) {
    pc.onicecandidate = null;
    pc.ontrack = null;
    pc.oniceconnectionstatechange = null;
    pc.close();
    pc = null;
  }
  if (callInfo?.localStream) {
    callInfo.localStream.getTracks().forEach(t => t.stop());
  }
  pendingCandidates = [];
  localCandidateBuffer = [];
  candidatesUnlocked = false;
  inviteId = undefined;
  heldOfferSdp = undefined;
  callInfo = null;
  notify();
}

// --- ICE ---

function getIceServers(): RTCIceServer[] {
  if (callInfo?.joinResponse?.ice_servers?.length) {
    return callInfo.joinResponse.ice_servers.map(s => ({
      urls: s.urls,
      username: s.username,
      credential: s.credential,
    }));
  }
  return FALLBACK_ICE_SERVERS;
}

/** Android's frame shape: candidate as a string plus mid and index. */
function sendLocalCandidate(candidate: RTCIceCandidateInit) {
  if (!callInfo || !candidate.candidate) return;
  sendSignaling({
    type: 'ice_candidate',
    target_user_id: callInfo.peerId,
    call_id: callInfo.callId,
    candidate: candidate.candidate,
    sdp_mid: candidate.sdpMid ?? '0',
    sdp_mline_index: candidate.sdpMLineIndex ?? 0,
  });
}

function unlockCandidates() {
  candidatesUnlocked = true;
  const held = localCandidateBuffer;
  localCandidateBuffer = [];
  held.forEach(sendLocalCandidate);
}

/** Accepts both our old object form and Android's string form. */
function candidateFromSignal(signal: CallSignal): RTCIceCandidateInit | null {
  const raw = signal.candidate;
  if (raw && typeof raw === 'object') return raw as RTCIceCandidateInit;
  if (typeof raw === 'string' && raw) {
    const mid = (signal as { sdp_mid?: unknown }).sdp_mid;
    const idx = (signal as { sdp_mline_index?: unknown }).sdp_mline_index;
    return {
      candidate: raw,
      sdpMid: typeof mid === 'string' ? mid : null,
      sdpMLineIndex: typeof idx === 'number' ? idx : null,
    };
  }
  return null;
}

async function flushPendingCandidates() {
  if (!pc) return;
  for (const c of pendingCandidates) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(c));
    } catch (err) {
      console.warn('[call] dropped a remote candidate:', err);
    }
  }
  pendingCandidates = [];
}

function createPeerConnection(): RTCPeerConnection {
  const conn = new RTCPeerConnection({ iceServers: getIceServers() });

  conn.onicecandidate = (e) => {
    if (!e.candidate || !callInfo) return;
    const candidate = e.candidate.toJSON();
    if (candidatesUnlocked) sendLocalCandidate(candidate);
    else localCandidateBuffer.push(candidate);
  };

  conn.ontrack = (e) => {
    if (callInfo && e.streams[0]) {
      updateState({ remoteStream: e.streams[0] });
    }
  };

  conn.oniceconnectionstatechange = () => {
    if (!conn) return;
    const s = conn.iceConnectionState;
    if (s === 'connected' || s === 'completed') {
      if (callInfo && callInfo.state !== 'active') {
        updateState({ state: 'active', startedAt: Date.now() });
      }
    } else if (s === 'failed' || s === 'closed') {
      endCall();
    }
    // 'disconnected' is transient on flaky networks and usually recovers;
    // ending the call on it hung up on every Wi-Fi hiccup.
  };

  return conn;
}

async function getMedia(type: CallType): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: true,
    video: type === 'video',
  });
}

// --- REST ---

async function createCallViaAPI(contact: User, type: CallType): Promise<CallSession | null> {
  try {
    // `target_user_ids`: what call-service binds as required. The old
    // `invitee_user_ids` made every create a 400, after which the gateway
    // dropped the ring as "no active call between pair".
    const res = await api.post<{ data: CallSession }>('/v1/calls', {
      call_type: type,
      source_type: 'direct',
      audio_only: type === 'audio',
      target_user_ids: [contact.id],
    });
    return res.data.data;
  } catch (err) {
    console.error('[call] create failed:', err);
    return null;
  }
}

async function joinCallViaAPI(callId: string): Promise<JoinResponse | null> {
  try {
    const res = await api.post<{ data: JoinResponse }>(`/v1/calls/${callId}/join`);
    return res.data.data;
  } catch (err) {
    console.error('[call] join failed:', err);
    return null;
  }
}

async function endCallViaAPI(callId: string): Promise<void> {
  try {
    await api.post(`/v1/calls/${callId}/end`);
  } catch (err) {
    console.error('[call] end failed:', err);
  }
}

async function acceptInviteViaAPI(callId: string, invite: string): Promise<void> {
  try {
    await api.post(`/v1/calls/${callId}/invites/${invite}/accept`);
  } catch (err) {
    console.error('[call] accept invite failed:', err);
  }
}

async function declineInviteViaAPI(callId: string, invite: string): Promise<void> {
  try {
    await api.post(`/v1/calls/${callId}/invites/${invite}/decline`);
  } catch (err) {
    console.error('[call] decline invite failed:', err);
  }
}

/** The viewer's invite for a ringing call. No socket frame carries this. */
async function findInviteIdForCall(callId: string): Promise<string | undefined> {
  try {
    const res = await api.get<{ data: Array<{ invite_id: string; call_id: string }> }>(
      '/v1/calls/invites/pending',
    );
    const list = Array.isArray(res.data?.data) ? res.data.data : [];
    return list.find(inv => inv.call_id === callId)?.invite_id;
  } catch (err) {
    console.error('[call] invite lookup failed:', err);
    return undefined;
  }
}

function senderIdentity(): { sender_name: string; sender_avatar: string } {
  const me = getSession();
  if (!me) return { sender_name: '', sender_avatar: '' };
  const fullName = [me.firstName, me.lastName].filter(Boolean).join(' ');
  const name =
    fullName ||
    me.username ||
    (me.name && !me.name.includes('@') ? me.name : '');
  return { sender_name: name, sender_avatar: me.avatar || '' };
}

// --- Public API ---

export function initiateCall(contact: User, type: CallType) {
  if (callInfo) return;

  callInfo = {
    state: 'outgoing',
    type,
    peerId: contact.id,
    peerName: contact.name,
    peerAvatar: contact.avatar,
  };
  notify();

  (async () => {
    try {
      const session = await createCallViaAPI(contact, type);
      if (!callInfo || callInfo.state !== 'outgoing') return;
      if (!session) {
        // Without a session the gateway drops every frame for this pair.
        // Ringing anyway left the caller staring at silence.
        cleanup();
        return;
      }
      updateState({ callId: session.id, callSession: session });
      subscribeToCallRoom(session.id);

      const joinResp = await joinCallViaAPI(session.id);
      if (!callInfo || callInfo.state !== 'outgoing') return;
      if (joinResp) updateState({ joinResponse: joinResp });

      const stream = await getMedia(type);
      if (!callInfo || callInfo.state !== 'outgoing') {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      updateState({ localStream: stream });

      pc = createPeerConnection();
      stream.getTracks().forEach(t => pc!.addTrack(t, stream));

      // Ring, and hold the offer until the callee accepts. Both clients
      // ring on this frame; the SDP goes out only to someone who picked up.
      sendSignaling({
        type: 'call_ring',
        target_user_id: contact.id,
        call_id: session.id,
        video: type === 'video',
        call_type: type,
        ...senderIdentity(),
      });
    } catch (err) {
      console.error('[call] initiate failed:', err);
      cleanup();
    }
  })();
}

/** Caller: the callee accepted, so send the offer. */
async function sendOffer() {
  if (!callInfo || !pc) return;
  updateState({ state: 'connecting' });
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  sendSignaling({
    type: 'call_offer',
    target_user_id: callInfo.peerId,
    call_id: callInfo.callId,
    call_type: callInfo.type,
    sdp: offer.sdp,
    ...senderIdentity(),
  });
}

/** Callee: an offer is in hand and we are ready; answer it. */
async function answerOffer(sdp: string) {
  if (!callInfo || !pc) return;
  await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }));
  await flushPendingCandidates();
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  sendSignaling({
    type: 'call_answer',
    target_user_id: callInfo.peerId,
    call_id: callInfo.callId,
    sdp: answer.sdp,
  });
  // Our accept moved the pair to `active`; candidates are relayable now.
  unlockCandidates();
}

export function acceptCall() {
  if (!callInfo || callInfo.state !== 'incoming') return;

  updateState({ state: 'connecting' });

  (async () => {
    try {
      const callId = callInfo?.callId;

      if (callId && !inviteId) inviteId = await findInviteIdForCall(callId);
      if (callId && inviteId) await acceptInviteViaAPI(callId, inviteId);
      if (!callInfo) return;

      if (callId) {
        const joinResp = await joinCallViaAPI(callId);
        if (joinResp && callInfo) updateState({ joinResponse: joinResp });
      }
      if (!callInfo) return;

      const stream = await getMedia(callInfo.type);
      if (!callInfo) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      updateState({ localStream: stream });

      pc = createPeerConnection();
      stream.getTracks().forEach(t => pc!.addTrack(t, stream));

      if (heldOfferSdp) {
        // The caller sent the offer with the ring (older web caller);
        // answer it straight away.
        const sdp = heldOfferSdp;
        heldOfferSdp = undefined;
        await answerOffer(sdp);
        return;
      }

      // Tell the caller we picked up; the offer follows.
      sendSignaling({ type: 'call_accept', target_user_id: callInfo.peerId, call_id: callId });
    } catch (err) {
      console.error('[call] accept failed:', err);
      cleanup();
    }
  })();
}

export function declineCall() {
  if (!callInfo) return;
  const callId = callInfo.callId;

  sendSignaling({ type: 'call_decline', target_user_id: callInfo.peerId, call_id: callId });
  if (callId && inviteId) declineInviteViaAPI(callId, inviteId);
  cleanup();
}

export function endCall() {
  if (!callInfo) return;
  const callId = callInfo.callId;

  sendSignaling({ type: 'call_end', target_user_id: callInfo.peerId, call_id: callId });
  if (callId) endCallViaAPI(callId);
  cleanup();
}

export function toggleMute(): boolean {
  if (!callInfo?.localStream) return false;
  const track = callInfo.localStream.getAudioTracks()[0];
  if (!track) return false;
  track.enabled = !track.enabled;

  if (callInfo.callId) {
    sendSignaling({
      type: track.enabled ? 'call_participant_unmuted' : 'call_participant_muted',
      call_id: callInfo.callId,
    });
  }
  return !track.enabled;
}

export function toggleCamera(): boolean {
  if (!callInfo?.localStream) return false;
  const track = callInfo.localStream.getVideoTracks()[0];
  if (!track) return false;
  track.enabled = !track.enabled;

  if (callInfo.callId) {
    sendSignaling({ type: 'call_video_toggle', call_id: callInfo.callId });
  }
  return !track.enabled;
}

export function subscribeToCallState(cb: (info: CallInfo | null) => void): () => void {
  stateListeners.add(cb);
  cb(callInfo ? { ...callInfo } : null);
  return () => { stateListeners.delete(cb); };
}

// --- Peer profile for incoming calls ---

async function resolvePeerProfile(userId: string): Promise<{ name: string; avatar: string }> {
  try {
    // Bare fetch, not the axios client: /api/profile is a Next route on
    // this origin, and the axios base URL points at the API gateway.
    const res = await fetch(`/api/profile/${encodeURIComponent(userId)}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`profile ${res.status}`);
    const body = (await res.json()) as {
      data?: { profile?: { display_name?: string; username?: string; name?: string; avatar_url?: string; avatar_media_id?: string } };
    };
    const p = body.data?.profile;
    const name = p?.display_name || p?.name || p?.username || userId;
    const avatar = p?.avatar_url || (p?.avatar_media_id ? `/v1/media/${p.avatar_media_id}/serve` : '');
    return { name, avatar };
  } catch {
    return { name: userId, avatar: '' };
  }
}

// --- Incoming signals ---

function isSameCall(signal: CallSignal): boolean {
  if (!callInfo) return false;
  if (callInfo.peerId !== signal.sender_id) return false;
  return !callInfo.callId || !signal.call_id || callInfo.callId === signal.call_id;
}

function beginIncoming(signal: CallSignal, type: CallType) {
  const name = (signal.sender_name as string) || '';
  const avatar = (signal.sender_avatar as string) || '';
  callInfo = {
    state: 'incoming',
    type,
    peerId: signal.sender_id,
    peerName: name || signal.sender_id,
    peerAvatar: avatar,
    callId: signal.call_id,
  };
  if (signal.call_id) subscribeToCallRoom(signal.call_id);
  notify();
  if (!name) {
    resolvePeerProfile(signal.sender_id).then(({ name: n, avatar: a }) => {
      if (callInfo && callInfo.peerId === signal.sender_id) {
        updateState({ peerName: n, peerAvatar: a || callInfo.peerAvatar });
      }
    });
  }
}

function handleSignal(signal: CallSignal) {
  const me = getSession();
  if (!me) return;

  switch (signal.type) {
    case 'call_ring': {
      if (callInfo) {
        if (!isSameCall(signal)) {
          sendSignaling({ type: 'call_busy', target_user_id: signal.sender_id, call_id: signal.call_id });
        }
        return;
      }
      // Android rings with `video: true|false`; web also sends call_type.
      const video = signal.video === true || signal.call_type === 'video';
      beginIncoming(signal, video ? 'video' : 'audio');
      break;
    }

    case 'call_offer': {
      if (!callInfo) {
        // An offer with no ring first: an older web caller. Treat the offer
        // as the ring and keep the SDP for when we accept.
        beginIncoming(signal, signal.call_type || 'audio');
        heldOfferSdp = signal.sdp;
        return;
      }
      if (!isSameCall(signal)) {
        sendSignaling({ type: 'call_busy', target_user_id: signal.sender_id, call_id: signal.call_id });
        return;
      }
      if (!signal.sdp) return;
      if (callInfo.state === 'connecting' && pc) {
        // We accepted and are waiting for exactly this.
        answerOffer(signal.sdp).catch(err => {
          console.error('[call] answer failed:', err);
          cleanup();
        });
      } else {
        heldOfferSdp = signal.sdp;
      }
      break;
    }

    case 'call_accept': {
      if (!callInfo || callInfo.state !== 'outgoing' || !pc || !isSameCall(signal)) return;
      sendOffer().catch(err => {
        console.error('[call] offer failed:', err);
        cleanup();
      });
      break;
    }

    case 'call_answer': {
      if (!callInfo || !pc || !isSameCall(signal) || !signal.sdp) return;
      updateState({ state: 'connecting' });
      (async () => {
        try {
          await pc!.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
          await flushPendingCandidates();
          // An answer means the callee accepted: the pair is `active`, so
          // everything buffered while ringing can go out now.
          unlockCandidates();
        } catch (err) {
          console.error('[call] apply answer failed:', err);
          cleanup();
        }
      })();
      break;
    }

    case 'ice_candidate': {
      if (!callInfo || !isSameCall(signal)) return;
      const candidate = candidateFromSignal(signal);
      if (!candidate) return;
      if (pc && pc.remoteDescription) {
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(err => {
          console.warn('[call] dropped a remote candidate:', err);
        });
      } else {
        pendingCandidates.push(candidate);
      }
      break;
    }

    case 'call_end':
    case 'call_decline':
    case 'call_reject':
    case 'call_busy': {
      if (callInfo && isSameCall(signal)) cleanup();
      break;
    }

    case 'call_participant_joined':
    case 'call_participant_left':
    case 'call_participant_removed':
    case 'call_state_change': {
      if (callInfo) notify();
      break;
    }
  }
}

// Registered at module load: importing this module (CallOverlay does, and
// it is mounted app-wide in providers.tsx) is what makes any page able to
// receive a call.
subscribeToCallSignals(handleSignal);
