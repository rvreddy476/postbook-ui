'use client';

import React from 'react';
import { MessagesSquare } from 'lucide-react';
import { usePermissions, messageAffordance } from '@/hooks/usePermissions';

/**
 * The one way to reach somebody.
 *
 * Connect is gone from the product: a connection is now formed by ACCEPTING A
 * MESSAGE REQUEST, which message-service already does on accept via
 * ensureGraphConnection. So this is the only relationship control a normal
 * account needs, and it appears wherever people are listed.
 *
 * IT IS NEVER DISABLED, at the founder's instruction. The permission engine is
 * still consulted — it is what tells us whether the first message will land as
 * a thread or as a request, which is worth saying before someone types — but a
 * refusal is not allowed to take the control away. A greyed-out icon tells a
 * reader nothing they can act on, and the server enforces its own answer
 * regardless of what this button believes. If a send is refused, the composer
 * reports the server's reason, which is the honest moment for it.
 */

interface MessageButtonProps {
    targetUserId: string;
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

    // What the reader is told before they commit to typing. "Message request"
    // is the honest label when that is what the first message will be — the
    // server allows one text-only message and nothing more until it is
    // accepted, and finding that out afterwards feels like a failure.
    const isRequest = affordance.state === 'request';
    const label = isRequest ? 'Send a message request' : 'Message';

    if (variant === 'full') {
        return (
            <button
                type="button"
                onClick={onMessage}
                title={label}
                className={
                    className ??
                    'bg-primary-grad flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold tracking-wider text-white shadow-sm transition-all hover:shadow-md active:scale-[0.98]'
                }
            >
                <MessagesSquare className="h-4 w-4" strokeWidth={2} />
                {isRequest ? 'Message request' : 'Message'}
            </button>
        );
    }

    return (
        <button
            type="button"
            onClick={onMessage}
            aria-label={label}
            title={label}
            className={
                className ??
                'bg-primary-grad flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white shadow-sm transition-all hover:shadow-md active:scale-[0.98]'
            }
        >
            <MessagesSquare className="h-[18px] w-[18px]" strokeWidth={1.9} />
        </button>
    );
}
