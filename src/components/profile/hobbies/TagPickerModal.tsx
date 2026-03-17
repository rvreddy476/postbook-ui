"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { Search, Plus, Check, X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Dialog } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
    HOBBY_INTEREST_CATEGORIES,
    SUGGESTED_TAGS,
    MAX_LABEL_LENGTH,
    getCategoryColor,
} from "@/lib/hobbiesData"
import type { HobbyInterestType } from "@/types/profile"

interface TagPickerModalProps {
    open: boolean
    onClose: () => void
    onAdd: (tags: { name: string; category: string }[]) => void
    existingNames: string[]
    type: HobbyInterestType
    maxCount: number
    currentCount: number
}

export function TagPickerModal({
    open,
    onClose,
    onAdd,
    existingNames,
    type,
    maxCount,
    currentCount,
}: TagPickerModalProps) {
    const [search, setSearch] = useState("")
    const [activeCategory, setActiveCategory] = useState<string | null>(null)
    const [selected, setSelected] = useState<{ name: string; category: string }[]>([])
    const [customInput, setCustomInput] = useState("")
    const searchRef = useRef<HTMLInputElement>(null)
    const remaining = maxCount - currentCount - selected.length

    useEffect(() => {
        if (open) {
            setSearch("")
            setActiveCategory(null)
            setSelected([])
            setCustomInput("")
            setTimeout(() => searchRef.current?.focus(), 100)
        }
    }, [open])

    const existingSet = useMemo(
        () => new Set([...existingNames.map(n => n.toLowerCase()), ...selected.map(s => s.name.toLowerCase())]),
        [existingNames, selected]
    )

    const filteredSuggestions = useMemo(() => {
        const results: { name: string; category: string }[] = []
        const categories = activeCategory
            ? [activeCategory]
            : HOBBY_INTEREST_CATEGORIES.map(c => c.id)

        for (const catId of categories) {
            const tags = SUGGESTED_TAGS[catId] ?? []
            for (const tag of tags) {
                if (search && !tag.toLowerCase().includes(search.toLowerCase())) continue
                results.push({ name: tag, category: catId })
            }
        }
        return results
    }, [search, activeCategory])

    const toggleTag = (tag: { name: string; category: string }) => {
        const idx = selected.findIndex(s => s.name.toLowerCase() === tag.name.toLowerCase())
        if (idx >= 0) {
            setSelected(prev => prev.filter((_, i) => i !== idx))
        } else if (remaining > 0) {
            setSelected(prev => [...prev, tag])
        }
    }

    const addCustomTag = () => {
        const trimmed = customInput.trim()
        if (!trimmed || trimmed.length > MAX_LABEL_LENGTH) return
        if (existingSet.has(trimmed.toLowerCase())) return
        if (remaining <= 0) return
        setSelected(prev => [...prev, { name: trimmed, category: activeCategory ?? "" }])
        setCustomInput("")
    }

    const handleConfirm = () => {
        if (selected.length > 0) {
            onAdd(selected)
        }
        onClose()
    }

    const title = type === "hobby" ? "Add Hobbies" : "Add Interests"

    return (
        <Dialog open={open} onClose={onClose} title={title}>
            <div className="space-y-5">
                {/* Counter */}
                <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-brand-text/60 uppercase tracking-widest">
                        {remaining > 0 ? `${remaining} more available` : "Limit reached"}
                    </p>
                    {selected.length > 0 && (
                        <span className="text-[10px] font-black bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                            {selected.length} selected
                        </span>
                    )}
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text/60" />
                    <input
                        ref={searchRef}
                        type="text"
                        placeholder={`Search ${type === "hobby" ? "hobbies" : "interests"}...`}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full h-11 pl-10 pr-4 rounded-xl border border-brand-divider bg-brand-card text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-brand-text/60"
                    />
                </div>

                {/* Category Tabs */}
                <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto">
                    <button
                        type="button"
                        onClick={() => setActiveCategory(null)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                            activeCategory === null
                                ? "bg-slate-900 text-white"
                                : "bg-slate-100 text-brand-highlight hover:bg-slate-200"
                        }`}
                    >
                        All
                    </button>
                    {HOBBY_INTEREST_CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => setActiveCategory(cat.id === activeCategory ? null : cat.id)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                                activeCategory === cat.id
                                    ? "bg-slate-900 text-white"
                                    : "bg-slate-100 text-brand-highlight hover:bg-slate-200"
                            }`}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>

                {/* Selected Tags */}
                <AnimatePresence>
                    {selected.length > 0 && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="flex flex-wrap gap-1.5 p-3 bg-blue-50/50 rounded-xl border border-blue-100"
                        >
                            {selected.map((tag, i) => (
                                <motion.span
                                    key={tag.name}
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.8, opacity: 0 }}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${getCategoryColor(tag.category)}`}
                                >
                                    {tag.name}
                                    <button
                                        type="button"
                                        onClick={() => setSelected(prev => prev.filter((_, idx) => idx !== i))}
                                        className="ml-0.5 rounded-full p-0.5 hover:bg-black/10"
                                    >
                                        <X className="w-2.5 h-2.5" />
                                    </button>
                                </motion.span>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Suggestions Grid */}
                <div className="max-h-[200px] overflow-y-auto space-y-1 pr-1">
                    {filteredSuggestions.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                            {filteredSuggestions.map((tag) => {
                                const isExisting = existingSet.has(tag.name.toLowerCase())
                                const isSelected = selected.some(s => s.name.toLowerCase() === tag.name.toLowerCase())
                                return (
                                    <button
                                        key={`${tag.category}-${tag.name}`}
                                        type="button"
                                        disabled={isExisting && !isSelected}
                                        onClick={() => toggleTag(tag)}
                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                                            isSelected
                                                ? "bg-blue-600 text-white border-blue-600"
                                                : isExisting
                                                  ? "bg-brand-secondary text-slate-300 border-brand-divider cursor-not-allowed"
                                                  : `${getCategoryColor(tag.category)} hover:shadow-sm cursor-pointer`
                                        }`}
                                    >
                                        {isSelected && <Check className="w-3 h-3" />}
                                        {tag.name}
                                    </button>
                                )
                            })}
                        </div>
                    ) : search ? (
                        <p className="text-xs text-brand-text/60 text-center py-4">
                            No suggestions match "{search}"
                        </p>
                    ) : null}
                </div>

                {/* Custom Input */}
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="Or type a custom one..."
                        value={customInput}
                        onChange={(e) => setCustomInput(e.target.value.slice(0, MAX_LABEL_LENGTH))}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault()
                                addCustomTag()
                            }
                        }}
                        className="flex-1 h-10 px-3 rounded-xl border border-brand-divider bg-brand-card text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-brand-text/60"
                    />
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={addCustomTag}
                        disabled={!customInput.trim() || remaining <= 0 || existingSet.has(customInput.trim().toLowerCase())}
                        className="h-10 px-4 rounded-xl"
                    >
                        <Plus className="w-4 h-4" />
                    </Button>
                </div>

                {customInput.length > 0 && (
                    <p className="text-[10px] text-brand-text/60">
                        {customInput.length}/{MAX_LABEL_LENGTH} characters
                    </p>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-2 border-t border-brand-divider">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="h-10 px-6 rounded-xl text-brand-highlight text-xs font-bold uppercase tracking-widest"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={selected.length === 0}
                        className="h-10 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-widest shadow-lg shadow-blue-600/20"
                    >
                        Add {selected.length > 0 ? `(${selected.length})` : ""}
                    </Button>
                </div>
            </div>
        </Dialog>
    )
}
