export interface CommentChange {
  event_id: string;
  version: number;
  post_id: string;
  comment_id: string;
  parent_id?: string;
  change: 'created' | 'replied' | 'edited' | 'deleted' | 'reaction' | 'moderated';
  actor_id: string;
  comments: number;
}

const changes = new Set(['created', 'replied', 'edited', 'deleted', 'reaction', 'moderated']);
export const isCommentCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** Bounded dedupe plus a per-post high-water mark; reconnect does not reset ordering. */
export class CommentChangeGate {
  private posts = new Map<string, { version: number; ids: Set<string> }>();
  accept(value: unknown): value is CommentChange {
    if (!value || typeof value !== 'object') return false;
    const e = value as CommentChange;
    if (!e.post_id || !e.comment_id || !e.event_id || !Number.isSafeInteger(e.version)
      || e.version <= 0 || !changes.has(e.change) || !isCommentCount(e.comments)) return false;
    const state = this.posts.get(e.post_id);
    if (state && (state.ids.has(e.event_id) || e.version <= state.version)) return false;
    const ids = state?.ids ?? new Set<string>();
    ids.add(e.event_id);
    if (ids.size > 500) ids.delete(ids.values().next().value!);
    this.posts.delete(e.post_id);
    this.posts.set(e.post_id, { version: e.version, ids });
    if (this.posts.size > 500) this.posts.delete(this.posts.keys().next().value!);
    return true;
  }
  clear() { this.posts.clear(); }
}

/** Post subscriptions are desired state, never queued stale subscribe/unsubscribe frames. */
export class PostRoomSubscriptions {
  private refs = new Map<string, number>();
  private connected = false;
  constructor(private send: (frame: { type: string; post_id: string }) => void) {}
  subscribe(postId: string) {
    const count = this.refs.get(postId) ?? 0;
    this.refs.set(postId, count + 1);
    if (!count && this.connected) this.send({ type: 'subscribe_post', post_id: postId });
  }
  unsubscribe(postId: string) {
    const count = this.refs.get(postId) ?? 0;
    if (count > 1) { this.refs.set(postId, count - 1); return; }
    this.refs.delete(postId);
    if (count && this.connected) this.send({ type: 'unsubscribe_post', post_id: postId });
  }
  onOpen() { this.connected = true; this.refresh(); }
  onClose() { this.connected = false; }
  refresh() {
    if (this.connected) for (const postId of this.refs.keys()) {
      this.send({ type: 'subscribe_post', post_id: postId });
    }
  }
}

/** Discard any legacy identity fields rather than allowing consumers to display them. */
export function groupTypingSignal(value: { post_id?: unknown }) {
  return typeof value.post_id === 'string' && value.post_id ? { post_id: value.post_id } : null;
}

/** The same lifecycle binding is used by the hook and exercised without a browser in tests. */
export function bindPostThread(postId: string, io: {
  subscribe: (id: string) => void;
  unsubscribe: (id: string) => void;
  onConnected: (cb: () => void) => () => void;
  onChange: (cb: (event: CommentChange) => void) => () => void;
  onUpdate: (cb: (event: { post_id: string; comments?: number; likes?: number; shares?: number }) => void) => () => void;
  setCount: (count: number) => void;
  refreshThread: () => void;
  refresh: () => void;
}) {
  const disconnected = io.onConnected(io.refresh);
  const changed = io.onChange(event => {
    if (event.post_id !== postId) return;
    io.setCount(event.comments);
    // All changes (including reactions) re-read through the authorized endpoint.
    io.refreshThread();
  });
  const updated = io.onUpdate(event => {
    if (event.post_id !== postId) return;
    if (isCommentCount(event.comments)) io.setCount(event.comments);
    io.refreshThread();
    // Preserve the legacy reaction/share refresh as well as the new comment path.
    if (event.likes !== undefined || event.shares !== undefined) io.refresh();
  });
  io.subscribe(postId);
  return () => { disconnected(); changed(); updated(); io.unsubscribe(postId); };
}
