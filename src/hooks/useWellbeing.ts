import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import {
    parseScreenTime,
    parseWellbeing,
    type ScreenTimeWeek,
    type Wellbeing,
    type WellbeingRequest,
} from "@/app/settings/_lib/wellbeing"

export const WELLBEING_PATH = "/v1/users/me/wellbeing"
export const SCREEN_TIME_PATH = "/v1/users/me/screen-time"
const WELLBEING_KEY = ["wellbeing"] as const

export function useWellbeing() {
    return useQuery<Wellbeing>({
        queryKey: WELLBEING_KEY,
        queryFn: async () => {
            const res = await api.get(WELLBEING_PATH)
            const parsed = parseWellbeing(res.data)
            if (!parsed) throw new Error("The wellbeing response had no settings document.")
            return parsed
        },
        staleTime: 0,
        refetchOnWindowFocus: false,
    })
}

/**
 * PUT is a full replace (wellbeing_validate.go), so the body must be the whole
 * document; build it with buildWellbeingRequest. The handler echoes what it
 * stored, and that echo becomes the cached value.
 */
export function useUpdateWellbeing() {
    const qc = useQueryClient()
    return useMutation<Wellbeing, unknown, WellbeingRequest>({
        mutationFn: async (body) => {
            const res = await api.put(WELLBEING_PATH, body)
            const parsed = parseWellbeing(res.data)
            if (!parsed) throw new Error("The server did not confirm the change.")
            return parsed
        },
        onSuccess: (stored) => {
            qc.setQueryData(WELLBEING_KEY, stored)
        },
    })
}

/** The last seven days, today included (`range=week`; the default is today only). */
export function useScreenTime() {
    return useQuery<ScreenTimeWeek>({
        queryKey: ["screen-time", "week"],
        queryFn: async () => {
            const res = await api.get(SCREEN_TIME_PATH, { params: { range: "week" } })
            const parsed = parseScreenTime(res.data)
            if (!parsed) throw new Error("The screen-time response was empty.")
            return parsed
        },
    })
}

/** One day's foreground total; a repeat POST for the same date replaces it. */
export function useLogScreenTime() {
    return useMutation({
        mutationFn: async (body: { date?: string; foreground_secs: number; sessions?: number }) => {
            const res = await api.post(SCREEN_TIME_PATH, body)
            return res.data?.data ?? res.data
        },
    })
}
