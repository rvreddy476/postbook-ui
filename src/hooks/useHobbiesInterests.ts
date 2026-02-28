"use client"

import { useMemo } from "react"
import { useAbout, useUpsertAboutItem, useDeleteAboutItem } from "@/hooks/useAbout"
import type { AboutItem, HobbyInterestData, HobbyInterestType } from "@/types/profile"

export interface ParsedHobbyInterest {
    item_id: string
    name: string
    type: HobbyInterestType
    category?: string
    description?: string
    visibility: "public" | "followers" | "friends" | "only_me"
    sort_order: number
}

function parseItem(item: AboutItem): ParsedHobbyInterest {
    const d = item.data as Record<string, unknown>
    return {
        item_id: item.item_id,
        name: (d.name as string) ?? "",
        type: (d.type as HobbyInterestType) ?? "hobby",
        category: d.category as string | undefined,
        description: d.description as string | undefined,
        visibility: item.visibility,
        sort_order: item.sort_order,
    }
}

export function useHobbiesInterests(userId: string | undefined) {
    const { data: aboutData, isLoading, error } = useAbout(userId)

    const parsed = useMemo(() => {
        const items = (aboutData?.interests as AboutItem[] | undefined) ?? []
        const all = items.map(parseItem).sort((a, b) => a.sort_order - b.sort_order)
        return {
            hobbies: all.filter(i => i.type === "hobby"),
            interests: all.filter(i => i.type === "interest"),
            allItems: all,
        }
    }, [aboutData])

    return { ...parsed, isLoading, error }
}

export function useAddHobbyInterest() {
    const upsert = useUpsertAboutItem()

    const add = (params: {
        name: string
        type: HobbyInterestType
        category?: string
        description?: string
        visibility?: "public" | "followers" | "friends" | "only_me"
        sort_order: number
    }) => {
        const data: HobbyInterestData = {
            name: params.name,
            type: params.type,
            category: params.category,
            description: params.description,
        }
        return upsert.mutateAsync({
            section: "interests",
            data: data as unknown as Record<string, unknown>,
            visibility: params.visibility ?? "public",
            sort_order: params.sort_order,
        })
    }

    return { add, isPending: upsert.isPending }
}

export function useRemoveHobbyInterest() {
    const del = useDeleteAboutItem()

    const remove = (itemId: string) => {
        return del.mutateAsync({ section: "interests", itemId })
    }

    return { remove, isPending: del.isPending }
}

export function useUpdateHobbyInterest() {
    const upsert = useUpsertAboutItem()

    const update = (params: {
        item_id: string
        name: string
        type: HobbyInterestType
        category?: string
        description?: string
        visibility?: "public" | "followers" | "friends" | "only_me"
        sort_order: number
    }) => {
        const data: HobbyInterestData = {
            name: params.name,
            type: params.type,
            category: params.category,
            description: params.description,
        }
        return upsert.mutateAsync({
            section: "interests",
            data: data as unknown as Record<string, unknown>,
            visibility: params.visibility ?? "public",
            sort_order: params.sort_order,
            item_id: params.item_id,
        })
    }

    return { update, isPending: upsert.isPending }
}
