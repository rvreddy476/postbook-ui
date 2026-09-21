"use client"

import { useEffect, useMemo, useState } from "react"
import { Clock, UserCheck, UserMinus, UserPlus, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import {
    useAcceptFriendRequest,
    useCancelFriendRequest,
    useRejectFriendRequest,
    useSendFriendRequest,
} from "@/hooks/useConnections"
import type { Relationship } from "@/types/profile"

type FriendRequestButtonProps = {
    targetUserId: string
    targetUsername?: string
    relationship?: Relationship | null
    addLabel?: string
    sentLabel?: string
    friendLabel?: string
    showIcon?: boolean
    showIncomingActions?: boolean
    allowCancel?: boolean
    className?: string
    sentClassName?: string
    friendClassName?: string
    acceptClassName?: string
    declineClassName?: string
    incomingWrapperClassName?: string
    disabled?: boolean
    onSent?: () => void
    onAccepted?: () => void
    onDeclined?: () => void
    onCanceled?: () => void
    onError?: (error: unknown) => void
    onFriendsClick?: () => void
}

export function FriendRequestButton({
    targetUserId,
    targetUsername,
    relationship,
    addLabel = "Add Friend",
    sentLabel = "Request sent",
    friendLabel = "Friends",
    showIcon = true,
    showIncomingActions = true,
    allowCancel = true,
    className,
    sentClassName,
    friendClassName,
    acceptClassName,
    declineClassName,
    incomingWrapperClassName,
    disabled,
    onSent,
    onAccepted,
    onDeclined,
    onCanceled,
    onError,
    onFriendsClick,
}: FriendRequestButtonProps) {
    const [localRequestSent, setLocalRequestSent] = useState(false)
    const sendRequest = useSendFriendRequest()
    const cancelRequest = useCancelFriendRequest()
    const acceptRequest = useAcceptFriendRequest()
    const declineRequest = useRejectFriendRequest()

    useEffect(() => {
        setLocalRequestSent(false)
    }, [targetUserId])

    const state = useMemo(() => {
        const status = relationship?.connection_status
        return {
            isConnected: !!relationship?.is_connection || status === "accepted",
            requestSent: localRequestSent || status === "pending_sent",
            requestReceived: status === "pending_received",
        }
    }, [relationship, localRequestSent])

    const target = targetUsername || targetUserId
    const isBusy =
        sendRequest.isPending ||
        cancelRequest.isPending ||
        acceptRequest.isPending ||
        declineRequest.isPending

    const handleSend = () => {
        if (!target || state.requestSent || state.isConnected) return
        setLocalRequestSent(true)
        sendRequest.mutate(target, {
            onSuccess: onSent,
            onError: (error) => {
                setLocalRequestSent(false)
                onError?.(error)
            },
        })
    }

    const handleCancel = () => {
        if (!allowCancel || !state.requestSent) return
        cancelRequest.mutate(targetUserId, {
            onSuccess: () => {
                setLocalRequestSent(false)
                onCanceled?.()
            },
            onError,
        })
    }

    if (state.isConnected) {
        return (
            <button
                type="button"
                onClick={onFriendsClick}
                disabled={disabled || isBusy || !onFriendsClick}
                className={cn(className, friendClassName)}
            >
                {showIcon && <Users className="h-4 w-4" />}
                {friendLabel}
            </button>
        )
    }

    if (state.requestReceived && showIncomingActions) {
        return (
            <div className={cn("flex gap-1", incomingWrapperClassName)}>
                <button
                    type="button"
                    disabled={disabled || isBusy}
                    onClick={() =>
                        acceptRequest.mutate(targetUserId, {
                            onSuccess: onAccepted,
                            onError,
                        })
                    }
                    className={acceptClassName}
                >
                    {showIcon && <UserCheck className="h-4 w-4" />}
                    Accept
                </button>
                <button
                    type="button"
                    disabled={disabled || isBusy}
                    onClick={() =>
                        declineRequest.mutate(targetUserId, {
                            onSuccess: onDeclined,
                            onError,
                        })
                    }
                    className={declineClassName}
                >
                    {showIcon && <UserMinus className="h-4 w-4" />}
                    Decline
                </button>
            </div>
        )
    }

    if (state.requestSent) {
        return (
            <button
                type="button"
                onClick={handleCancel}
                disabled={disabled || isBusy || !allowCancel}
                className={cn(className, sentClassName)}
                title={allowCancel ? "Cancel friend request" : sentLabel}
            >
                {showIcon && <Clock className="h-4 w-4" />}
                {sentLabel}
            </button>
        )
    }

    return (
        <button
            type="button"
            onClick={handleSend}
            disabled={disabled || isBusy}
            className={className}
            title={addLabel}
        >
            {showIcon && <UserPlus className="h-4 w-4" />}
            {addLabel}
        </button>
    )
}
