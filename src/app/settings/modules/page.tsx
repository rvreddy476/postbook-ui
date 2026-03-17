"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Globe,
    Pencil,
    Trash2,
    Loader2,
    Save,
    ArrowLeft,
    History,
    AlertTriangle,
    Check,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import {
    useModuleProfiles,
    useUpsertModuleProfile,
    useDeleteModuleProfile,
    useChangeHandle,
    useHandleHistory,
} from "@/hooks/useModuleProfiles"
import type { ModuleName, ModuleProfile } from "@/types/profile"

const MODULE_OPTIONS: { id: ModuleName; label: string; description: string; color: string }[] = [
    { id: "postbook", label: "Postbook", description: "Social feed & text posts", color: "violet" },
    { id: "posttube", label: "PostTube", description: "Long-form video platform", color: "red" },
    { id: "postgram", label: "Postgram", description: "Photos & short-form video", color: "amber" },
]

function ModuleCard({
    module,
    profile,
    onEdit,
    onDelete,
    isDeleting,
}: {
    module: (typeof MODULE_OPTIONS)[number]
    profile: ModuleProfile | undefined
    onEdit: () => void
    onDelete: () => void
    isDeleting: boolean
}) {
    const colorMap: Record<string, string> = {
        violet: "bg-[#D8103F]/5 text-[#D8103F] border-[#D8103F]/20",
        red: "bg-red-50 text-red-600 border-red-200",
        amber: "bg-amber-50 text-amber-600 border-amber-200",
    }
    const accent = colorMap[module.color] ?? colorMap.violet

    return (
        <div className="rounded-xl border border-brand-divider bg-brand-card p-5 transition-shadow hover:shadow-sm">
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent}`}>
                        <Globe className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-brand-text">{module.label}</h3>
                        <p className="text-xs text-brand-highlight">{module.description}</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={onEdit}>
                        <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {profile && (
                        <Button variant="ghost" size="sm" onClick={onDelete} disabled={isDeleting}>
                            {isDeleting ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Trash2 className="h-3.5 w-3.5 text-red-500" />
                            )}
                        </Button>
                    )}
                </div>
            </div>

            {profile ? (
                <div className="mt-4 space-y-2 text-xs text-brand-highlight">
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-brand-highlight">Identity:</span>
                        <span>
                            {profile.use_global_identity ? "Global (shared)" : "Custom override"}
                        </span>
                    </div>
                    {profile.name_override && (
                        <div className="flex items-center gap-2">
                            <span className="font-medium text-brand-highlight">Name:</span>
                            <span>{profile.name_override}</span>
                        </div>
                    )}
                </div>
            ) : (
                <p className="mt-4 text-xs text-brand-text/60 italic">
                    No custom profile — using global identity
                </p>
            )}
        </div>
    )
}

function ModuleEditForm({
    module,
    profile,
    onClose,
}: {
    module: ModuleName
    profile: ModuleProfile | undefined
    onClose: () => void
}) {
    const { toast, ToastContainer } = useToast()
    const upsertMutation = useUpsertModuleProfile()

    const [useGlobal, setUseGlobal] = useState(profile?.use_global_identity ?? true)
    const [nameOverride, setNameOverride] = useState(profile?.name_override ?? "")
    const [bannerUrl, setBannerUrl] = useState(profile?.banner_url ?? "")
    const [watermarkUrl, setWatermarkUrl] = useState(profile?.watermark_url ?? "")

    const handleSave = () => {
        upsertMutation.mutate(
            {
                module,
                params: {
                    use_global_identity: useGlobal,
                    name_override: useGlobal ? null : nameOverride || null,
                    banner_url: bannerUrl || null,
                    watermark_url: watermarkUrl || null,
                },
            },
            {
                onSuccess: () => {
                    toast({ type: "success", title: "Saved", description: `${module} profile updated.` })
                    onClose()
                },
                onError: () => {
                    toast({ type: "error", title: "Error", description: "Could not save module profile." })
                },
            },
        )
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-xl border border-[#D8103F]/20 bg-brand-card p-6 shadow-sm"
        >
            <h3 className="text-sm font-bold text-brand-text capitalize mb-4">
                Edit {module} Profile
            </h3>

            <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={useGlobal}
                        onChange={(e) => setUseGlobal(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-[#D8103F] focus:ring-[#D8103F]/50"
                    />
                    <div>
                        <p className="text-sm font-medium text-slate-700">Use global identity</p>
                        <p className="text-xs text-brand-highlight">
                            Share the same name, avatar, and bio across all modules
                        </p>
                    </div>
                </label>

                {!useGlobal && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-3"
                    >
                        <div>
                            <label className="block text-xs font-semibold text-brand-highlight mb-1">
                                Display Name Override
                            </label>
                            <input
                                type="text"
                                value={nameOverride}
                                onChange={(e) => setNameOverride(e.target.value)}
                                placeholder="Custom display name for this module"
                                className="w-full rounded-lg border border-brand-divider px-3 py-2 text-sm focus:border-[#D8103F]/50 focus:ring-1 focus:ring-[#D8103F]/50 outline-none"
                            />
                        </div>
                    </motion.div>
                )}

                <div>
                    <label className="block text-xs font-semibold text-brand-highlight mb-1">
                        Banner URL
                    </label>
                    <input
                        type="text"
                        value={bannerUrl}
                        onChange={(e) => setBannerUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full rounded-lg border border-brand-divider px-3 py-2 text-sm focus:border-[#D8103F]/50 focus:ring-1 focus:ring-[#D8103F]/50 outline-none"
                    />
                </div>

                <div>
                    <label className="block text-xs font-semibold text-brand-highlight mb-1">
                        Watermark URL
                    </label>
                    <input
                        type="text"
                        value={watermarkUrl}
                        onChange={(e) => setWatermarkUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full rounded-lg border border-brand-divider px-3 py-2 text-sm focus:border-[#D8103F]/50 focus:ring-1 focus:ring-[#D8103F]/50 outline-none"
                    />
                </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
                <Button variant="outline" size="sm" onClick={onClose}>
                    Cancel
                </Button>
                <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={upsertMutation.isPending}
                    className="bg-[#D8103F] text-white hover:bg-[#b80d35]"
                >
                    {upsertMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="mr-2 h-4 w-4" />
                    )}
                    Save
                </Button>
            </div>
            <ToastContainer />
        </motion.div>
    )
}

function HandleSection() {
    const { toast, ToastContainer } = useToast()
    const changeHandleMutation = useChangeHandle()
    const { data: history, isLoading: historyLoading } = useHandleHistory()

    const [newUsername, setNewUsername] = useState("")
    const [showHistory, setShowHistory] = useState(false)
    const [confirmChecked, setConfirmChecked] = useState(false)

    const handleSubmit = () => {
        if (!newUsername.trim() || !confirmChecked) return
        changeHandleMutation.mutate(
            { username: newUsername.trim() },
            {
                onSuccess: () => {
                    toast({ type: "success", title: "Handle changed", description: `Your handle is now @${newUsername.trim()}.` })
                    setNewUsername("")
                    setConfirmChecked(false)
                },
                onError: (err) => {
                    const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Could not change handle."
                    toast({ type: "error", title: "Failed", description: msg })
                },
            },
        )
    }

    return (
        <div className="rounded-xl border border-brand-divider bg-brand-card p-6">
            <h3 className="text-sm font-bold text-brand-text mb-1">Change Handle</h3>
            <p className="text-xs text-brand-highlight mb-4">
                Your handle is your unique @username. Changes have a 30-day cooldown.
            </p>

            <div className="flex gap-2">
                <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-brand-text/60">@</span>
                    <input
                        type="text"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                        placeholder="new_handle"
                        maxLength={30}
                        className="w-full rounded-lg border border-brand-divider pl-8 pr-3 py-2 text-sm focus:border-[#D8103F]/50 focus:ring-1 focus:ring-[#D8103F]/50 outline-none"
                    />
                </div>
            </div>

            <label className="flex items-center gap-2 mt-3 cursor-pointer">
                <input
                    type="checkbox"
                    checked={confirmChecked}
                    onChange={(e) => setConfirmChecked(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#D8103F] focus:ring-[#D8103F]/50"
                />
                <span className="text-xs text-brand-highlight">
                    I understand this change has a 30-day cooldown
                </span>
            </label>

            <div className="mt-4 flex items-center gap-2">
                <Button
                    size="sm"
                    onClick={handleSubmit}
                    disabled={!newUsername.trim() || !confirmChecked || changeHandleMutation.isPending}
                    className="bg-[#D8103F] text-white hover:bg-[#b80d35]"
                >
                    {changeHandleMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Check className="mr-2 h-4 w-4" />
                    )}
                    Change Handle
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowHistory((v) => !v)}>
                    <History className="mr-1.5 h-3.5 w-3.5" />
                    History
                </Button>
            </div>

            <AnimatePresence>
                {showHistory && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 overflow-hidden"
                    >
                        {historyLoading ? (
                            <div className="flex items-center gap-2 text-xs text-brand-text/60 py-2">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...
                            </div>
                        ) : !history?.length ? (
                            <p className="text-xs text-brand-text/60 italic py-2">No handle changes yet.</p>
                        ) : (
                            <div className="space-y-2">
                                {history.map((entry, i) => (
                                    <div key={i} className="flex items-center gap-3 text-xs text-brand-highlight rounded-lg bg-brand-secondary px-3 py-2">
                                        <span className="font-mono text-brand-text/60">@{entry.old_username}</span>
                                        <span className="text-slate-300">&rarr;</span>
                                        <span className="font-mono font-semibold">@{entry.new_username}</span>
                                        <span className="ml-auto text-brand-text/60">
                                            {new Date(entry.changed_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            <ToastContainer />
        </div>
    )
}

export default function ModuleProfilesPage() {
    const { data: profiles, isLoading } = useModuleProfiles()
    const deleteMutation = useDeleteModuleProfile()
    const { toast, ToastContainer } = useToast()

    const [editingModule, setEditingModule] = useState<ModuleName | null>(null)
    const [deletingModule, setDeletingModule] = useState<ModuleName | null>(null)

    const profileMap = new Map((profiles ?? []).map((p) => [p.module, p]))

    const handleDelete = (module: ModuleName) => {
        setDeletingModule(module)
        deleteMutation.mutate(
            { module },
            {
                onSuccess: () => {
                    toast({ type: "success", title: "Removed", description: `${module} custom profile deleted.` })
                    setDeletingModule(null)
                },
                onError: () => {
                    toast({ type: "error", title: "Error", description: "Could not delete module profile." })
                    setDeletingModule(null)
                },
            },
        )
    }

    return (
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
                <Link href="/settings" className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#D8103F]/10 hover:bg-[#D8103F]/20 transition-colors">
                    <ArrowLeft className="h-4 w-4 text-[#D8103F]" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-brand-text">Module Profiles</h1>
                    <p className="text-sm text-brand-highlight">Customize your identity per platform module.</p>
                </div>
            </motion.div>

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-[#D8103F]/50" />
                </div>
            ) : (
                <div className="space-y-4">
                    <AnimatePresence mode="wait">
                        {editingModule ? (
                            <ModuleEditForm
                                key={editingModule}
                                module={editingModule}
                                profile={profileMap.get(editingModule)}
                                onClose={() => setEditingModule(null)}
                            />
                        ) : (
                            <motion.div
                                key="cards"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="space-y-3"
                            >
                                {MODULE_OPTIONS.map((mod) => (
                                    <ModuleCard
                                        key={mod.id}
                                        module={mod}
                                        profile={profileMap.get(mod.id)}
                                        onEdit={() => setEditingModule(mod.id)}
                                        onDelete={() => handleDelete(mod.id)}
                                        isDeleting={deletingModule === mod.id}
                                    />
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            <HandleSection />

            {/* Cooldown warning */}
            <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 p-4">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-semibold text-amber-800">Handle Change Cooldown</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                        After changing your handle, you must wait 30 days before changing it again.
                        Old handles will redirect for 90 days.
                    </p>
                </div>
            </div>

            <ToastContainer />
        </div>
    )
}
