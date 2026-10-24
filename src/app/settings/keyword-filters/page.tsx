"use client"

import { useId, useState } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, ListFilter, Plus, X } from "lucide-react"

import AppShell from "@/components/AppShell"
import api from "@/lib/api"
import {
    KEYWORD_FILTERS_PATH,
    MAX_FEED_KEYWORDS,
    MAX_FEED_KEYWORD_LENGTH,
    addFeedKeyword,
    feedKeywordCountText,
    feedKeywordProblemText,
    keywordFiltersRequest,
    keywordFiltersSaveError,
    parseKeywordFilters,
    removeFeedKeyword,
    sameKeywordList,
} from "../_lib/keywordFilters"
import { useSaveToast } from "../_components/useSaveToast"
import { SettingsLoadError, SettingsLoading } from "../_components/SettingsLoadState"
import "../_components/settings-hub.css"
import "../messaging/messaging-settings.css"

/*
  Settings › Filter keywords: posts whose text contains one of these words
  or hashtags stay out of your feeds. The list is yours alone — authors are
  never told — and a Save replaces it whole (see _lib/keywordFilters.ts).
  The DM word filter is a different list, on Inbox & messaging.
*/

const KEYWORD_FILTERS_KEY = ["keyword-filters"] as const

export default function KeywordFiltersPage() {
    const qc = useQueryClient()
    const { showResult, Toast } = useSaveToast()
    const labelId = useId()
    const inputId = useId()
    const [draft, setDraft] = useState<string[] | null>(null)
    const [text, setText] = useState("")
    const [problem, setProblem] = useState<string | null>(null)

    const query = useQuery<string[]>({
        queryKey: KEYWORD_FILTERS_KEY,
        queryFn: async () => {
            const res = await api.get(KEYWORD_FILTERS_PATH)
            const list = parseKeywordFilters(res.data)
            if (!list) throw new Error("The filter keywords response had no list.")
            return list
        },
        staleTime: 0,
        refetchOnWindowFocus: false,
    })

    const save = useMutation<string[], unknown, string[]>({
        mutationFn: async (next) => {
            const saved = query.data ?? []
            const req = keywordFiltersRequest(saved, next)
            if (!req) return saved
            const res = await api.put(req.url, req.body)
            // The stored, normalised list is the new baseline, not the draft.
            const stored = parseKeywordFilters(res.data)
            if (!stored) throw new Error("The server did not confirm the change.")
            return stored
        },
        onSuccess: (stored) => qc.setQueryData(KEYWORD_FILTERS_KEY, stored),
    })

    const saved = query.data ?? []
    const list = draft ?? saved
    const dirty = draft !== null && !sameKeywordList(draft, saved)
    const busy = save.isPending

    const add = () => {
        if (!text.trim()) return
        const result = addFeedKeyword(list, text)
        if (!result.ok) {
            setProblem(feedKeywordProblemText(result.problem))
            return
        }
        setDraft(result.list)
        setText("")
        setProblem(null)
    }

    const submit = async () => {
        if (!dirty || !draft) return
        try {
            const stored = await save.mutateAsync(draft)
            setDraft(null)
            showResult({ ok: true, data: stored })
        } catch (err) {
            showResult({ ok: false, message: keywordFiltersSaveError(err) })
        }
    }

    return (
        <AppShell>
            <div className="settings-hub">
                <div className="settings-hub__inner">
                    <Link href="/settings" className="msg-settings__back">
                        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden />
                        Settings
                    </Link>
                    <h1 className="settings-hub__title">Filter keywords</h1>
                    <p className="msg-settings__intro">
                        Posts that mention these words or hashtags won&apos;t show in your feeds. Nobody is told what you filter.
                    </p>

                    {query.isError ? (
                        <SettingsLoadError onRetry={() => void query.refetch()} />
                    ) : !query.data ? (
                        <SettingsLoading />
                    ) : (
                        <div className="settings-hub__groups">
                            <section className="settings-hub__group" aria-label="Your filter words">
                                <ul className="settings-hub__card">
                                    <li>
                                        <div className="settings-hub__block">
                                            <div className="msg-settings__row">
                                                <span className="settings-hub__icon">
                                                    <ListFilter size={18} strokeWidth={1.75} aria-hidden />
                                                </span>
                                                <span className="msg-settings__text">
                                                    <span id={labelId} className="msg-settings__label">Words and hashtags</span>
                                                    <span className="msg-settings__hint">
                                                        A hashtag filters the word too: #travel and travel are the same filter.
                                                    </span>
                                                </span>
                                            </div>
                                            <div className="msg-settings__panel" role="group" aria-labelledby={labelId}>
                                                <div className="msg-settings__add">
                                                    <label htmlFor={inputId} className="sr-only">Add a word, phrase or hashtag</label>
                                                    <input
                                                        id={inputId}
                                                        className="msg-settings__input"
                                                        value={text}
                                                        maxLength={MAX_FEED_KEYWORD_LENGTH * 2}
                                                        placeholder="Add a word, phrase or #hashtag"
                                                        disabled={busy}
                                                        onChange={(e) => {
                                                            setText(e.target.value)
                                                            setProblem(null)
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter") {
                                                                e.preventDefault()
                                                                add()
                                                            }
                                                        }}
                                                    />
                                                    <button
                                                        type="button"
                                                        className="msg-settings__button"
                                                        disabled={busy || !text.trim() || list.length >= MAX_FEED_KEYWORDS}
                                                        onClick={add}
                                                    >
                                                        <Plus size={16} strokeWidth={1.75} aria-hidden />
                                                        Add
                                                    </button>
                                                </div>
                                                {problem ? (
                                                    <p className="msg-settings__error msg-settings__error--inline" role="alert">{problem}</p>
                                                ) : null}
                                                {list.length === 0 ? (
                                                    <p className="msg-settings__empty">No filter words yet.</p>
                                                ) : (
                                                    <ul className="msg-settings__chips" aria-label="Your filter words">
                                                        {list.map((word) => (
                                                            <li key={word} className="msg-settings__chip">
                                                                <span>{word}</span>
                                                                <button
                                                                    type="button"
                                                                    className="msg-settings__chip-remove"
                                                                    aria-label={`Remove ${word}`}
                                                                    disabled={busy}
                                                                    onClick={() => {
                                                                        setDraft(removeFeedKeyword(list, word))
                                                                        setProblem(null)
                                                                    }}
                                                                >
                                                                    <X size={14} strokeWidth={2} aria-hidden />
                                                                </button>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                                <div className="msg-settings__actions">
                                                    <span
                                                        className="msg-settings__count"
                                                        aria-label={`${list.length} of ${MAX_FEED_KEYWORDS} words`}
                                                    >
                                                        {feedKeywordCountText(list)}
                                                    </span>
                                                    {dirty ? (
                                                        <button
                                                            type="button"
                                                            className="msg-settings__button"
                                                            disabled={busy}
                                                            onClick={() => {
                                                                setDraft(null)
                                                                setProblem(null)
                                                            }}
                                                        >
                                                            Undo
                                                        </button>
                                                    ) : null}
                                                    <button
                                                        type="button"
                                                        className="msg-settings__button msg-settings__button--primary"
                                                        disabled={!dirty || busy}
                                                        onClick={() => void submit()}
                                                    >
                                                        {busy ? "Saving…" : "Save"}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </li>
                                </ul>
                            </section>
                            {Toast}
                        </div>
                    )}
                </div>
            </div>
        </AppShell>
    )
}
