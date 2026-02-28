"use client"

import { Heart, Sparkles } from "lucide-react"
import { AnimatePresence } from "framer-motion"
import { useHobbiesInterests } from "@/hooks/useHobbiesInterests"
import { TagChip } from "./TagChip"

interface HobbiesInterestsSectionProps {
    userId: string
}

export function HobbiesInterestsSection({ userId }: HobbiesInterestsSectionProps) {
    const { hobbies, interests, isLoading } = useHobbiesInterests(userId)

    if (isLoading) {
        return (
            <div className="space-y-3">
                <div className="h-4 w-32 bg-muted/50 rounded animate-pulse" />
                <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-7 w-20 bg-muted/50 rounded-full animate-pulse" />
                    ))}
                </div>
            </div>
        )
    }

    if (hobbies.length === 0 && interests.length === 0) return null

    return (
        <div className="space-y-5">
            {hobbies.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                        <Heart className="h-4 w-4" />
                        Hobbies
                    </h3>
                    <div className="flex flex-wrap gap-2 pl-6">
                        <AnimatePresence>
                            {hobbies.map(item => (
                                <TagChip
                                    key={item.item_id}
                                    label={item.name}
                                    category={item.category}
                                    visibility={item.visibility}
                                    size="md"
                                />
                            ))}
                        </AnimatePresence>
                    </div>
                </div>
            )}

            {interests.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                        <Sparkles className="h-4 w-4" />
                        Interests
                    </h3>
                    <div className="flex flex-wrap gap-2 pl-6">
                        <AnimatePresence>
                            {interests.map(item => (
                                <TagChip
                                    key={item.item_id}
                                    label={item.name}
                                    category={item.category}
                                    visibility={item.visibility}
                                    size="md"
                                />
                            ))}
                        </AnimatePresence>
                    </div>
                </div>
            )}
        </div>
    )
}
