'use client';

import React, { useState } from 'react';
import { Check, Loader2, MessagesSquare } from 'lucide-react';
import { usePermissions, messageAffordance } from '@/hooks/usePermissions';
import { getOrCreateDirectConversation } from '@/services/messageService';
import { useGlobalToast } from '@/contexts/ToastContext';

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
    /** Opens the conversation. Used when the pair can already talk. */
    onMessage: () => void;
    /** "icon" for a list row, "full" for a profile's action bar. */
    variant?: 'icon' | 'full';
    className?: string;
}

export default function MessageButton({
    targetUserId,
    onMessage,
    variant = 'icon',
    className,
}: MessageButtonProps) {
    const { data: permissions } = usePermissions([targetUserId], ['message']);
    const affordance = messageAffordance(permissions?.get(targetUserId)?.message);
    const toast = useGlobalToast();

    const [busy, setBusy] = useState(false);
    const [sent, setSent] = useState(false);

    // A thread they can already have goes straight to the messenger; only a
    // REQUEST is sent in place. Sending where a conversation already exists
    // would take someone away from a thread they could simply open.
    const isRequest = affordance.state === 'request';

    const handleClick = async () => {
        if (busy || sent) return;
        if (!isRequest) {
            onMessage();
            return;
        }
        setBusy(true);
        try {
            // Creating the conversation IS the request; there is nothing else
            // to send. The server rate-limits this, so a refusal here is a
            // real answer and is shown as one.
            await getOrCreateDirectConversation(targetUserId);
            setSent(true);
            toast({
                type: 'success',
                title: 'Message request sent',
                description:
                    'Please wait for them to accept. Once they do, you are connected and can talk freely.',
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

    const Icon = busy ? Loader2 : sent ? Check : MessagesSquare;

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
