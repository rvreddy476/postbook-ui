import { User } from '@/types';
import {
  isLiveRealtimeEventType,
  type LiveChatMessageEvent,
  type LiveMessagePinnedEvent,
  type LiveRealtimeEvent,
  type LiveStreamEndedEvent,
  type LiveStreamLikesEvent,
  type LiveStreamViewersEvent,
  type LiveUserMutedEvent,
  type LiveUserUnmutedEvent,
  type LiveWordFilterAddedEvent,
  type LiveWordFilterRemovedEvent,
} from '@/features/live/types';

export interface Message {
  id: string;
  sender_id: string;
  conversation_id: string;
  bucket: string;
  ts: string;
  type: 'text' | 'media' | 'image' | 'video' | 'audio' | 'file' | 'system';
  text?: string;
  media_id?: string;
  feeling?: string;
  reactions?: { emoji: string; user_ids: string[] }[];
  reply_to_id?: string;
  forwarded_from_id?: string;
  is_edited?: boolean;
  edited_at?: string;
  is_deleted?: boolean;
  created_at: string;
}

export interface ReactionUpdate {
  conversation_id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  added: boolean;
}

export interface TypingEvent {
  conversation_id: string;
  user_id: string;
  is_typing: boolean;
}

export interface ReadReceiptEvent {
  conversation_id: string;
  user_id: string;
  message_id: string;
  read_at: string;
}

export interface MessageEditedEvent {
  conversation_id: string;
  msg_id: string;
  new_text: string;
  edited_at: string;
}

export interface MessageDeletedEvent {
  conversation_id: string;
  msg_id: string;
}

export interface PinUpdateEvent {
  conversation_id: string;
  message_id: string | null;
  pinned_by: string | null;
  action: 'pin' | 'unpin';
}

// Backend returns msg_id, normalize to id for frontend use.
const normalizeMessage = (raw: Record<string, any>): Message => ({
  id: (raw.msg_id || raw.id || raw.message_id) as string,
  sender_id: raw.sender_id as string,
  conversation_id: raw.conversation_id as string,
  bucket: raw.bucket as string || '',
  ts: raw.ts as string || raw.created_at as string || '',
  type: raw.type || raw.message_type || 'text',
  text: raw.text as string | undefined,
  media_id: raw.media_id as string | undefined,
  feeling: raw.feeling as string | undefined,
  reactions: raw.reactions as { emoji: string; user_ids: string[] }[] | undefined,
  reply_to_id: raw.reply_to_id as string | undefined,
  forwarded_from_id: raw.forwarded_from_id as string | undefined,
  is_edited: raw.is_edited as boolean | undefined,
  edited_at: raw.edited_at as string | undefined,
  is_deleted: raw.is_deleted as boolean | undefined,
  created_at: raw.created_at as string,
});

const wsUrlForPath = (path: string) => {
  const explicitBase = process.env.NEXT_PUBLIC_WS_BASE_URL;
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (explicitBase) {
    return `${explicitBase.replace(/\/+$/, '')}${path}`;
  }
  if (apiBase) {
    return `${apiBase.replace(/^http/, 'ws').replace(/\/+$/, '')}${path}`;
  }
  if (typeof window !== 'undefined') {
    const { protocol, hostname, host } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `ws://${hostname}:8093${path}`;
    }
    const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProtocol}//${host}${path}`;
  }
  return `ws://localhost:8093${path}`;
};

const WS_PATH = '/v1/ws/connect';
const API_BASE = '/api/chat';
const SESSION_KEY = 'postbook_session';
const TOKEN_KEY = 'postbook_auth_tokens';

let socket: WebSocket | null = null;
let chatChannel: BroadcastChannel | null = null;
let wsRetryCount = 0;
const WS_MAX_RETRIES = 5;
const WS_BASE_DELAY = 3000; // 3s, 6s, 12s, 24s, 48s
const localListeners = new Set<(m: Message) => void>();
const reactionListeners = new Set<(r: ReactionUpdate) => void>();
const callSignalListeners = new Set<(signal: CallSignal) => void>();
const feedUpdateListeners = new Set<(f: FeedUpdate) => void>();
const typingListeners = new Set<(e: TypingEvent) => void>();
const readReceiptListeners = new Set<(e: ReadReceiptEvent) => void>();
const messageEditedListeners = new Set<(e: MessageEditedEvent) => void>();
const messageDeletedListeners = new Set<(e: MessageDeletedEvent) => void>();
const postUpdateListeners = new Set<(u: PostInteractionUpdate) => void>();
const commentUpdateListeners = new Set<(u: ChannelCommentUpdate) => void>();
const groupCommentUpdateListeners = new Set<(u: GroupCommentUpdate) => void>();
const groupTypingListeners = new Set<(e: GroupTypingEvent) => void>();
const pinUpdateListeners = new Set<(e: PinUpdateEvent) => void>();
const presenceListeners = new Set<(e: { user_id: string; online: boolean }) => void>();
const liveEventListeners = new Set<(event: LiveRealtimeEvent) => void>();

// Track active room subscriptions so they can be re-sent on WS reconnect
const activeRoomSubscriptions = new Set<string>();
const pendingSignals: object[] = [];

const normalizeLiveEvent = (data: Record<string, any>): LiveRealtimeEvent | null => {
  if (!isLiveRealtimeEventType(data.type)) {
    return null;
  }

  const payload =
    data.payload && typeof data.payload === 'object'
      ? data.payload as Record<string, any>
      : {};
  const streamId = String(payload.stream_id || data.stream_id || '');
  if (!streamId) return null;

  switch (data.type) {
    case 'live_chat_message':
      return {
        type: 'live_chat_message',
        stream_id: streamId,
        message_id: String(payload.message_id || payload.id || ''),
        user_id: String(payload.user_id || ''),
        message: String(payload.message || ''),
        is_pinned: Boolean(payload.is_pinned),
        created_at: String(payload.created_at || new Date().toISOString()),
      } satisfies LiveChatMessageEvent;
    case 'live_stream_viewers':
      return {
        type: 'live_stream_viewers',
        stream_id: streamId,
        viewer_count: Number(payload.viewer_count ?? 0),
        peak_viewers: payload.peak_viewers == null ? undefined : Number(payload.peak_viewers),
        total_viewers: payload.total_viewers == null ? undefined : Number(payload.total_viewers),
        reason: typeof payload.reason === 'string' ? payload.reason : undefined,
        actor_id: typeof payload.actor_id === 'string' ? payload.actor_id : undefined,
        updated_at: typeof payload.updated_at === 'string' ? payload.updated_at : undefined,
      } satisfies LiveStreamViewersEvent;
    case 'live_stream_likes':
      return {
        type: 'live_stream_likes',
        stream_id: streamId,
        like_count: Number(payload.like_count ?? 0),
        updated_at: typeof payload.updated_at === 'string' ? payload.updated_at : undefined,
      } satisfies LiveStreamLikesEvent;
    case 'live_message_pinned':
      return {
        type: 'live_message_pinned',
        stream_id: streamId,
        message_id: String(payload.message_id || ''),
        pinned_by: typeof payload.pinned_by === 'string' ? payload.pinned_by : undefined,
        pinned_at: typeof payload.pinned_at === 'string' ? payload.pinned_at : undefined,
      } satisfies LiveMessagePinnedEvent;
    case 'live_stream_ended':
      return {
        type: 'live_stream_ended',
        stream_id: streamId,
        host_id: typeof payload.host_id === 'string' ? payload.host_id : undefined,
        duration_secs: payload.duration_secs == null ? undefined : Number(payload.duration_secs),
        peak_viewers: payload.peak_viewers == null ? undefined : Number(payload.peak_viewers),
        total_viewers: payload.total_viewers == null ? undefined : Number(payload.total_viewers),
        ended_at: typeof payload.ended_at === 'string' ? payload.ended_at : undefined,
      } satisfies LiveStreamEndedEvent;
    case 'live_user_muted':
      return {
        type: 'live_user_muted',
        stream_id: streamId,
        user_id: String(payload.user_id || ''),
        muted_by: typeof payload.muted_by === 'string' ? payload.muted_by : undefined,
        muted_at: typeof payload.muted_at === 'string' ? payload.muted_at : undefined,
        updated_at: typeof payload.updated_at === 'string' ? payload.updated_at : undefined,
      } satisfies LiveUserMutedEvent;
    case 'live_user_unmuted':
      return {
        type: 'live_user_unmuted',
        stream_id: streamId,
        user_id: String(payload.user_id || ''),
        unmuted_by: typeof payload.unmuted_by === 'string' ? payload.unmuted_by : undefined,
        updated_at: typeof payload.updated_at === 'string' ? payload.updated_at : undefined,
      } satisfies LiveUserUnmutedEvent;
    case 'live_word_filter_added':
      return {
        type: 'live_word_filter_added',
        stream_id: streamId,
        word: String(payload.word || ''),
        added_by: typeof payload.added_by === 'string' ? payload.added_by : undefined,
        updated_at: typeof payload.updated_at === 'string' ? payload.updated_at : undefined,
      } satisfies LiveWordFilterAddedEvent;
    case 'live_word_filter_removed':
      return {
        type: 'live_word_filter_removed',
        stream_id: streamId,
        word: String(payload.word || ''),
        removed_by: typeof payload.removed_by === 'string' ? payload.removed_by : undefined,
        updated_at: typeof payload.updated_at === 'string' ? payload.updated_at : undefined,
      } satisfies LiveWordFilterRemovedEvent;
  }
};

export interface CallSignal {
  type: 'call_offer' | 'call_answer' | 'ice_candidate' | 'call_end' | 'call_decline' | 'call_busy'
    | 'call_ring' | 'call_accept' | 'call_reject'
    | 'call_join' | 'call_leave' | 'call_mute_toggle' | 'call_video_toggle'
    | 'call_screen_share_start' | 'call_screen_share_stop'
    | 'call_hand_raise' | 'call_hand_lower'
    | 'call_participant_joined' | 'call_participant_left'
    | 'call_participant_muted' | 'call_participant_unmuted' | 'call_participant_removed'
    | 'call_state_change' | 'call_quality_report'
    | 'call_upgrade_request' | 'call_upgrade_accept' | 'call_upgrade_reject'
    | 'call_recording_started' | 'call_recording_stopped';
  sender_id: string;
  target_user_id?: string;
  call_id?: string;
  call_type?: 'audio' | 'video';
  sdp?: string;
  candidate?: RTCIceCandidateInit;
  [key: string]: unknown;
}

export interface FeedUpdate {
  post_id: string;
  author_id: string;
  content_type: string;
  snippet: string;
  created_at: string;
}

export interface PostInteractionUpdate {
  post_id: string;
  update_type: 'reaction' | 'comment' | 'comment_deleted' | 'share';
  actor_id?: string;
  likes?: number;
  comments?: number;
  shares?: number;
  comment_id?: string;
}

export interface ChannelCommentUpdate {
  event_id: string;
  update_id: string;
  channel_id: string;
  update_type: 'comment_created' | 'comment_deleted' | 'comment_updated';
  comment_id: string;
  author_id?: string;
  actor_id?: string;
  body?: string;
  parent_id?: string;
  created_at?: string;
}

export interface GroupCommentUpdate {
  event_id: string;
  group_id: string;
  post_id: string;
  update_type: 'comment_created' | 'comment_deleted';
  comment_id: string;
  author_id?: string;
  actor_id?: string;
  body?: string;
  parent_id?: string;
  created_at?: string;
}

export interface GroupTypingEvent {
  post_id: string;
  user_id: string;
}

const canUseBrowserApis = () => typeof window !== 'undefined';

const getSessionUser = () => {
  if (!canUseBrowserApis()) return null;
  const session = localStorage.getItem(SESSION_KEY);
  return session ? JSON.parse(session) as User : null;
};

const getAccessToken = () => {
  if (!canUseBrowserApis()) return null;
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { accessToken?: string };
    return parsed.accessToken ?? null;
  } catch {
    return null;
  }
};

const closeChatSocket = (reason?: string) => {
  if (!canUseBrowserApis()) return;

  if (reason) {
    console.warn(`Chat auth unavailable: ${reason}`);
  }

  wsRetryCount = 0;

  if (socket) {
    socket.onclose = null;
    socket.onerror = null;
    try {
      socket.close();
    } catch {}
    socket = null;
  }

};

const getChannel = () => {
  if (!canUseBrowserApis() || typeof BroadcastChannel === 'undefined') {
    return null;
  }
  if (!chatChannel) {
    chatChannel = new BroadcastChannel('postbook_v1_sync');
  }
  return chatChannel;
};

const getErrorMessage = (payload: unknown, fallback: string) => {
  if (!payload || typeof payload !== 'object') return fallback;
  const source = payload as Record<string, unknown>;

  const error = source.error;
  if (typeof error === 'string' && error.trim()) return error;
  if (error && typeof error === 'object') {
    const nestedMessage = (error as Record<string, unknown>).message;
    if (typeof nestedMessage === 'string' && nestedMessage.trim()) return nestedMessage;
  }

  const message = source.message;
  if (typeof message === 'string' && message.trim()) return message;
  return fallback;
};

const parseResponsePayload = async (res: Response): Promise<unknown> => {
  if (res.status === 204 || res.status === 205) return {};

  const contentType = res.headers.get('content-type')?.toLowerCase() ?? '';
  if (contentType.includes('application/json')) {
    try {
      return await res.json();
    } catch {
      return {};
    }
  }

  const text = await res.text();
  return text ? { message: text } : {};
};

/**
 * Chat API Client using Proxy
 *
 * background=true suppresses the forced logout on 401 — use for recovery
 * / polling paths where a stale token should not kick the user out.
 */
const chatClient = {
  async request<TResponse = any>(path: string, options: RequestInit = {}, background = false) {
    const user = getSessionUser();
    const accessToken = getAccessToken();
    const headers = new Headers(options.headers);
    if (user) {
      headers.set('X-User-Id', user.id);
    }
    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }
    if (options.body !== undefined && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const payload = await parseResponsePayload(res);
    if (!res.ok) {
      const message = getErrorMessage(payload, `Chat API request failed (${res.status})`);
      if (!background && (res.status === 401 || /invalid token/i.test(message))) {
        closeChatSocket(message);
      }
      throw new Error(message);
    }
    return payload as TResponse;
  }
};

/**
 * Connect to the WS Gateway via Proxy Token
 */
export const connectToHub = async (onMsg: (m: Message) => void) => {
  if (!canUseBrowserApis() || typeof WebSocket === 'undefined') return;

  const user = getSessionUser();
  if (!user) return;

  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  try {
    // Fetch a signed chat token from the proxy
    const headers = new Headers({ 'X-User-Id': user.id });
    const accessToken = getAccessToken();
    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }
    const tokenRes = await fetch(`${API_BASE}/token`, { headers });
    const tokenPayload = await parseResponsePayload(tokenRes);
    if (!tokenRes.ok) {
      const message = getErrorMessage(tokenPayload, 'Could not acquire chat token');
      if (tokenRes.status === 401 || /invalid token/i.test(message)) {
        closeChatSocket(message);
      }
      throw new Error(message);
    }
    const token =
      tokenPayload &&
      typeof tokenPayload === 'object' &&
      typeof (tokenPayload as { token?: unknown }).token === 'string'
        ? (tokenPayload as { token: string }).token
        : null;
    if (!token) throw new Error("Could not acquire chat token");

    if (socket) socket.close();

    socket = new WebSocket(`${wsUrlForPath(WS_PATH)}?access_token=${encodeURIComponent(token)}`);

    socket.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'message') {
        const msg: Message = {
          id: data.payload.message_id,
          sender_id: data.payload.sender_id,
          conversation_id: data.payload.conversation_id,
          bucket: data.payload.bucket || '',
          ts: data.payload.ts || data.payload.created_at || '',
          type: data.payload.type || data.payload.message_type || 'text',
          text: data.payload.text,
          media_id: data.payload.media_id,
          reply_to_id: data.payload.reply_to_id,
          forwarded_from_id: data.payload.forwarded_from_id,
          created_at: data.payload.created_at
        };
        onMsg(msg);
        localListeners.forEach(cb => cb(msg));
        getChannel()?.postMessage(msg);
      } else if (data.type?.startsWith('call_') || data.type === 'ice_candidate') {
        const signal: CallSignal = data as CallSignal;
        callSignalListeners.forEach(cb => cb(signal));
      } else if (data.type === 'reaction' || data.type === 'reaction_update') {
        const update: ReactionUpdate = {
          conversation_id: data.payload.conversation_id,
          message_id: data.payload.message_id || data.payload.msg_id,
          user_id: data.payload.user_id,
          emoji: data.payload.emoji,
          added: data.payload.added,
        };
        reactionListeners.forEach(cb => cb(update));
      } else if (data.type === 'new_post') {
        const update: FeedUpdate = data.payload;
        feedUpdateListeners.forEach(cb => cb(update));
      } else if (data.type === 'typing') {
        const evt: TypingEvent = {
          conversation_id: data.payload.conversation_id,
          user_id: data.payload.user_id,
          is_typing: data.payload.is_typing ?? true,
        };
        typingListeners.forEach(cb => cb(evt));
      } else if (data.type === 'read_receipt') {
        const evt: ReadReceiptEvent = {
          conversation_id: data.payload.conversation_id,
          user_id: data.payload.user_id,
          message_id: data.payload.message_id,
          read_at: data.payload.read_at,
        };
        readReceiptListeners.forEach(cb => cb(evt));
      } else if (data.type === 'message_edited') {
        const evt: MessageEditedEvent = {
          conversation_id: data.payload.conversation_id,
          msg_id: data.payload.msg_id,
          new_text: data.payload.new_text,
          edited_at: data.payload.edited_at,
        };
        messageEditedListeners.forEach(cb => cb(evt));
      } else if (data.type === 'message_deleted') {
        const evt: MessageDeletedEvent = {
          conversation_id: data.payload.conversation_id,
          msg_id: data.payload.msg_id,
        };
        messageDeletedListeners.forEach(cb => cb(evt));
      } else if (data.type === 'post_update') {
        const update: PostInteractionUpdate = data.payload;
        postUpdateListeners.forEach(cb => cb(update));
      } else if (data.type === 'comment_update') {
        const update: ChannelCommentUpdate = data.payload;
        commentUpdateListeners.forEach(cb => cb(update));
      } else if (data.type === 'group_comment_update') {
        const update: GroupCommentUpdate = data.payload;
        groupCommentUpdateListeners.forEach(cb => cb(update));
      } else if (data.type === 'group_post_typing') {
        const evt: GroupTypingEvent = {
          post_id: data.post_id,
          user_id: data.user_id,
        };
        groupTypingListeners.forEach(cb => cb(evt));
      } else if (data.type === 'pin_update') {
        const evt: PinUpdateEvent = {
          conversation_id: data.payload.conversation_id,
          message_id: data.payload.message_id || null,
          pinned_by: data.payload.pinned_by || null,
          action: data.payload.action || (data.payload.message_id ? 'pin' : 'unpin'),
        };
        pinUpdateListeners.forEach(cb => cb(evt));
      } else if (data.type === 'presence_update') {
        const evt = { user_id: data.user_id as string, online: data.online as boolean };
        presenceListeners.forEach(cb => cb(evt));
      } else {
        const liveEvent = normalizeLiveEvent(data as Record<string, any>);
        if (liveEvent) {
          liveEventListeners.forEach(cb => cb(liveEvent));
        }
      }
    };

    socket.onopen = () => {
      wsRetryCount = 0; // reset on successful connection
      // Flush any signals that were queued while socket was connecting
      while (pendingSignals.length > 0) {
        const msg = pendingSignals.shift();
        if (msg && socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(msg));
        }
      }
      // Re-subscribe to any active rooms (post/update/call)
      activeRoomSubscriptions.forEach(sub => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(sub);
        }
      });
    };

    socket.onclose = () => {
      socket = null;

      if (!getSessionUser()) {
        return;
      }

      if (wsRetryCount >= WS_MAX_RETRIES) {
        console.warn(`Chat: gave up after ${WS_MAX_RETRIES} retries. Refresh the page to reconnect.`);
        return;
      }
      const delay = WS_BASE_DELAY * Math.pow(2, wsRetryCount);
      wsRetryCount++;
      console.log(`Chat link severed. Retry ${wsRetryCount}/${WS_MAX_RETRIES} in ${delay / 1000}s...`);
      setTimeout(() => connectToHub(onMsg), delay);
    };
  } catch (err) {
    console.error("Live link failed:", err);
  }
};

/**
 * Conversation & Message Actions
 */
export const fetchConversations = async (limit = 20, cursor?: string, background = false) => {
  const query = new URLSearchParams({ limit: limit.toString() });
  if (cursor) query.set('cursor', cursor);
  return chatClient.request(`/conversations?${query.toString()}`, {}, background);
};

export const getOrCreateDirectConversation = async (otherUserId: string) => {
  return chatClient.request('/conversations/direct', {
    method: 'POST',
    body: JSON.stringify({ other_user_id: otherUserId })
  });
};

export const createGroupConversation = async (name: string, memberIds: string[]) => {
  return chatClient.request('/conversations/group', {
    method: 'POST',
    body: JSON.stringify({ title: name, member_ids: memberIds })
  });
};

export const fetchMessages = async (conversationId: string, limit = 30, cursor?: string, background = false) => {
  const query = new URLSearchParams({ limit: limit.toString() });
  if (cursor) query.set('cursor', cursor);
  const json = await chatClient.request(`/conversations/${conversationId}/messages?${query.toString()}`, {}, background);
  const raw = Array.isArray(json.data) ? json.data : [];
  return { ...json, data: raw.map(normalizeMessage) };
};

export interface SendMessageOptions {
  type?: string;
  text?: string;
  media_id?: string;
  reply_to_id?: string;
  forwarded_from_id?: string;
  feeling?: string;
}

export const sendMessage = async (conversationId: string, text: string, feeling?: string, opts?: Partial<SendMessageOptions>) => {
  const msgType = opts?.type || 'text';
  const body: Record<string, unknown> = {
    type: msgType,
    text,
    ...opts,
  };
  if (feeling) body.feeling = feeling;
  const json = await chatClient.request(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify(body)
  });
  return { ...json, data: normalizeMessage(json.data) };
};

export const toggleReaction = async (
  conversationId: string, messageId: string, emoji: string, bucket?: string, ts?: string
) => {
  return chatClient.request(`/conversations/${conversationId}/messages/${messageId}/reactions`, {
    method: 'PUT',
    body: JSON.stringify({ emoji, bucket, ts })
  });
};

export const editMessage = async (conversationId: string, messageId: string, text: string, timestamp: string) => {
  return chatClient.request(`/conversations/${conversationId}/messages/${messageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ text, timestamp })
  });
};

export const deleteMessage = async (conversationId: string, messageId: string, timestamp: string) => {
  return chatClient.request(`/conversations/${conversationId}/messages/${messageId}`, {
    method: 'DELETE',
    body: JSON.stringify({ timestamp })
  });
};

export const markConversationRead = async (conversationId: string, messageId: string) => {
  return chatClient.request(`/conversations/${conversationId}/read`, {
    method: 'POST',
    body: JSON.stringify({ message_id: messageId })
  });
};

export const sendTypingIndicator = async (conversationId: string) => {
  return chatClient.request(`/conversations/${conversationId}/typing`, {
    method: 'POST',
  });
};

export const sendMediaMessage = async (conversationId: string, mediaId: string, messageType: string, text?: string) => {
  return sendMessage(conversationId, text || '', undefined, {
    type: messageType === 'image' || messageType === 'video' || messageType === 'audio' ? 'media' : 'text',
    media_id: mediaId,
  });
};

export const replyToMessage = async (conversationId: string, replyToId: string, text: string) => {
  return sendMessage(conversationId, text, undefined, {
    reply_to_id: replyToId,
  });
};

export const forwardMessage = async (targetConversationId: string, forwardedFromId: string, text: string) => {
  return sendMessage(targetConversationId, text, undefined, {
    forwarded_from_id: forwardedFromId,
  });
};

export const updateConversation = async (conversationId: string, name?: string, iconUrl?: string) => {
  return chatClient.request(`/conversations/${conversationId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name, icon_url: iconUrl })
  });
};

export const leaveConversation = async (conversationId: string) => {
  return chatClient.request(`/conversations/${conversationId}`, {
    method: 'DELETE',
  });
};

export const addMemberToConversation = async (conversationId: string, userId: string) => {
  return chatClient.request(`/conversations/${conversationId}/members`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId })
  });
};

export const removeMemberFromConversation = async (conversationId: string, userId: string) => {
  return chatClient.request(`/conversations/${conversationId}/members/${userId}`, {
    method: 'DELETE',
  });
};

/**
 * Message Requests (spec §3.3) — conversations that arrive in the
 * "Requests" folder until the recipient accepts or declines them.
 */
export interface ConversationMember {
  user_id: string;
  role?: string;
  display_name?: string;
  avatar_media_id?: string;
}

export interface Conversation {
  id: string;
  type: string;
  title?: string | null;
  created_by?: string | null;
  is_request?: boolean;
  members?: ConversationMember[];
  last_message?: Message | null;
  created_at: string;
  updated_at: string;
}

/** Lists conversations sitting in the Requests folder (is_request = true). */
export const fetchMessageRequests = async (limit = 50, offset = 0) => {
  const query = new URLSearchParams({ limit: limit.toString(), offset: offset.toString() });
  return chatClient.request(`/requests?${query.toString()}`);
};

/** Accepts a message request, promoting the conversation to the main inbox. */
export const acceptMessageRequest = async (conversationId: string) => {
  return chatClient.request(`/conversations/${conversationId}/requests/accept`, {
    method: 'POST',
  });
};

/** Declines a message request. */
export const declineMessageRequest = async (conversationId: string) => {
  return chatClient.request(`/conversations/${conversationId}/requests/decline`, {
    method: 'POST',
  });
};

export const subscribeToMessages = (cb: (m: Message) => void) => {
  localListeners.add(cb);

  const channel = getChannel();
  const handler = channel ? (e: MessageEvent) => cb(e.data) : null;
  if (channel && handler) {
    channel.addEventListener('message', handler);
  }

  return () => {
    localListeners.delete(cb);
    if (channel && handler) {
      channel.removeEventListener('message', handler);
    }
  };
};

export const subscribeToReactions = (cb: (r: ReactionUpdate) => void) => {
  reactionListeners.add(cb);
  return () => { reactionListeners.delete(cb); };
};

export const subscribeToTyping = (cb: (e: TypingEvent) => void) => {
  typingListeners.add(cb);
  return () => { typingListeners.delete(cb); };
};

export const subscribeToReadReceipts = (cb: (e: ReadReceiptEvent) => void) => {
  readReceiptListeners.add(cb);
  return () => { readReceiptListeners.delete(cb); };
};

export const subscribeToMessageEdits = (cb: (e: MessageEditedEvent) => void) => {
  messageEditedListeners.add(cb);
  return () => { messageEditedListeners.delete(cb); };
};

export const subscribeToMessageDeletes = (cb: (e: MessageDeletedEvent) => void) => {
  messageDeletedListeners.add(cb);
  return () => { messageDeletedListeners.delete(cb); };
};

export const subscribeToPinUpdates = (cb: (e: PinUpdateEvent) => void) => {
  pinUpdateListeners.add(cb);
  return () => { pinUpdateListeners.delete(cb); };
};

export const sendSignaling = (data: object) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(data));
  } else {
    // Queue for delivery when socket opens
    pendingSignals.push(data);
  }
};

export const subscribeToCallSignals = (cb: (signal: CallSignal) => void) => {
  callSignalListeners.add(cb);
  return () => { callSignalListeners.delete(cb); };
};

export const subscribeToFeedUpdates = (cb: (f: FeedUpdate) => void) => {
  feedUpdateListeners.add(cb);
  return () => { feedUpdateListeners.delete(cb); };
};

export const subscribeToPostUpdates = (cb: (u: PostInteractionUpdate) => void) => {
  postUpdateListeners.add(cb);
  return () => { postUpdateListeners.delete(cb); };
};

export const subscribeToPresenceUpdates = (cb: (e: { user_id: string; online: boolean }) => void) => {
  presenceListeners.add(cb);
  return () => { presenceListeners.delete(cb); };
};

// ---------------------------------------------------------------------------
// Pin Message API
// ---------------------------------------------------------------------------

export interface PinnedMessage {
  conversation_id: string;
  message_id: string;
  pinned_by: string;
  pinned_at: string;
  message?: Message;
}

export const pinMessage = async (conversationId: string, messageId: string) => {
  return chatClient.request(`/conversations/${conversationId}/pin/${messageId}`, {
    method: 'POST',
  });
};

export const unpinMessage = async (conversationId: string) => {
  return chatClient.request(`/conversations/${conversationId}/pin`, {
    method: 'DELETE',
  });
};

export const getPinnedMessage = async (conversationId: string): Promise<PinnedMessage | null> => {
  try {
    const json = await chatClient.request(`/conversations/${conversationId}/pin`);
    const raw = json.data || json;
    if (!raw || !raw.message_id) return null;
    return {
      conversation_id: raw.conversation_id || conversationId,
      message_id: raw.message_id || raw.msg_id,
      pinned_by: raw.pinned_by,
      pinned_at: raw.pinned_at,
      message: raw.message ? normalizeMessage(raw.message) : undefined,
    };
  } catch {
    return null;
  }
};

// Post room subscription â€” subscribe to per-post real-time updates via WS gateway
export const subscribeToPostRoom = (postId: string) => {
  const msg = { type: 'subscribe_post', post_id: postId };
  activeRoomSubscriptions.add(JSON.stringify(msg));
  sendSignaling(msg);
};

export const unsubscribeFromPostRoom = (postId: string) => {
  const subMsg = JSON.stringify({ type: 'subscribe_post', post_id: postId });
  activeRoomSubscriptions.delete(subMsg);
  sendSignaling({ type: 'unsubscribe_post', post_id: postId });
};

// Call room subscription â€” subscribe to per-call real-time updates via WS gateway
export const subscribeToCallRoom = (callId: string) => {
  sendSignaling({ type: 'subscribe_call', call_id: callId });
};

export const unsubscribeFromCallRoom = (callId: string) => {
  sendSignaling({ type: 'unsubscribe_call', call_id: callId });
};

// Update room subscription â€” subscribe to per-update real-time comment updates via WS gateway
export const subscribeToUpdateRoom = (updateId: string) => {
  const msg = { type: 'subscribe_update', update_id: updateId };
  activeRoomSubscriptions.add(JSON.stringify(msg));
  sendSignaling(msg);
};

export const unsubscribeFromUpdateRoom = (updateId: string) => {
  const subMsg = JSON.stringify({ type: 'subscribe_update', update_id: updateId });
  activeRoomSubscriptions.delete(subMsg);
  sendSignaling({ type: 'unsubscribe_update', update_id: updateId });
};

export const subscribeToCommentUpdates = (cb: (u: ChannelCommentUpdate) => void) => {
  commentUpdateListeners.add(cb);
  return () => { commentUpdateListeners.delete(cb); };
};

export const subscribeToLiveStream = (streamId: string) => {
  const msg = { type: 'subscribe_live_stream', stream_id: streamId };
  activeRoomSubscriptions.add(JSON.stringify(msg));
  sendSignaling(msg);
};

export const unsubscribeFromLiveStream = (streamId: string) => {
  const subMsg = JSON.stringify({ type: 'subscribe_live_stream', stream_id: streamId });
  activeRoomSubscriptions.delete(subMsg);
  sendSignaling({ type: 'unsubscribe_live_stream', stream_id: streamId });
};

export const subscribeToLiveEvents = (cb: (event: LiveRealtimeEvent) => void) => {
  liveEventListeners.add(cb);
  return () => { liveEventListeners.delete(cb); };
};

// Group post room subscription â€” subscribe to per-group-post real-time comment updates via WS gateway
export const subscribeToGroupPostRoom = (postId: string) => {
  const msg = { type: 'subscribe_group_post', post_id: postId };
  activeRoomSubscriptions.add(JSON.stringify(msg));
  sendSignaling(msg);
};

export const unsubscribeFromGroupPostRoom = (postId: string) => {
  const subMsg = JSON.stringify({ type: 'subscribe_group_post', post_id: postId });
  activeRoomSubscriptions.delete(subMsg);
  sendSignaling({ type: 'unsubscribe_group_post', post_id: postId });
};

export const subscribeToGroupCommentUpdates = (cb: (u: GroupCommentUpdate) => void) => {
  groupCommentUpdateListeners.add(cb);
  return () => { groupCommentUpdateListeners.delete(cb); };
};

export const subscribeToGroupTyping = (cb: (e: GroupTypingEvent) => void) => {
  groupTypingListeners.add(cb);
  return () => { groupTypingListeners.delete(cb); };
};

export const sendGroupPostTyping = (postId: string) => {
  sendSignaling({ type: 'group_post_typing', post_id: postId });
};

// ---------------------------------------------------------------------------
// Presence API
// ---------------------------------------------------------------------------

export const fetchPresence = async (userIds: string[]): Promise<Record<string, boolean>> => {
  if (userIds.length === 0) return {};
  try {
    const json = await chatClient.request<{ data: Record<string, boolean> }>('/presence', {
      method: 'POST',
      body: JSON.stringify({ user_ids: userIds }),
    }, true);
    return json.data ?? json;
  } catch {
    return {};
  }
};
