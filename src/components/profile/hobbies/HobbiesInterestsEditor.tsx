"use client"

import { useState } from "react"
import { Plus, ChevronUp, ChevronDown, Trash2, Heart, Sparkles, Eye, Users, Lock } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import {
    useHobbiesInterests,
    useAddHobbyInterest,
    useRemoveHobbyInterest,
    useUpdateHobbyInterest,
    type ParsedHobbyInterest,
} from "@/hooks/useHobbiesInterests"
import { TagChip } from "./TagChip"
import { TagPickerModal } from "./TagPickerModal"
import { MAX_HOBBIES, MAX_INTERESTS, getCategoryColor } from "@/lib/hobbiesData"
import type { AboutVisibility, HobbyInterestType } from "@/types/profile"

interface HobbiesInterestsEditorProps {
    userId: string
}

const VISIBILITY_OPTIONS: { value: AboutVisibility; label: string; icon: typeof Eye }[] = [
    { value: "public", label: "Public", icon: Eye },
    { value: "followers", label: "Followers", icon: Users },
    { value: "friends", label: "Friends", icon: Users },
    { value: "only_me", label: "Only Me", icon: Lock },
]

export function HobbiesInterestsEditor({ userId }: HobbiesInterestsEditorProps) {
    const { hobbies, interests, allItems, isLoading } = useHobbiesInterests(userId)
    const { add, isPending: isAdding } = useAddHobbyInterest()
    const { remove, isPending: isRemoving } = useRemoveHobbyInterest()
    const { update, isPending: isUpdating } = useUpdateHobbyInterest()
    const [pickerOpen, setPickerOpen] = useState(false)
    const [pickerType, setPickerType] = useState<HobbyInterestType>("hobby")

    const openPicker = (type: HobbyInterestType) => {
        setPickerType(type)
        setPickerOpen(true)
    }

    const handleAddTags = async (tags: { name: string; category: string }[]) => {
        const items = pickerType === "hobby" ? hobbies : interests
        let sortOrder = items.length
        for (const tag of tags) {
            await add({
                name: tag.name,
                type: pickerType,
                category: tag.category || undefined,
                sort_order: sortOrder++,
            })
        }
    }

    const handleRemove = async (itemId: string) => {
        await remove(itemId)
    }

    const handleReorder = async (item: ParsedHobbyInterest, direction: "up" | "down", list: ParsedHobbyInterest[]) => {
        const idx = list.findIndex(i => i.item_id === item.item_id)
        const swapIdx = direction === "up" ? idx - 1 : idx + 1
        if (swapIdx < 0 || swapIdx >= list.length) return

        const other = list[swapIdx]
        await Promise.all([
            update({
                item_id: item.item_id,
                name: item.name,
                type: item.type,
                category: item.category,
                description: item.description,
                visibility: item.visibility,
                sort_order: other.sort_order,
            }),
            update({
                item_id: other.item_id,
                name: other.name,
                type: other.type,
                category: other.category,
                description: other.description,
                visibility: other.visibility,
                sort_order: item.sort_order,
            }),
        ])
    }

    const handleVisibilityChange = async (item: ParsedHobbyInterest, visibility: AboutVisibility) => {
        await update({
            item_id: item.item_id,
            name: item.name,
            type: item.type,
            category: item.category,
            description: item.description,
            visibility,
            sort_order: item.sort_order,
        })
    }

    if (isLoading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 bg-brand-secondary animate-pulse rounded-2xl" />
                ))}
            </div>
        )
    }

    const existingNames = allItems.map(i => i.name)

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <label className="text-[11px] font-black text-brand-text uppercase tracking-[0.2em]">
                    Hobbies & Interests
                </label>
                <p className="text-[10px] font-bold text-brand-text/60 uppercase tracking-wider mt-0.5">
                    Share your passions and what makes you, you
                </p>
            </div>

            {/* Hobbies Section */}
            <TagListSection
                title="Hobbies"
                icon={Heart}
                items={hobbies}
                maxCount={MAX_HOBBIES}
                onAdd={() => openPicker("hobby")}
                onRemove={handleRemove}
                onReorder={(item, dir) => handleReorder(item, dir, hobbies)}
                onVisibilityChange={handleVisibilityChange}
                isAdding={isAdding}
                isRemoving={isRemoving}
                isUpdating={isUpdating}
            />

            {/* Interests Section */}
            <TagListSection
                title="Interests"
                icon={Sparkles}
                items={interests}
                maxCount={MAX_INTERESTS}
                onAdd={() => openPicker("interest")}
                onRemove={handleRemove}
                onReorder={(item, dir) => handleReorder(item, dir, interests)}
                onVisibilityChange={handleVisibilityChange}
                isAdding={isAdding}
                isRemoving={isRemoving}
                isUpdating={isUpdating}
            />

            {/* Tag Picker Modal */}
            <TagPickerModal
                open={pickerOpen}
                onClose={() => setPickerOpen(false)}
                onAdd={handleAddTags}
                existingNames={existingNames}
                type={pickerType}
                maxCount={pickerType === "hobby" ? MAX_HOBBIES : MAX_INTERESTS}
                currentCount={pickerType === "hobby" ? hobbies.length : interests.length}
            />
        </div>
    )
}

// ─── Tag List Section ─────────────────────────────────────────────

interface TagListSectionProps {
    title: string
    icon: typeof Heart
    items: ParsedHobbyInterest[]
    maxCount: number
    onAdd: () => void
    onRemove: (itemId: string) => void
    onReorder: (item: ParsedHobbyInterest, direction: "up" | "down") => void
    onVisibilityChange: (item: ParsedHobbyInterest, visibility: AboutVisibility) => void
    isAdding: boolean
    isRemoving: boolean
    isUpdating: boolean
}

function TagListSection({
    title,
    icon: Icon,
    items,
    maxCount,
    onAdd,
    onRemove,
    onReorder,
    onVisibilityChange,
    isAdding,
    isRemoving,
    isUpdating,
}: TagListSectionProps) {
    const isBusy = isAdding || isRemoving || isUpdating
    const canAdd = items.length < maxCount

    return (
        <div className="rounded-[1.5rem] border border-brand-divider bg-brand-card overflow-hidden">
            {/* Section Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-slate-100 border border-brand-divider">
                        <Icon className="w-4 h-4 text-brand-highlight" />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-700">
                        {title}
                    </span>
                    <span className="text-[10px] font-black bg-slate-100 text-brand-highlight px-2 py-0.5 rounded-full">
                        {items.length}/{maxCount}
                    </span>
                </div>
                {canAdd && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onAdd}
                        disabled={isBusy}
                        className="h-8 px-3 rounded-xl text-blue-600 hover:text-blue-700 hover:bg-blue-50 text-[10px] font-black uppercase tracking-widest"
                    >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Add
                    </Button>
                )}
            </div>

            {/* Items List */}
            <div className="p-4">
                {items.length === 0 ? (
                    <div className="text-center py-8">
                        <Icon className="w-8 h-8 text-slate-200 mx-auto mb-3" />
                        <p className="text-[11px] font-bold text-brand-text/60 uppercase tracking-widest">
                            No {title.toLowerCase()} added yet
                        </p>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onAdd}
                            disabled={isBusy}
                            className="mt-3 text-blue-600 hover:text-blue-700 text-[10px] font-black uppercase tracking-widest"
                        >
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            Add your first {title.toLowerCase().slice(0, -1)}
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <AnimatePresence>
                            {items.map((item, idx) => (
                                <motion.div
                                    key={item.item_id}
                                    layout
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="flex items-center gap-2 p-3 rounded-xl bg-brand-secondary/50 border border-brand-divider group hover:border-brand-divider transition-colors"
                                >
                                    {/* Reorder Controls */}
                                    <div className="flex flex-col gap-0.5">
                                        <button
                                            type="button"
                                            onClick={() => onReorder(item, "up")}
                                            disabled={idx === 0 || isBusy}
                                            className="p-0.5 rounded text-slate-300 hover:text-brand-highlight disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                            aria-label="Move up"
                                        >
                                            <ChevronUp className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onReorder(item, "down")}
                                            disabled={idx === items.length - 1 || isBusy}
                                            className="p-0.5 rounded text-slate-300 hover:text-brand-highlight disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                            aria-label="Move down"
                                        >
                                            <ChevronDown className="w-3.5 h-3.5" />
                                        </button>
                                    </div>

                                    {/* Tag */}
                                    <div className="flex-1 min-w-0">
                                        <TagChip
                                            label={item.name}
                                            category={item.category}
                                            showVisibility
                                            visibility={item.visibility}
                                        />
                                    </div>

                                    {/* Visibility Selector */}
                                    <select
                                        value={item.visibility}
                                        onChange={(e) => onVisibilityChange(item, e.target.value as AboutVisibility)}
                                        disabled={isBusy}
                                        className="h-7 px-2 rounded-lg border border-brand-divider bg-brand-card text-[10px] font-bold text-brand-highlight focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer appearance-none"
                                        aria-label={`Visibility for ${item.name}`}
                                    >
                                        {VISIBILITY_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>

                                    {/* Delete */}
                                    <motion.button
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                        type="button"
                                        onClick={() => onRemove(item.item_id)}
                                        disabled={isBusy}
                                        className="p-2 rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100"
                                        aria-label={`Remove ${item.name}`}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </motion.button>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    )
}
