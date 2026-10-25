import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import {
    isEmptyPatch,
    parsePrivacySettings,
    type PrivacyPatch,
    type PrivacySettings,
} from "@/app/settings/_lib/privacySettings"
import { serverError } from "@/app/settings/_lib/saveFeedback"

/**
 * The caller's privacy settings, `GET /v1/users/me/settings` on identity
 * user-service. Both Social preferences and Privacy read through this one
 * query so a save on either page is what the other one shows next.
 */
export const MY_SETTINGS_KEY = ["my-settings"] as const

export const SETTINGS_PATH = "/v1/users/me/settings"

export function useMySettings() {
    return useQuery<PrivacySettings>({
        queryKey: MY_SETTINGS_KEY,
        queryFn: async () => {
            const res = await api.get(SETTINGS_PATH)
            const parsed = parsePrivacySettings(res.data)
            if (!parsed) throw new Error("The settings response had no settings document.")
            return parsed
        },
        // A form seeded from a stale read would diff against the wrong
        // baseline; always re-read when the page mounts.
        staleTime: 0,
        refetchOnWindowFocus: false,
    })
}

/**
 * The request a save sends: a PUT of ONLY the changed fields (the handler
 * merges present fields onto the stored record). Null when nothing changed,
 * in which case no request is made at all.
 */
export function settingsSaveRequest(patch: PrivacyPatch): { method: "put"; url: string; body: PrivacyPatch } | null {
    if (isEmptyPatch(patch)) return null
    return { method: "put", url: SETTINGS_PATH, body: patch }
}

export function useUpdateMySettings() {
    const qc = useQueryClient()
    return useMutation<PrivacySettings, ReturnType<typeof serverError>, PrivacyPatch>({
        mutationFn: async (patch) => {
            const req = settingsSaveRequest(patch)
            const current = qc.getQueryData<PrivacySettings>(MY_SETTINGS_KEY)
            if (!req) {
                if (current) return current
                throw serverError(null, "Nothing to save.")
            }
            let res
            try {
                res = await api.put(req.url, req.body)
            } catch (err) {
                throw serverError(err)
            }
            // The handler echoes the stored record; that, not the form, is
            // the new baseline (strict mode and under-18 rules can override
            // what was sent).
            const stored = parsePrivacySettings(res.data)
            if (!stored) throw serverError(null, "The server did not confirm the change.")
            return stored
        },
        onSuccess: (stored) => {
            qc.setQueryData(MY_SETTINGS_KEY, stored)
        },
    })
}
