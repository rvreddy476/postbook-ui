"use client"

import { useRef, useState } from "react"
import { Camera, Loader2, Image } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface AvatarCoverSectionProps {
    avatarMediaId?: string
    coverMediaId?: string
    displayName: string
    onAvatarChange: (file: File) => void
    onCoverChange: (file: File) => void
    isAvatarUploading: boolean
    isCoverUploading: boolean
}

export function AvatarCoverSection({
    avatarMediaId,
    coverMediaId,
    displayName,
    onAvatarChange,
    onCoverChange,
    isAvatarUploading,
    isCoverUploading,
}: AvatarCoverSectionProps) {
    const avatarInputRef = useRef<HTMLInputElement>(null)
    const coverInputRef = useRef<HTMLInputElement>(null)
    const [avatarBroken, setAvatarBroken] = useState(false)
    const [coverBroken, setCoverBroken] = useState(false)

    return (
        <div className="space-y-12">
            {/* Cover Image */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <label className="text-[11px] font-black text-brand-text uppercase tracking-[0.2em]">Cover Photo</label>
                        <p className="text-[10px] font-bold text-brand-text/60 uppercase tracking-wider mt-0.5">Recommended: 1500x500px</p>
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => coverInputRef.current?.click()}
                        className="text-[10px] font-black uppercase tracking-[0.15em] text-blue-600 px-4 py-2 border border-blue-100 rounded-xl hover:bg-blue-50 transition-colors"
                    >
                        Replace Photo
                    </motion.button>
                </div>

                <div
                    className="relative h-64 rounded-[2.5rem] overflow-hidden bg-slate-100 group cursor-pointer shadow-inner border border-brand-divider"
                    onClick={() => coverInputRef.current?.click()}
                >
                    {coverMediaId && !coverBroken ? (
                        <img
                            src={`/v1/media/${coverMediaId}/serve`}
                            alt="Cover"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                            onError={() => setCoverBroken(true)}
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
                            <Image className="w-12 h-12 text-slate-200" />
                        </div>
                    )}

                    <div className="absolute inset-0 bg-black/0 group-hover:bg-slate-900/10 transition-colors" />

                    <div className="absolute bottom-6 right-6">
                        <AnimatePresence>
                            {isCoverUploading ? (
                                <div className="p-4 bg-brand-card/90 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white">
                                    <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                                </div>
                            ) : (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    whileHover={{ opacity: 1, scale: 1 }}
                                    className="p-4 bg-brand-card/10 backdrop-blur-2xl border border-white/20 rounded-2xl text-white shadow-2xl opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <Image className="w-6 h-6" />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
                <input
                    type="file"
                    ref={coverInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) onCoverChange(file)
                    }}
                />
            </div>

            {/* Avatar */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <label className="text-[11px] font-black text-brand-text uppercase tracking-[0.2em]">Profile Picture</label>
                        <p className="text-[10px] font-bold text-brand-text/60 uppercase tracking-wider mt-0.5">Square, Min 400x400px</p>
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => avatarInputRef.current?.click()}
                        className="text-[10px] font-black uppercase tracking-[0.15em] text-blue-600 px-4 py-2 border border-blue-100 rounded-xl hover:bg-blue-50 transition-colors"
                    >
                        Change Photo
                    </motion.button>
                </div>

                <div className="flex items-center gap-10">
                    <div
                        className="relative h-32 w-32 rounded-[2.5rem] bg-brand-card p-2 shadow-2xl ring-1 ring-slate-100 cursor-pointer group"
                        onClick={() => avatarInputRef.current?.click()}
                    >
                        <div className="w-full h-full rounded-[2rem] overflow-hidden bg-brand-secondary relative">
                            {avatarMediaId && !avatarBroken ? (
                                <img
                                    src={`/v1/media/${avatarMediaId}/serve`}
                                    alt={displayName}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                    onError={() => setAvatarBroken(true)}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-4xl font-black text-slate-200 uppercase italic">
                                    {displayName.charAt(0)}
                                </div>
                            )}

                            <AnimatePresence>
                                {isAvatarUploading && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="absolute inset-0 bg-brand-card/80 backdrop-blur-sm flex items-center justify-center"
                                    >
                                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="absolute inset-0 bg-black/0 group-hover:bg-slate-900/5 transition-colors" />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="p-3 bg-brand-card/40 backdrop-blur-md rounded-2xl border border-white shadow-xl">
                                    <Camera className="w-6 h-6 text-brand-text" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <p className="text-sm font-black uppercase tracking-widest text-brand-text">Your Profile Image</p>
                        <p className="text-xs font-bold text-brand-text/60 max-w-[240px] leading-relaxed">
                            This picture is visible to everyone on the platform.
                        </p>
                    </div>
                </div>

                <input
                    type="file"
                    ref={avatarInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) onAvatarChange(file)
                    }}
                />
            </div>
        </div>
    )
}
