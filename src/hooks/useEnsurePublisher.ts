"use client"

import { useEffect, useRef } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import { useMyChannels } from "@/hooks/useChannels"
import type { Channel } from "@/types/profile"

interface EnsurePublisherResponse {
    data: {
        account_handle: string
        channel: Channel
        was_new_handle: boolean
        was_new_channel: boolean
    }
}

export function useEnsurePublisher() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async () => {
            const res = await api.post<EnsurePublisherResponse>(
                "/v1/onboarding/ensure-publisher"
            )
            return res.data.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["my-channels"] })
        },
    })
}

/**
 * Silently ensures the user has a channel on mount.
 * Used on pages like Posttube where we want the channel ready in background.
 * Does nothing if the user already has a channel.
 */
export function useEnsurePublisherOnMount() {
    const { data: channels, isLoading } = useMyChannels()
    const mutation = useEnsurePublisher()
    const triggered = useRef(false)
    const mutateRef = useRef(mutation.mutate)
    mutateRef.current = mutation.mutate

    useEffect(() => {
        if (isLoading) return
        if (channels && channels.length > 0) return
        if (triggered.current) return
        triggered.current = true
        mutateRef.current()
    }, [isLoading, channels])
}
