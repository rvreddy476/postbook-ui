"use client"

import { useQuery, useInfiniteQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import type {
    CreatorOverview,
    ContentSummary,
    HourlyDataPoint,
    DailyDataPoint,
    ContentMetrics,
} from "@/types/analytics"

// --- Response wrappers ---

interface OverviewResponse { data: CreatorOverview }
interface ContentListResponse { data: ContentSummary[]; meta?: { next_cursor?: string } }
interface ContentAnalyticsResponse { data: { metrics: ContentMetrics; trend: HourlyDataPoint[] } }
interface TrendResponse { data: DailyDataPoint[] }

// === QUERIES ===

export function useCreatorOverview(period: string) {
    return useQuery({
        queryKey: ["analytics-overview", period],
        queryFn: async () => {
            const res = await api.get<OverviewResponse>("/v1/analytics/dashboard/overview", {
                params: { period },
            })
            return res.data.data
        },
        staleTime: 30_000,
    })
}

export function useContentList(sort: string) {
    return useInfiniteQuery({
        queryKey: ["analytics-content-list", sort],
        queryFn: async ({ pageParam }) => {
            const params: Record<string, string> = { limit: "20", sort }
            if (pageParam) params.cursor = pageParam as string
            const res = await api.get<ContentListResponse>("/v1/analytics/dashboard/content", { params })
            return res.data
        },
        initialPageParam: "" as string,
        getNextPageParam: (lastPage) => lastPage.meta?.next_cursor || undefined,
    })
}

export function useContentAnalytics(contentId: string, period: string) {
    return useQuery({
        queryKey: ["analytics-content-detail", contentId, period],
        queryFn: async () => {
            const res = await api.get<ContentAnalyticsResponse>(
                `/v1/analytics/dashboard/content/${contentId}`,
            )
            return res.data.data
        },
        enabled: !!contentId,
        staleTime: 30_000,
    })
}

export function useContentTrend(contentId: string) {
    return useQuery({
        queryKey: ["analytics-content-trend", contentId],
        queryFn: async () => {
            const res = await api.get<{ data: HourlyDataPoint[] }>(
                `/v1/analytics/dashboard/content/${contentId}/trend`,
            )
            return res.data.data
        },
        enabled: !!contentId,
        staleTime: 30_000,
    })
}

export function useCreatorTrend(period: string) {
    return useQuery({
        queryKey: ["analytics-trend", period],
        queryFn: async () => {
            const res = await api.get<TrendResponse>("/v1/analytics/dashboard/trend", {
                params: { period },
            })
            return res.data.data
        },
        staleTime: 30_000,
    })
}
