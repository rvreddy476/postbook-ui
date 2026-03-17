"use client"

import { useState } from "react"
import { useEndorsements, useEndorseUser } from "@/hooks/useReputation"
import type { SkillEndorsementSummary } from "@/types/profile"
import { ThumbsUp, Plus, Loader2, X } from "lucide-react"

interface EndorsementSectionProps {
    userId: string
    endorsementSummary: SkillEndorsementSummary[]
    isOwn: boolean
}

export function EndorsementSection({ userId, endorsementSummary, isOwn }: EndorsementSectionProps) {
    const [showEndorseForm, setShowEndorseForm] = useState(false)
    const [skillTag, setSkillTag] = useState("")
    const [message, setMessage] = useState("")
    const endorseUser = useEndorseUser()

    const handleEndorse = () => {
        if (!skillTag.trim()) return
        endorseUser.mutate(
            { userId, skill_tag: skillTag.trim(), message: message.trim() || undefined },
            {
                onSuccess: () => {
                    setSkillTag("")
                    setMessage("")
                    setShowEndorseForm(false)
                },
            }
        )
    }

    if (endorsementSummary.length === 0 && isOwn) {
        return null
    }

    return (
        <div className="bg-brand-card rounded-2xl border border-[#F0E6DC] shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-[#3C2415] uppercase tracking-wide flex items-center gap-2">
                    <ThumbsUp className="w-4 h-4 text-[#D4A574]" />
                    Endorsements
                </h3>
                {!isOwn && (
                    <button
                        onClick={() => setShowEndorseForm((v) => !v)}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-[#7B5B3A] bg-[#F0E6DC] rounded-lg hover:bg-[#D4A574] hover:text-white transition-colors"
                    >
                        {showEndorseForm ? (
                            <>
                                <X className="w-3 h-3" />
                                Cancel
                            </>
                        ) : (
                            <>
                                <Plus className="w-3 h-3" />
                                Endorse
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* Endorse Form */}
            {showEndorseForm && (
                <div className="mb-4 p-3 bg-[#FAF5F0] rounded-xl border border-[#F0E6DC]">
                    <input
                        type="text"
                        value={skillTag}
                        onChange={(e) => setSkillTag(e.target.value)}
                        placeholder="Skill (e.g., JavaScript, Design)"
                        className="w-full px-3 py-2 text-sm border border-[#F0E6DC] rounded-lg bg-brand-card text-[#3C2415] placeholder:text-[#7B5B3A]/40 focus:outline-none focus:ring-2 focus:ring-[#D4A574]/50 mb-2"
                    />
                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Optional message..."
                        rows={2}
                        className="w-full px-3 py-2 text-sm border border-[#F0E6DC] rounded-lg bg-brand-card text-[#3C2415] placeholder:text-[#7B5B3A]/40 focus:outline-none focus:ring-2 focus:ring-[#D4A574]/50 resize-none mb-2"
                    />
                    <div className="flex justify-end">
                        <button
                            onClick={handleEndorse}
                            disabled={endorseUser.isPending || !skillTag.trim()}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#7B5B3A] rounded-lg hover:bg-[#3C2415] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {endorseUser.isPending ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                                <ThumbsUp className="w-3 h-3" />
                            )}
                            Endorse
                        </button>
                    </div>
                </div>
            )}

            {/* Skill Summaries */}
            {endorsementSummary.length === 0 ? (
                <p className="text-xs text-[#7B5B3A] text-center py-2">
                    No endorsements yet.
                </p>
            ) : (
                <div className="space-y-2">
                    {endorsementSummary.map((skill) => (
                        <div
                            key={skill.skill_tag}
                            className="flex items-center justify-between p-2.5 bg-[#FAF5F0] rounded-xl"
                        >
                            <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-lg bg-[#D4A574]/20 flex items-center justify-center">
                                    <ThumbsUp className="w-3.5 h-3.5 text-[#D4A574]" />
                                </div>
                                <span className="text-sm font-semibold text-[#3C2415]">
                                    {skill.skill_tag}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-[#7B5B3A] bg-brand-card px-2 py-0.5 rounded-full border border-[#F0E6DC]">
                                    {skill.count}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
