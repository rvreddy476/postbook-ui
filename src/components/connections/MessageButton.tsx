'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Loader2, MessageCircle, Send } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { getOrCreateDirectConversation } from '@/services/messageService';
import { useGlobalToast } from '@/contexts/ToastContext';
import { markRequestSent, useSentRequests } from '@/hooks/useSentRequests';
import { getSession } from '@/services/authService';
import {
    createConversationErrorText,
    messageButtonView,
    readCreatedConversation,
    threadHref,
    who,
} from '@/lib/chat/dmConsent';

/**
 * The one way to reach somebody (DM consent contract §4).
 *
 * graph-service decides, through check-batch's `message` decision:
 *   allow            "Message"        → opens our chat
 *   message_request  "Send request"   → opens a request thread (one text
 *                    "Requested"        message until they accept); once mine
 *                                       is waiting it says Requested and
 *                                       opens that thread
 *   deny             disabled "Message" with the reason in words
 *   unavailable      no control at all (a block is never shown as one)
 *
 * A tap creates (or finds) the direct conversation and OPENS IT. Creating a
 * conversation with someone who only accepts requests is what opens the
 * request; the server, not the cached decision, says which it was
 * (`is_request` — missing means a normal chat).
 */

interface MessageButtonProps {
    targetUserId: string;
    /** Their @handle, for the reason text ("@asha isn't taking messages"). */
    targetUsername?: string | null;
    targetName?: string | null;
    /** "icon" for a list row, "full" for a profile's action bar. */
    variant?: 'icon' | 'full';
    className?: string;
}

export default function MessageButton({
    targetUserId,
    targetUsername,
    targetName,
    variant = 'icon',
    className,
}: MessageButtonProps) {
    const router = useRouter();
    const toast = useGlobalToast();
    const { data: permissions } = usePermissions([targetUserId], ['message']);
    const { hasSent } = useSentRequests();
    const [busy, setBusy] = useState(false);

    const target = who(targetUsername, targetName);
    const view = messageButtonView(permissions?.get(targetUserId)?.message, {
        target,
        pendingOutgoing: hasSent(targetUserId),
    });

    if (view.kind === 'hidden') return null;

    const disabled = view.kind === 'disabled' || view.kind === 'loading';
    const note = view.kind === 'disabled' ? view.note : '';
    const label = view.label;

    const handleClick = async () => {
        if (busy) return;
        if (view.kind === 'disabled') {
            if (note) toast({ type: 'info', title: note });
            return;
        }
        if (view.kind === 'loading') return;
        setBusy(true);
        try {
            const created = readCreatedConversation(await getOrCreateDirectConversation(targetUserId));
            if (!created.id) throw new Error('No conversation id returned');
            const myId = getSession()?.id ?? '';
            // Only a request I opened counts as "Requested"; a normal chat does not.
            if (created.isRequest && (!created.createdBy || created.createdBy === myId)) markRequestSent(targetUserId);
            router.push(threadHref(created.id));
        } catch (err) {
            toast({ type: 'error', title: createConversationErrorText(err, target) });
        } finally {
            setBusy(false);
        }
    };

    const Icon = busy ? Loader2 : view.kind === 'requested' ? Clock : view.kind === 'request' ? Send : MessageCircle;
    const quiet = view.kind === 'requested' || disabled;
    const tone = quiet
        ? 'border border-brand-outline bg-primary-tint text-primary-ink'
        : 'bg-primary-grad text-white';
    const dim = disabled ? 'opacity-60 cursor-not-allowed hover:shadow-sm active:scale-100' : '';
    const title = note || label;

    if (variant === 'full') {
        return (
            <span className="inline-flex flex-col items-center gap-1">
                <button
                    type="button"
                    onClick={handleClick}
                    aria-disabled={disabled || undefined}
                    title={title}
                    className={
                        className ??
                        `flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold tracking-wider shadow-sm transition-all hover:shadow-md active:scale-[0.98] ${tone} ${dim}`
                    }
                >
                    <Icon className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} strokeWidth={2} />
                    {label}
                </button>
                {note ? (
                    <span className="max-w-[200px] text-center text-[11px] leading-tight text-brand-text/60">{note}</span>
                ) : null}
            </span>
        );
    }

    return (
        <button
            type="button"
            onClick={handleClick}
            aria-disabled={disabled || undefined}
            aria-label={note ? `${label}: ${note}` : label}
            title={title}
            className={
                className ??
                `flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-sm transition-all hover:shadow-md active:scale-[0.98] ${tone} ${dim}`
            }
        >
            <Icon
                className={`h-[18px] w-[18px] ${busy ? 'animate-spin' : ''}`}
                strokeWidth={1.9}
            />
        </button>
    );
}
