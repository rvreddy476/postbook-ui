"use client"

import { useState, useCallback, useRef } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Dialog } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Camera, Loader2, ImageIcon } from "lucide-react"
import api from "@/lib/api"
import { uploadMedia } from "@/lib/mediaUpload"
import type { UserProfile } from "@/types/profile"

interface EditProfileModalProps {
    profile: UserProfile
    open: boolean
    onClose: () => void
}

interface FormState {
    display_name: string
    username: string
    bio: string
    first_name: string
    last_name: string
    profession: string
    website: string
    location: string
    category: string
}

export function EditProfileModal({ profile, open, onClose }: EditProfileModalProps) {
    const qc = useQueryClient()
    const avatarInputRef = useRef<HTMLInputElement>(null)
    const coverInputRef = useRef<HTMLInputElement>(null)
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
    const [coverPreview, setCoverPreview] = useState<string | null>(null)

    const avatarUpload = useMutation({
        mutationFn: async (file: File) => {
            const mediaId = await uploadMedia(file, "image", "avatar")
            await api.put("/v1/profiles/me/avatar", { media_id: mediaId })
            return mediaId
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["profile"] })
            qc.invalidateQueries({ queryKey: ["my-profile"] })
            qc.invalidateQueries({ queryKey: ["aggregated-profile"] })
        },
    })

    const coverUpload = useMutation({
        mutationFn: async (file: File) => {
            const mediaId = await uploadMedia(file, "image", "cover")
            await api.put("/v1/profiles/me/cover", { media_id: mediaId })
            return mediaId
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["profile"] })
            qc.invalidateQueries({ queryKey: ["my-profile"] })
            qc.invalidateQueries({ queryKey: ["aggregated-profile"] })
        },
    })

    const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setAvatarPreview(URL.createObjectURL(file))
        avatarUpload.mutate(file)
    }

    const handleCoverFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setCoverPreview(URL.createObjectURL(file))
        coverUpload.mutate(file)
    }

    const [form, setForm] = useState<FormState>({
        display_name: profile.display_name,
        username: profile.username ?? "",
        bio: profile.bio ?? "",
        first_name: profile.first_name ?? "",
        last_name: profile.last_name ?? "",
        profession: profile.profession ?? "",
        website: profile.website ?? "",
        location: profile.location ?? "",
        category: profile.category ?? "personal",
    })

    const update = useCallback(
        (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
            setForm((prev) => ({ ...prev, [field]: e.target.value }))
        },
        []
    )

    const mutation = useMutation({
        mutationFn: async () => {
            const payload = {
                display_name: form.display_name,
                bio: form.bio,
                username: form.username || null,
                first_name: form.first_name || null,
                last_name: form.last_name || null,
                profession: form.profession || null,
                website: form.website || null,
                location: form.location || null,
                category: form.category || null,
            }
            const res = await api.put<{ data: UserProfile }>("/v1/profiles/me", payload)
            return res.data.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["profile"] })
            onClose()
        },
    })

    return (
        <Dialog open={open} onClose={onClose} title="Edit Profile">
            <form
                onSubmit={(e) => {
                    e.preventDefault()
                    mutation.mutate()
                }}
                className="space-y-4"
            >
                {/* Cover Photo */}
                <input type="file" ref={coverInputRef} className="hidden" accept="image/*" onChange={handleCoverFile} />
                <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarFile} />

                <div className="space-y-3">
                    <div
                        onClick={() => coverInputRef.current?.click()}
                        className="relative h-32 rounded-xl overflow-hidden bg-zinc-100 cursor-pointer group border border-zinc-200"
                    >
                        {(coverPreview || profile.cover_media_id) ? (
                            <img
                                src={coverPreview || `/v1/media/${profile.cover_media_id}/serve`}
                                alt=""
                                className="w-full h-full object-cover group-hover:brightness-90 transition-all"
                            />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                                <ImageIcon className="w-8 h-8 text-zinc-300" />
                            </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                            {coverUpload.isPending ? (
                                <Loader2 className="w-5 h-5 text-white animate-spin" />
                            ) : (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-lg text-white text-xs font-semibold">
                                    <Camera className="w-3.5 h-3.5" /> Change Cover
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Avatar overlapping cover */}
                    <div className="flex items-center gap-4 -mt-10 ml-4 relative z-10">
                        <div
                            onClick={() => avatarInputRef.current?.click()}
                            className="w-16 h-16 rounded-2xl overflow-hidden border-[3px] border-white shadow-lg bg-zinc-100 cursor-pointer group relative"
                        >
                            {(avatarPreview || profile.avatar_media_id) ? (
                                <img
                                    src={avatarPreview || `/v1/media/${profile.avatar_media_id}/serve`}
                                    alt=""
                                    className="w-full h-full object-cover group-hover:brightness-90 transition-all"
                                />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-lg font-black text-white">
                                    {profile.display_name.charAt(0)}
                                </div>
                            )}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-2xl">
                                {avatarUpload.isPending ? (
                                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                                ) : (
                                    <Camera className="w-4 h-4 text-white" />
                                )}
                            </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground font-medium mt-6">Click to change photo</p>
                    </div>
                </div>

                <Field label="Display Name">
                    <Input value={form.display_name} onChange={update("display_name")} required />
                </Field>

                <Field label="Username">
                    <Input value={form.username} onChange={update("username")} placeholder="username" />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                    <Field label="First Name">
                        <Input value={form.first_name} onChange={update("first_name")} />
                    </Field>
                    <Field label="Last Name">
                        <Input value={form.last_name} onChange={update("last_name")} />
                    </Field>
                </div>

                <Field label="Bio">
                    <textarea
                        value={form.bio}
                        onChange={update("bio")}
                        rows={3}
                        className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                </Field>

                <Field label="Profession">
                    <Input value={form.profession} onChange={update("profession")} placeholder="Software Engineer" />
                </Field>

                <Field label="Location">
                    <Input value={form.location} onChange={update("location")} placeholder="City, Country" />
                </Field>

                <Field label="Website">
                    <Input value={form.website} onChange={update("website")} placeholder="https://..." />
                </Field>

                <Field label="Category">
                    <select
                        value={form.category}
                        onChange={update("category")}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                        <option value="personal">Personal</option>
                        <option value="creator">Creator</option>
                        <option value="business">Business</option>
                    </select>
                </Field>

                {mutation.isError && (
                    <p className="text-sm text-destructive">Failed to update profile. Please try again.</p>
                )}

                <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={mutation.isPending}>
                        {mutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                </div>
            </form>
        </Dialog>
    )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{label}</label>
            {children}
        </div>
    )
}
