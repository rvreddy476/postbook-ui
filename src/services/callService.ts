import { User } from '@/types';
import type { CallSession, JoinResponse, CallType as ApiCallType } from '@/types/call';
import {
  sendSignaling,
  subscribeToCallSignals,
  subscribeToCallRoom,
  unsubscribeFromCallRoom,
  CallSignal,
} from './messageService';
import { getSession } from './authService';
import api from '@/lib/api';

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

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

let callInfo: CallInfo | null = null;
let pc: RTCPeerConnection | null = null;
let pendingCandidates: RTCIceCandidateInit[] = [];
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
  callInfo = null;
  notify();
}

function getIceServers(): RTCIceServer[] {
  if (callInfo?.joinResponse?.ice_servers?.length) {
    return callInfo.joinResponse.ice_servers.map(s => ({
      urls: s.urls,
      username: s.username,
      credential: s.credential,
    }));
  }
  return ICE_SERVERS;
}

function createPeerConnection(): RTCPeerConnection {
  const conn = new RTCPeerConnection({ iceServers: getIceServers() });

  conn.onicecandidate = (e) => {
    if (e.candidate && callInfo) {
      sendSignaling({
        type: 'ice_candidate',
        target_user_id: callInfo.peerId,
        call_id: callInfo.callId,
        candidate: e.candidate.toJSON(),
      });
    }
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
      updateState({ state: 'active', startedAt: Date.now() });
    } else if (s === 'failed' || s === 'disconnected' || s === 'closed') {
      endCall();
    }
  };

  return conn;
}

async function getMedia(type: CallType): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: true,
    video: type === 'video',
  });
}

async function flushPendingCandidates() {
  if (!pc) return;
  for (const c of pendingCandidates) {
    await pc.addIceCandidate(new RTCIceCandidate(c));
  }
  pendingCandidates = [];
}

// --- REST API integration ---

async function createCallViaAPI(contact: User, type: CallType): Promise<CallSession | null> {
  try {
    const res = await api.post<{ data: CallSession }>('/v1/calls', {
      call_type: type,
      source_type: 'direct',
      audio_only: type === 'audio',
      invitee_user_ids: [contact.id],
    });
    return res.data.data;
  } catch (err) {
    console.error('Failed to create call via API:', err);
    return null;
  }
}

async function joinCallViaAPI(callId: string): Promise<JoinResponse | null> {
  try {
    const res = await api.post<{ data: JoinResponse }>(`/v1/calls/${callId}/join`);
    return res.data.data;
  } catch (err) {
    console.error('Failed to join call via API:', err);
    return null;
  }
}

async function leaveCallViaAPI(callId: string): Promise<void> {
  try {
    await api.post(`/v1/calls/${callId}/leave`);
  } catch (err) {
    console.error('Failed to leave call via API:', err);
  }
}

async function endCallViaAPI(callId: string): Promise<void> {
  try {
    await api.post(`/v1/calls/${callId}/end`);
  } catch (err) {
    console.error('Failed to end call via API:', err);
  }
}

async function acceptInviteViaAPI(callId: string, inviteId: string): Promise<void> {
  try {
    await api.post(`/v1/calls/${callId}/invites/${inviteId}/accept`);
  } catch (err) {
    console.error('Failed to accept invite via API:', err);
  }
}

async function declineInviteViaAPI(callId: string, inviteId: string): Promise<void> {
  try {
    await api.post(`/v1/calls/${callId}/invites/${inviteId}/decline`);
  } catch (err) {
    console.error('Failed to decline invite via API:', err);
  }
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
      // Create call session via REST API
      const session = await createCallViaAPI(contact, type);
      if (!callInfo || callInfo.state !== 'outgoing') return;

      if (session) {
        updateState({ callId: session.id, callSession: session });
        subscribeToCallRoom(session.id);
      }

      const stream = await getMedia(type);
      if (!callInfo || callInfo.state !== 'outgoing') {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      updateState({ localStream: stream });

      pc = createPeerConnection();
      stream.getTracks().forEach(t => pc!.addTrack(t, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const currentUser = getSession();
      sendSignaling({
        type: 'call_offer',
        target_user_id: contact.id,
        call_type: type,
        call_id: session?.id,
        sdp: offer.sdp,
        sender_name: (() => {
          if (!currentUser) return '';
          const fullName = [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' ');
          if (fullName) return fullName;
          if (currentUser.username) return currentUser.username;
          // Avoid sending email as name
          if (currentUser.name && !currentUser.name.includes('@')) return currentUser.name;
          return '';
        })(),
        sender_avatar: currentUser?.avatar || '',
      });
    } catch (err) {
      console.error('Failed to initiate call:', err);
      cleanup();
    }
  })();
}

export function acceptCall() {
  if (!callInfo || callInfo.state !== 'incoming') return;

  updateState({ state: 'connecting' });

  (async () => {
    try {
      // Accept invite via REST API if we have a call ID
      const callId = callInfo?.callId;
      const inviteId = (callInfo as any)?._inviteId as string | undefined;
      if (callId && inviteId) {
        await acceptInviteViaAPI(callId, inviteId);
      }

      // Join the call to get ICE servers
      if (callId) {
        const joinResp = await joinCallViaAPI(callId);
        if (joinResp && callInfo) {
          updateState({ joinResponse: joinResp });
        }
      }

      const stream = await getMedia(callInfo!.type);
      if (!callInfo) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      updateState({ localStream: stream });

      pc = createPeerConnection();
      stream.getTracks().forEach(t => pc!.addTrack(t, stream));

      const offerSdp = (callInfo as any)._offerSdp as string;
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: offerSdp }));
      await flushPendingCandidates();

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      sendSignaling({
        type: 'call_answer',
        target_user_id: callInfo!.peerId,
        call_id: callInfo!.callId,
        sdp: answer.sdp,
      });
    } catch (err) {
      console.error('Failed to accept call:', err);
      cleanup();
    }
  })();
}

export function declineCall() {
  if (!callInfo) return;
  const callId = callInfo.callId;
  const inviteId = (callInfo as any)?._inviteId as string | undefined;

  sendSignaling({ type: 'call_decline', target_user_id: callInfo.peerId, call_id: callId });

  if (callId && inviteId) {
    declineInviteViaAPI(callId, inviteId);
  }
  cleanup();
}

export function endCall() {
  if (!callInfo) return;
  const callId = callInfo.callId;

  sendSignaling({ type: 'call_end', target_user_id: callInfo.peerId, call_id: callId });

  if (callId) {
    endCallViaAPI(callId);
  }
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
    sendSignaling({
      type: 'call_video_toggle',
      call_id: callInfo.callId,
    });
  }

  return !track.enabled;
}

export function subscribeToCallState(cb: (info: CallInfo | null) => void): () => void {
  stateListeners.add(cb);
  cb(callInfo ? { ...callInfo } : null);
  return () => { stateListeners.delete(cb); };
}

// --- Resolve peer profile for incoming calls ---

async function resolvePeerProfile(userId: string): Promise<{ name: string; avatar: string }> {
  try {
    const res = await api.get<{ data: { profile: { display_name?: string; username?: string; name?: string; avatar_url?: string } } }>(
      `/api/profile/${encodeURIComponent(userId)}`
    );
    const p = res.data?.data?.profile;
    const name = p?.display_name || p?.name || p?.username || userId;
    const avatar = p?.avatar_url || '';
    return { name, avatar };
  } catch {
    return { name: userId, avatar: '' };
  }
}

// --- Incoming signal handler ---

function handleSignal(signal: CallSignal) {
  const currentUser = getSession();
  if (!currentUser) return;

  switch (signal.type) {
    case 'call_offer': {
      if (callInfo) {
        sendSignaling({ type: 'call_busy', target_user_id: signal.sender_id });
        return;
      }
      const offerName = (signal as any).sender_name as string || '';
      const offerAvatar = (signal as any).sender_avatar as string || '';
      callInfo = {
        state: 'incoming',
        type: signal.call_type || 'audio',
        peerId: signal.sender_id,
        peerName: offerName || signal.sender_id,
        peerAvatar: offerAvatar,
        callId: signal.call_id,
      };
      (callInfo as any)._offerSdp = signal.sdp;
      if (signal.call_id) {
        subscribeToCallRoom(signal.call_id);
      }
      notify();
      // If we only have the ID, fetch the real name in background
      if (!offerName) {
        resolvePeerProfile(signal.sender_id).then(({ name, avatar }) => {
          if (callInfo && callInfo.peerId === signal.sender_id) {
            updateState({ peerName: name, peerAvatar: avatar || callInfo.peerAvatar });
          }
        });
      }
      break;
    }

    case 'call_ring': {
      if (callInfo) {
        sendSignaling({ type: 'call_busy', target_user_id: signal.sender_id });
        return;
      }
      const ringName = (signal as any).sender_name as string || '';
      const ringAvatar = (signal as any).sender_avatar as string || '';
      callInfo = {
        state: 'incoming',
        type: signal.call_type || 'audio',
        peerId: signal.sender_id,
        peerName: ringName || signal.sender_id,
        peerAvatar: ringAvatar,
        callId: signal.call_id,
      };
      (callInfo as any)._inviteId = (signal as any).invite_id;
      if (signal.call_id) {
        subscribeToCallRoom(signal.call_id);
      }
      notify();
      if (!ringName) {
        resolvePeerProfile(signal.sender_id).then(({ name, avatar }) => {
          if (callInfo && callInfo.peerId === signal.sender_id) {
            updateState({ peerName: name, peerAvatar: avatar || callInfo.peerAvatar });
          }
        });
      }
      break;
    }

    case 'call_answer': {
      if (!callInfo || callInfo.state !== 'outgoing' || !pc) return;
      updateState({ state: 'connecting' });
      (async () => {
        try {
          await pc!.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
          await flushPendingCandidates();
        } catch (err) {
          console.error('Failed to handle call answer:', err);
          cleanup();
        }
      })();
      break;
    }

    case 'ice_candidate': {
      if (!signal.candidate) return;
      if (pc && pc.remoteDescription) {
        pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      } else {
        pendingCandidates.push(signal.candidate);
      }
      break;
    }

    case 'call_end':
    case 'call_decline':
    case 'call_reject': {
      cleanup();
      break;
    }

    case 'call_busy': {
      cleanup();
      break;
    }

    case 'call_participant_joined': {
      if (!callInfo) return;
      // Update participant list from room signals
      notify();
      break;
    }

    case 'call_participant_left':
    case 'call_participant_removed': {
      if (!callInfo) return;
      notify();
      break;
    }

    case 'call_state_change': {
      if (!callInfo) return;
      notify();
      break;
    }
  }
}

// Auto-subscribe to signaling events
subscribeToCallSignals(handleSignal);
