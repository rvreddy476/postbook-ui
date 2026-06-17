"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Plus, Trash2, GripVertical, Loader2, ExternalLink, Pin, Link as LinkIcon, Save, X } from "lucide-react"
import { useProfileLinks, useCreateProfileLink, useUpdateProfileLink, useDeleteProfileLink } from "@/hooks/useEditProfile"
import type { ProfileLink } from "@/types/profile"
import { motion, AnimatePresence } from "framer-motion"

const ICON_OPTIONS = [
    "website", "linkedin", "github", "discord", "telegram",
    "spotify", "twitch", "reddit", "email", "other",
]

const inputBase = "flex h-12 w-full rounded-2xl border border-brand-divider bg-brand-card/50 px-4 py-2 text-sm font-medium transition-all placeholder:text-brand-text/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-text/20 focus-visible:border-brand-text focus-visible:bg-brand-card shadow-sm"
const selectBase = "flex h-12 w-full rounded-2xl border border-brand-divider bg-brand-card/50 px-4 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-text/20 focus-visible:border-brand-text focus-visible:bg-brand-card shadow-sm appearance-none cursor-pointer"

export function SocialLinksSection() {
    const { data: links, isLoading } = useProfileLinks()
    const createLink = useCreateProfileLink()
    const updateLink = useUpdateProfileLink()
    const deleteLink = useDeleteProfileLink()

    const [showAddForm, setShowAddForm] = useState(false)
    const [newLink, setNewLink] = useState({ title: "", url: "", icon: "website" })

    const handleCreate = async () => {
        if (!newLink.title.trim() || !newLink.url.trim()) return
        await createLink.mutateAsync({
            title: newLink.title,
            url: newLink.url,
            icon: newLink.icon,
            sort_order: (links?.length ?? 0),
        })
        setNewLink({ title: "", url: "", icon: "website" })
        setShowAddForm(false)
    }

    if (isLoading) return (
        <div className="space-y-4">
            {[1, 2].map(i => <div key={i} className="h-20 bg-brand-secondary animate-pulse rounded-[1.5rem]" />)}
        </div>
    )

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <label className="text-[11px] font-black text-brand-text uppercase tracking-[0.2em]">Social Links</label>
                    <p className="text-[10px] font-bold text-brand-text/60 uppercase tracking-wider mt-0.5">Links to your other websites</p>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAddForm(true)}
                    disabled={showAddForm}
                    className="h-10 px-4 rounded-xl border border-brand-divider bg-brand-card hover:bg-brand-secondary text-[10px] font-black uppercase tracking-widest text-brand-text shadow-sm"
                >
                    <Plus className="w-3.5 h-3.5 mr-2" />
                    Add New Link
                </Button>
            </div>

            <div className="space-y-4">
                <AnimatePresence>
                    {showAddForm && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="p-6 rounded-[2rem] bg-brand-secondary/40/50 border border-brand-divider shadow-inner space-y-4"
                        >
                            <div className="grid grid-cols-[140px_1fr] gap-4">
                                <select
                                    value={newLink.icon}
                                    onChange={(e) => setNewLink((p) => ({ ...p, icon: e.target.value }))}
                                    className={selectBase}
                                >
                                    {ICON_OPTIONS.map((p) => (
                                        <option key={p} value={p}>
                                            {p.charAt(0).toUpperCase() + p.slice(1)}
                                        </option>
                                    ))}
                                </select>
                                <Input
                                    value={newLink.title}
                                    onChange={(e) => setNewLink((p) => ({ ...p, title: e.target.value }))}
                                    placeholder="Link name (e.g. Portfolio)"
                                    className={inputBase}
                                />
                            </div>
                            <Input
                                value={newLink.url}
                                onChange={(e) => setNewLink((p) => ({ ...p, url: e.target.value }))}
                                placeholder="https://..."
                                className={inputBase}
                            />
                            <div className="flex gap-2 justify-end pt-2">
                                <Button variant="ghost" className="h-10 px-6 rounded-xl text-brand-highlight font-bold uppercase tracking-widest text-[10px]" onClick={() => setShowAddForm(false)}>
                                    Cancel
                                </Button>
                                <Button size="sm" onClick={handleCreate} disabled={createLink.isPending} className="h-10 px-8 rounded-xl bg-brand-text text-brand-card font-black uppercase tracking-widest text-[10px] shadow-lg shadow-brand-text/10">
                                    {createLink.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {(!links || links.length === 0) && !showAddForm && (
                    <div className="p-20 text-center bg-brand-secondary/50 border border-brand-divider border-dashed rounded-[2.5rem]">
                        <LinkIcon className="w-10 h-10 text-brand-secondary mx-auto mb-4" />
                        <p className="text-[10px] font-black text-brand-text/60 uppercase tracking-widest">No links added to your profile yet.</p>
                    </div>
                )}

                <div className="space-y-4">
                    {links?.map((link) => (
                        <LinkRow
                            key={link.id}
                            link={link}
                            onUpdate={(link, field) => updateLink.mutate({ id: link.id, title: link.title, url: link.url, ...field })}
                            onDelete={(id) => deleteLink.mutate(id)}
                            isUpdating={updateLink.isPending}
                            isDeleting={deleteLink.isPending}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}

function LinkRow({
    link,
    onUpdate,
    onDelete,
    isDeleting,
}: {
    link: ProfileLink
    onUpdate: (link: ProfileLink, field: Partial<Pick<ProfileLink, "title" | "url" | "icon" | "is_pinned">>) => void
    onDelete: (linkId: string) => void
    isUpdating: boolean
    isDeleting: boolean
}) {
    const [editing, setEditing] = useState(false)
    const [title, setTitle] = useState(link.title)
    const [url, setUrl] = useState(link.url)

    const handleSave = () => {
        if (title !== link.title || url !== link.url) {
            onUpdate(link, { title, url })
        }
        setEditing(false)
    }

    if (editing) {
        return (
            <div className="p-6 rounded-[2rem] bg-brand-card border border-brand-divider shadow-xl space-y-4">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className={inputBase} />
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className={inputBase} />
                <div className="flex gap-2 justify-end pt-2">
                    <Button variant="ghost" className="h-10 px-6 rounded-xl text-brand-text/60 font-bold uppercase tracking-widest text-[10px]" onClick={() => setEditing(false)}>Cancel</Button>
                    <Button size="sm" className="h-10 px-8 rounded-xl bg-brand-text text-brand-card font-black uppercase tracking-widest text-[10px]" onClick={handleSave}>
                        Update
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <motion.div
            layout
            className="flex items-center gap-6 p-5 rounded-[1.5rem] bg-brand-card border border-brand-divider group hover:shadow-2xl transition-all duration-500"
        >
            <div className="w-12 h-12 bg-brand-secondary rounded-xl flex items-center justify-center border border-brand-divider shrink-0">
                <span className="text-[10px] font-black text-brand-text/60 uppercase tracking-tighter">
                    {link.icon?.slice(0, 3) || "HUB"}
                </span>
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                    <span className="text-sm font-black text-brand-text uppercase tracking-tight truncate">{link.title}</span>
                    {link.is_pinned && <Pin className="w-3.5 h-3.5 text-blue-500 fill-blue-500" />}
                </div>
                <div className="flex items-center gap-3 mt-1.5 font-bold uppercase tracking-[0.05em]">
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-brand-text/60 hover:text-brand-text truncate flex items-center gap-1.5 transition-colors">
                        <ExternalLink className="w-3 h-3" />
                        {link.url}
                    </a>
                    {link.click_count > 0 && (
                        <span className="text-[9px] text-brand-text/30 ml-auto">{link.click_count} Clicks</span>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => onUpdate(link, { is_pinned: !link.is_pinned })}
                    className={`p-2.5 rounded-xl transition-all ${link.is_pinned ? "bg-brand-text text-brand-card" : "bg-brand-secondary text-brand-text/60 hover:bg-brand-secondary/40 hover:text-brand-text"}`}
                >
                    <Pin className="w-4 h-4" />
                </motion.button>
                <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setEditing(true)}
                    className="p-2.5 bg-brand-secondary text-brand-text/60 rounded-xl hover:bg-brand-text hover:text-brand-card transition-all"
                >
                    <LinkIcon className="w-4 h-4" />
                </motion.button>
                <motion.button
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => onDelete(link.id)}
                    disabled={isDeleting}
                    className="p-2.5 bg-brand-secondary text-brand-text/60 rounded-xl hover:bg-rose-500 hover:text-white transition-all"
                >
                    <Trash2 className="w-4 h-4" />
                </motion.button>
            </div>
        </motion.div>
    )
}
