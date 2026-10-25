import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from "@tanstack/react-query"
import api from "@/lib/api"
import {
    applyMessagingPatch,
    messagingSettingsError,
    parseMessagingSettings,
    type MessagingPatch,
    type MessagingSettings,
} from "@/app/settings/_lib/messagingSettings"
import { MY_SETTINGS_KEY, SETTINGS_PATH } from "@/hooks/useMySettings"

/**
 * The caller's Inbox & messaging settings: the chat fields of
 * `GET /v1/users/me/settings` (identity user-service).
 *
 * The key sits under useMySettings' ["my-settings"], so anything that
 * invalidates that prefix (a save on Privacy or Social preferences) refreshes
 * this too; a save here invalidates the exact ["my-settings"] query so those
 * pages read the new values.
 */
export const MESSAGING_SETTINGS_KEY = ["my-settings", "messaging"] as const

export function useMessagingSettings(): UseQueryResult<MessagingSettings> {
    return useQuery<MessagingSettings>({
        queryKey: MESSAGING_SETTINGS_KEY,
        queryFn: async () => {
            const res = await api.get(SETTINGS_PATH)
            const parsed = parseMessagingSettings(res.data)
            if (!parsed) throw new Error("The settings response had no settings document.")
            return parsed
        },
        // Diffs are taken against this read; never seed a page from a stale one.
        staleTime: 0,
        refetchOnWindowFocus: false,
    })
}

/**
 * The PUT a save sends: ONLY the given fields (the handler merges present
 * fields). Null for an empty patch, in which case nothing is sent.
 */
export function messagingSaveRequest(patch: MessagingPatch): { method: "put"; url: string; body: MessagingPatch } | null {
    if (Object.keys(patch).length === 0) return null
    return { method: "put", url: SETTINGS_PATH, body: patch }
}

interface SaveContext {
    previous?: MessagingSettings
}

/**
 * Save some fields. Optimistic: the cached settings show the patch at once
 * and roll back if the server refuses. On success the server's stored
 * record (which may hold some values fixed) replaces the cache.
 * Errors are MessagingSettingsError (status, field, fieldCode, message).
 */
export function useUpdateMessagingSettings(): UseMutationResult<MessagingSettings, Error, MessagingPatch, SaveContext> {
    const qc = useQueryClient()
    return useMutation<MessagingSettings, Error, MessagingPatch, SaveContext>({
        mutationFn: async (patch) => {
            const req = messagingSaveRequest(patch)
            if (!req) {
                const current = qc.getQueryData<MessagingSettings>(MESSAGING_SETTINGS_KEY)
                if (current) return current
                throw messagingSettingsError(null, "Nothing to save.")
            }
            let res
            try {
                res = await api.put(req.url, req.body)
            } catch (err) {
                throw messagingSettingsError(err)
            }
            const stored = parseMessagingSettings(res.data)
            if (!stored) throw messagingSettingsError(null, "The server did not confirm the change.")
            return stored
        },
        onMutate: async (patch) => {
            await qc.cancelQueries({ queryKey: MESSAGING_SETTINGS_KEY, exact: true })
            const previous = qc.getQueryData<MessagingSettings>(MESSAGING_SETTINGS_KEY)
            if (previous) qc.setQueryData(MESSAGING_SETTINGS_KEY, applyMessagingPatch(previous, patch))
            return { previous }
        },
        onError: (_err, _patch, ctx) => {
            if (ctx?.previous) qc.setQueryData(MESSAGING_SETTINGS_KEY, ctx.previous)
        },
        onSuccess: (stored) => {
            qc.setQueryData(MESSAGING_SETTINGS_KEY, stored)
            void qc.invalidateQueries({ queryKey: MY_SETTINGS_KEY, exact: true })
        },
    })
}
