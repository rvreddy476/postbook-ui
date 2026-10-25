import { getOrCreateDirectConversation, sendPostMessage } from '@/services/messageService';

/*
  "Send in Messages" (audit T-25): share a post into a one-to-one chat.

  It opens (or creates) the direct conversation exactly as the messenger's
  New message sheet does — POST /conversations/direct — and then posts
  {type:"post", post_id, text?} into it. The server decides whether that is
  allowed; this file only turns its answer into words. The profile Message
  button is untouched: it stays request-only (founder rule).
*/

/**
 * The conversation id from a get-or-create answer. Takes the first NON-EMPTY
 * candidate: Go marshals missing fields as "", so a plain ?? chain would keep
 * an empty string and drop the real id.
 */
export function conversationIdOf(res: unknown): string | null {
  const r = (res ?? {}) as Record<string, any>;
  const id = [r?.data?.conversation_id, r?.data?.id, r?.conversation_id, r?.id].find(
    (v): v is string => typeof v === 'string' && v.length > 0,
  );
  return id ?? null;
}

export interface SendPostDeps {
  openDirect: (userId: string) => Promise<unknown>;
  send: (conversationId: string, postId: string, caption?: string) => Promise<unknown>;
}

const defaultDeps: SendPostDeps = {
  openDirect: getOrCreateDirectConversation,
  send: sendPostMessage,
};

/** Open the direct chat with `recipientId` and share `postId` into it. Resolves to the conversation id. */
export async function sendPostToUser(
  recipientId: string,
  postId: string,
  caption?: string,
  deps: SendPostDeps = defaultDeps,
): Promise<string> {
  const conversationId = conversationIdOf(await deps.openDirect(recipientId));
  if (!conversationId) throw new Error('no conversation id');
  await deps.send(conversationId, postId, caption?.trim() || undefined);
  return conversationId;
}

function firstName(name: string | undefined): string | null {
  return (name ?? '').trim().split(/\s+/)[0] || null;
}

/**
 * The line shown when a share fails, by the server's code (ChatApiError
 * carries it). A plain Error from an older path falls back to its text.
 */
export function sendPostErrorText(err: unknown, recipientName?: string): string {
  const e = (err ?? {}) as { code?: unknown; status?: unknown; message?: unknown };
  const code = typeof e.code === 'string' ? e.code : '';
  const status = typeof e.status === 'number' ? e.status : 0;
  const message = typeof e.message === 'string' ? e.message : '';
  const who = firstName(recipientName);

  // A post cannot be the first message of a message request.
  if (code === 'INVALID_REQUEST_MESSAGE' || status === 422) {
    return `A post can't start a message request. Send ${who ?? 'them'} a message first — you can share posts once they accept.`;
  }
  if (code === 'AWAITING_REQUEST_ACCEPTANCE') {
    return `${who ? `${who} hasn't` : "They haven't"} accepted your message request yet. You can share posts once they do.`;
  }
  if (
    code === 'MESSAGING_NOT_ALLOWED' || code === 'FIRST_MOVE_PENDING' || status === 403 ||
    /forbidden|not allowed|not permitted|blocked/i.test(message)
  ) {
    return `${who ?? 'This person'} isn't accepting messages from you.`;
  }
  if (code === 'RATE_LIMITED' || status === 429) {
    return "You're sending too fast. Wait a moment and try again.";
  }
  return "Couldn't send the post. Try again.";
}
