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
        <div className="bg-brand-card rounded-2xl border border-border shadow-xs p-4">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wide flex items-center gap-2">
                    <ThumbsUp className="w-4 h-4 text-primary-ink" />
                    Endorsements
                </h3>
                {!isOwn && (
                    <button
                        onClick={() => setShowEndorseForm((v) => !v)}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-muted-foreground bg-secondary rounded-lg hover:bg-primary-tint hover:text-white transition-colors"
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
                <div className="mb-4 p-3 bg-background rounded-xl border border-border">
                    <input
                        type="text"
                        value={skillTag}
                        onChange={(e) => setSkillTag(e.target.value)}
                        placeholder="Skill (e.g., JavaScript, Design)"
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-brand-card text-foreground placeholder:text-muted-foreground/40 focus:outline-hidden focus:ring-2 focus:ring-primary/50 mb-2"
                    />
                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Optional message..."
                        rows={2}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-brand-card text-foreground placeholder:text-muted-foreground/40 focus:outline-hidden focus:ring-2 focus:ring-primary/50 resize-none mb-2"
                    />
                    <div className="flex justify-end">
                        <button
                            onClick={handleEndorse}
                            disabled={endorseUser.isPending || !skillTag.trim()}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-primary-ink rounded-lg hover:bg-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                <p className="text-xs text-muted-foreground text-center py-2">
                    No endorsements yet.
                </p>
            ) : (
                <div className="space-y-2">
                    {endorsementSummary.map((skill) => (
                        <div
                            key={skill.skill_tag}
                            className="flex items-center justify-between p-2.5 bg-background rounded-xl"
                        >
                            <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-lg bg-primary-tint/20 flex items-center justify-center">
                                    <ThumbsUp className="w-3.5 h-3.5 text-primary-ink" />
                                </div>
                                <span className="text-sm font-semibold text-foreground">
                                    {skill.skill_tag}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-muted-foreground bg-brand-card px-2 py-0.5 rounded-full border border-border">
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
