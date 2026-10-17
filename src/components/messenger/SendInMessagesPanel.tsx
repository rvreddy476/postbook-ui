'use client';

import { useEffect, useState } from 'react';

import { getSession } from '@/services/authService';
import type { User } from '@/types';
import NewMessageSheet from './NewMessageSheet';

/*
  "Send in Messages" inside a share sheet (audit T-25): the messenger's own
  New message picker, in share mode, given a box to fill. Picking a person
  and pressing send opens (or creates) the direct chat the way the
  messenger does and shares the post into it; a refusal from the server is
  shown in the picker in plain words (sendPost.ts).
*/
export function SendInMessagesPanel({
  postId,
  onBack,
  onSent,
}: {
  postId: string;
  /** ✕ / Escape: back to the share options. */
  onBack: () => void;
  onSent: (recipient: User) => void;
}) {
  return (
    <div className="relative h-[26rem] max-h-[70vh] overflow-hidden">
      <NewMessageSheet sharePostId={postId} onClose={onBack} onOpened={onSent} />
    </div>
  );
}

/**
 * Whether the share sheet offers "Send in Messages": a post to send and a
 * signed-in viewer. Read after mount, so the server render never offers it.
 */
export function useCanSendInMessages(postId: string | null | undefined): boolean {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    setSignedIn(Boolean(getSession()?.id));
  }, []);
  return signedIn && Boolean(postId);
}
