"use client"

import React, { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2, Grid3x3, Download, Trash2 } from "lucide-react"
import api from "@/lib/api"

// ─── Types ────────────────────────────────────────────────────────────────────

interface MiniApp {
    id: string
    name: string
    description: string
    category: string
    icon_url?: string
    install_count: number
}

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORIES = [
    { label: "All", value: "" },
    { label: "Games", value: "games" },
    { label: "Booking", value: "booking" },
    { label: "Learning", value: "learning" },
    { label: "Shopping", value: "shopping" },
    { label: "Tools", value: "tools" },
    { label: "Entertainment", value: "entertainment" },
]

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse space-y-3">
            <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-100 rounded-lg w-3/4" />
                    <div className="h-3 bg-gray-100 rounded-lg w-1/2" />
                </div>
            </div>
            <div className="space-y-1.5">
                <div className="h-3 bg-gray-100 rounded-lg w-full" />
                <div className="h-3 bg-gray-100 rounded-lg w-4/5" />
            </div>
            <div className="flex items-center justify-between">
                <div className="h-5 bg-gray-100 rounded-full w-20" />
                <div className="h-8 bg-gray-100 rounded-xl w-24" />
            </div>
        </div>
    )
}

// ─── App icon with fallback ───────────────────────────────────────────────────

function AppIcon({ app }: { app: MiniApp }) {
    const [failed, setFailed] = useState(false)

    const colors = [
        "from-[#D8103F] to-fuchsia-500",
        "from-violet-500 to-purple-600",
        "from-blue-500 to-cyan-500",
        "from-emerald-500 to-teal-600",
        "from-amber-500 to-orange-500",
        "from-pink-500 to-rose-500",
    ]
    const colorClass = colors[app.name.charCodeAt(0) % colors.length]

    if (app.icon_url && !failed) {
        return (
            <img
                src={app.icon_url}
                alt={app.name}
                className="w-14 h-14 rounded-2xl object-cover flex-shrink-0"
                onError={() => setFailed(true)}
            />
        )
    }

    return (
        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${colorClass} flex items-center justify-center flex-shrink-0 shadow-md`}>
            <span className="text-xl font-black text-white select-none">
                {app.name.charAt(0).toUpperCase()}
            </span>
        </div>
    )
}

// ─── Format install count ─────────────────────────────────────────────────────

function formatInstalls(count: number): string {
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M installs`
    if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k installs`
    return `${count} install${count !== 1 ? "s" : ""}`
}

// ─── App card ─────────────────────────────────────────────────────────────────

interface AppCardProps {
    app: MiniApp
    isInstalled: boolean
}

function AppCard({ app, isInstalled }: AppCardProps) {
    const queryClient = useQueryClient()

    const installMutation = useMutation({
        mutationFn: () =>
            api.post(`/v1/apps/${app.id}/install`, { granted_permissions: [] }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["apps", "installed"] })
        },
    })

    const uninstallMutation = useMutation({
        mutationFn: () => api.delete(`/v1/apps/${app.id}/install`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["apps", "installed"] })
        },
    })

    const isPending = installMutation.isPending || uninstallMutation.isPending

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-[#D8103F]/10 transition-all duration-200 p-5 flex flex-col gap-3">
            {/* Header: icon + name + category */}
            <div className="flex items-start gap-3">
                <AppIcon app={app} />
                <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-bold text-gray-900 truncate leading-tight">{app.name}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 text-xs font-semibold text-[#D8103F] bg-[#D8103F]/8 border border-[#D8103F]/15 rounded-full capitalize">
                        {app.category}
                    </span>
                </div>
            </div>

            {/* Description */}
            <p className="text-sm text-gray-500 line-clamp-2 flex-1">{app.description}</p>

            {/* Footer: install count + button */}
            <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-gray-400 font-medium flex items-center gap-1">
                    <Download className="w-3 h-3" />
                    {formatInstalls(app.install_count)}
                </p>

                {isInstalled ? (
                    <button
                        onClick={() => uninstallMutation.mutate()}
                        disabled={isPending}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-[#D8103F] border-2 border-[#D8103F]/40 rounded-xl hover:bg-[#D8103F]/5 hover:border-[#D8103F]/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Trash2 className="w-4 h-4" />
                        )}
                        Uninstall
                    </button>
                ) : (
                    <button
                        onClick={() => installMutation.mutate()}
                        disabled={isPending}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-[#D8103F] rounded-xl hover:bg-[#b80d35] transition-all shadow-sm shadow-[#D8103F]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Download className="w-4 h-4" />
                        )}
                        Install
                    </button>
                )}
            </div>
        </div>
    )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AppsPage() {
    const [activeCategory, setActiveCategory] = useState("")
    const [showInstalledOnly, setShowInstalledOnly] = useState(false)

    const { data: allAppsData, isLoading: appsLoading } = useQuery<MiniApp[]>({
        queryKey: ["apps", activeCategory || "all"],
        queryFn: () =>
            api
                .get("/v1/apps", { params: { category: activeCategory || undefined, limit: 20, offset: 0 } })
                .then((r) => r.data?.data?.items ?? []),
        staleTime: 60_000,
    })

    const { data: installedData } = useQuery<MiniApp[]>({
        queryKey: ["apps", "installed"],
        queryFn: () => api.get("/v1/apps/installed").then((r) => r.data?.data?.items ?? []),
        staleTime: 30_000,
    })

    const installedIds = new Set((installedData ?? []).map((a) => a.id))

    const displayedApps = showInstalledOnly
        ? (installedData ?? [])
        : (allAppsData ?? [])

    return (
        <div className="min-h-screen bg-[#fcfaff]">
            {/* Sticky header */}
            <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-xl border-b border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D8103F] to-fuchsia-500 flex items-center justify-center shadow-md shadow-[#D8103F]/20">
                        <Grid3x3 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-gray-900 tracking-tight">Mini Apps</h1>
                        <p className="text-xs text-gray-400 font-medium">Discover apps built on AtPost</p>
                    </div>
                    {/* Installed toggle */}
                    <button
                        onClick={() => setShowInstalledOnly((v) => !v)}
                        className={`ml-auto flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${
                            showInstalledOnly
                                ? "bg-[#D8103F] text-white border-[#D8103F] shadow-sm shadow-[#D8103F]/20"
                                : "bg-white text-gray-600 border-gray-200 hover:border-[#D8103F]/30 hover:text-[#b80d35]"
                        }`}
                    >
                        <Download className="w-4 h-4" />
                        Installed
                        {installedIds.size > 0 && (
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${showInstalledOnly ? "bg-white/20 text-white" : "bg-[#D8103F]/10 text-[#D8103F]"}`}>
                                {installedIds.size}
                            </span>
                        )}
                    </button>
                </div>

                {/* Category filter bar */}
                {!showInstalledOnly && (
                    <div className="max-w-5xl mx-auto px-4 pb-3">
                        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                            {CATEGORIES.map((cat) => (
                                <button
                                    key={cat.value}
                                    onClick={() => setActiveCategory(cat.value)}
                                    className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-all flex-shrink-0 ${
                                        activeCategory === cat.value
                                            ? "bg-[#D8103F] text-white shadow-sm shadow-[#D8103F]/20"
                                            : "bg-gray-100 text-gray-600 hover:bg-[#D8103F]/10 hover:text-[#b80d35]"
                                    }`}
                                >
                                    {cat.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Hero section */}
            <div className="bg-gradient-to-br from-[#D8103F]/5 via-fuchsia-50/50 to-transparent border-b border-gray-100">
                <div className="max-w-5xl mx-auto px-4 py-10 text-center">
                    <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#D8103F] to-fuchsia-500 flex items-center justify-center shadow-xl shadow-[#D8103F]/20 mx-auto mb-4">
                        <Grid3x3 className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-3xl font-black text-gray-900 tracking-tight">Mini Apps</h2>
                    <p className="text-gray-500 mt-2 text-base max-w-sm mx-auto">
                        Discover and install apps built on the AtPost platform
                    </p>
                </div>
            </div>

            {/* App grid */}
            <main className="max-w-5xl mx-auto px-4 py-8">
                {appsLoading && !showInstalledOnly && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <SkeletonCard key={i} />
                        ))}
                    </div>
                )}

                {!appsLoading && displayedApps.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#D8103F]/5 to-fuchsia-50 border border-[#D8103F]/10 flex items-center justify-center">
                            <Grid3x3 className="w-9 h-9 text-[#D8103F]/30" />
                        </div>
                        <div className="text-center max-w-xs">
                            <p className="text-base font-bold text-gray-900">
                                {showInstalledOnly ? "No installed apps yet" : "No apps found in this category"}
                            </p>
                            <p className="text-sm text-gray-400 mt-1.5 leading-relaxed">
                                {showInstalledOnly
                                    ? "Browse and install apps from the discover page."
                                    : "Check back later for new apps."}
                            </p>
                        </div>
                        {showInstalledOnly && (
                            <button
                                onClick={() => setShowInstalledOnly(false)}
                                className="px-5 py-2.5 text-sm font-bold text-white bg-[#D8103F] rounded-xl hover:bg-[#b80d35] transition-all shadow-sm shadow-[#D8103F]/20"
                            >
                                Browse Apps
                            </button>
                        )}
                    </div>
                )}

                {displayedApps.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {displayedApps.map((app) => (
                            <AppCard
                                key={app.id}
                                app={app}
                                isInstalled={installedIds.has(app.id)}
                            />
                        ))}
                    </div>
                )}
            </main>
        </div>
    )
}
