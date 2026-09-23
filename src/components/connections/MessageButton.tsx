'use client';

import React, { useState } from 'react';
import { Check, Loader2, MessageCircle } from 'lucide-react';
import { usePermissions, messageAffordance } from '@/hooks/usePermissions';
import { getOrCreateDirectConversation } from '@/services/messageService';
import { useGlobalToast } from '@/contexts/ToastContext';
import { markRequestSent } from '@/hooks/useSentRequests';

/**
 * The one way to reach somebody.
 *
 * Connect is gone from the product: a connection is formed by ACCEPTING A
 * MESSAGE REQUEST, which message-service does on accept via
 * ensureGraphConnection. So this is the only relationship control a normal
 * account needs, and it appears wherever people are listed.
 *
 * A tap SENDS THE REQUEST. It does not open the messenger.
 *
 * That works because creating the direct conversation is itself what opens a
 * request: message-service marks it is_request and writes the
 * chat.message_requests row at creation, before any message exists. It now
 * also emits MessageRequestCreated there, so the recipient is actually
 * notified — until that change a request opened this way created the row,
 * appeared in their Requests lane, and told them nothing.
 *
 * IT IS NEVER DISABLED. The permission engine is still asked, because it is
 * what tells us whether this will be a thread or a request and that is worth
 * saying before the tap. But a refusal does not take the control away: the
 * server enforces its own answer, and a refusal is reported in words when it
 * happens rather than as a grey icon that explains nothing.
 */

interface MessageButtonProps {
    targetUserId: string;
    /*
      There is deliberately NO navigation callback.

      This took a navigation callback and called it when the pair could
      already talk, which is how a control told not to open the messenger
      ended up opening the messenger. Removing the prop means a future edit
      cannot quietly restore that: there is nothing here to navigate with.
    */
    /** "icon" for a list row, "full" for a profile's action bar. */
    variant?: 'icon' | 'full';
    className?: string;
}

export default function MessageButton({
    targetUserId,
    variant = 'icon',
    className,
}: MessageButtonProps) {
    const { data: permissions } = usePermissions([targetUserId], ['message']);
    const affordance = messageAffordance(permissions?.get(targetUserId)?.message);
    const toast = useGlobalToast();

    const [busy, setBusy] = useState(false);
    const [sent, setSent] = useState(false);

    // Only used for the LABEL, never for what the click does. This used to
    // decide between sending and navigating, and it is false in two cases —
    // "they can already talk" and "the permission check has not answered
    // yet" — so a click landing before the response navigated to the
    // messenger. A race, which is why it happened sometimes and not others.
    const isRequest = affordance.state === 'request';

    const handleClick = async () => {
        if (busy || sent) return;
        /*
          IT NEVER NAVIGATES.

          There was a branch here that opened the thread when the pair could
          already talk. That was my own addition, not what was asked for, and
          combined with the loading case above it meant the button sometimes
          did the one thing it was told not to do. The instruction is simple:
          a tap sends, and says so.
        */
        setBusy(true);
        try {
            // Creating the conversation IS the request; there is nothing else
            // to send. It is idempotent, so a pair who can already talk get
            // their existing thread back rather than a second one.
            const res = await getOrCreateDirectConversation(targetUserId);
            const conversation = (res?.data ?? res) as { is_request?: boolean } | undefined;
            // The SERVER decides which of the two this was, not the client's
            // cached permission guess.
            const wasRequest = conversation?.is_request !== false;
            setSent(true);
            /*
              Record it so every suggestion list drops this person at once.
              Those lists filtered on connection_status === 'pending_sent',
              which a MESSAGE request never sets — so somebody just messaged
              stayed in "People you may know" asking to be messaged again.
            */
            markRequestSent(targetUserId);
            toast({
                type: 'success',
                title: wasRequest ? 'Message request sent' : 'Conversation ready',
                description: wasRequest
                    ? 'Please wait for them to accept. Once they do, you are connected and can talk freely.'
                    : 'Open it from Messages whenever you like.',
            });
        } catch (err) {
            toast({
                type: 'error',
                title: 'Could not send the request',
                description:
                    err instanceof Error && err.message ? err.message : 'Please try again.',
            });
        } finally {
            setBusy(false);
        }
    };

    const label = sent
        ? 'Message request sent'
        : isRequest
          ? 'Send a message request'
          : 'Message';

    const Icon = busy ? Loader2 : sent ? Check : MessageCircle;

    if (variant === 'full') {
        return (
            <button
                type="button"
                onClick={handleClick}
                title={label}
                className={
                    className ??
                    `flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold tracking-wider shadow-sm transition-all hover:shadow-md active:scale-[0.98] ${
                        sent
                            ? 'border border-brand-outline bg-primary-tint text-primary-ink'
                            : 'bg-primary-grad text-white'
                    }`
                }
            >
                <Icon className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} strokeWidth={2} />
                {sent ? 'Request sent' : isRequest ? 'Message request' : 'Message'}
            </button>
        );
    }

    return (
        <button
            type="button"
            onClick={handleClick}
            aria-label={label}
            title={label}
            className={
                className ??
                `flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-sm transition-all hover:shadow-md active:scale-[0.98] ${
                    sent
                        ? 'border border-brand-outline bg-primary-tint text-primary-ink'
                        : 'bg-primary-grad text-white'
                }`
            }
        >
            <Icon
                className={`h-[18px] w-[18px] ${busy ? 'animate-spin' : ''}`}
                strokeWidth={1.9}
            />
        </button>
    );
}
