"use client"

/*
  /search — Top · People · Videos · Reels · Sounds · Hashtags.

  Typing shows suggestions; a search runs when it is committed (Enter, a
  suggestion, a recent or a popular search). Committing, not every
  keystroke, matters: signed-in searches are recorded server-side, so a
  live search would fill recents with "c", "ca", "cat". The committed query
  and tab live in the URL (?q=&tab=), so Back and shared links work.

  The empty box shows recent searches (signed in only; per-item remove and
  clear all) and popular searches (everyone). Esc clears the box. Nothing
  here saves a search on the viewer's behalf.
*/

import { Suspense, useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Hash, Loader2, Search, UserRound, X } from "lucide-react"

import { useAutocomplete, useRecordSearchClick } from "@/hooks/useSearch"
import { useAuthUser } from "@/store/auth"
import { useClearRecents, usePopular, useRecents, useRemoveRecent, useTabResults } from "./searchApi"
import { parseSearchTab, searchPageHref, signInHref, type SearchTabId } from "./searchModel"
import {
    PANEL_ID,
    PopularSearches,
    RecentSearches,
    ResultsView,
    SearchTabs,
    SignedOutRecentsNote,
    StartPrompt,
    tabId,
    type ViewStatus,
} from "./SearchViews"

type Suggestion =
    | { kind: "query"; key: string; label: string }
    | { kind: "user"; key: string; label: string; sub: string; target: string }
    | { kind: "hashtag"; key: string; label: string; target: string }

function statusOf(q: { isError: boolean; isPending: boolean }): ViewStatus {
    if (q.isError) return "error"
    if (q.isPending) return "loading"
    return "ready"
}

function SearchPageContent() {
    const router = useRouter()
    const params = useSearchParams()
    const query = (params.get("q") ?? "").trim()
    // ?type= is the old spelling; old links still land on the right tab.
    const tab = parseSearchTab(params.get("tab") ?? params.get("type"))
    const signedIn = useAuthUser() !== null

    const [draft, setDraft] = useState(query)
    const [open, setOpen] = useState(false)
    const [active, setActive] = useState(-1)
    const inputRef = useRef<HTMLInputElement>(null)
    const listId = useId()

    useEffect(() => setDraft(query), [query])

    const results = useTabResults(tab, query)
    const recents = useRecents(signedIn)
    const popular = usePopular()
    const removeRecent = useRemoveRecent()
    const clearRecents = useClearRecents()
    const recordClick = useRecordSearchClick()

    const typed = draft.trim()
    // Suggestions only while the box holds something not yet searched.
    const autocomplete = useAutocomplete(open && typed !== query ? typed : "")

    const suggestions = useMemo<Suggestion[]>(() => {
        if (!typed || typed === query) return []
        const out: Suggestion[] = [{ kind: "query", key: `q:${typed}`, label: typed }]
        for (const item of autocomplete.data ?? []) {
            if (item.kind === "user" && (item.username || item.user_id)) {
                const link = item.username || item.user_id || ""
                out.push({
                    kind: "user",
                    key: `u:${item.user_id || link}`,
                    label: item.display_name || item.username || "User",
                    sub: item.username ? `@${item.username}` : "",
                    target: `/u/${encodeURIComponent(link)}`,
                })
            } else if (item.kind === "hashtag" && item.hashtag) {
                out.push({ kind: "hashtag", key: `h:${item.hashtag}`, label: `#${item.hashtag}`, target: `/hashtag/${encodeURIComponent(item.hashtag)}` })
            }
            // Communities are switched off; their suggestions are left out.
        }
        return out
    }, [typed, query, autocomplete.data])

    const showSuggestions = open && suggestions.length > 0
    useEffect(() => setActive(-1), [typed])

    const commit = useCallback(
        (q: string, nextTab: SearchTabId = tab) => {
            const clean = q.trim()
            setOpen(false)
            setDraft(clean)
            if (!clean) {
                router.replace(searchPageHref("", nextTab), { scroll: false })
                return
            }
            router.push(searchPageHref(clean, nextTab), { scroll: false })
        },
        [router, tab],
    )

    const selectTab = useCallback(
        (next: SearchTabId) => router.replace(searchPageHref(query, next), { scroll: false }),
        [router, query],
    )

    const clearBox = useCallback(() => {
        setDraft("")
        setOpen(false)
        if (query) router.replace(searchPageHref("", tab), { scroll: false })
        inputRef.current?.focus()
    }, [query, router, tab])

    const choose = (s: Suggestion) => {
        if (s.kind === "query") {
            commit(s.label)
            return
        }
        setOpen(false)
        router.push(s.target)
    }

    const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Escape") {
            e.preventDefault()
            clearBox()
            return
        }
        if (e.key === "ArrowDown" && suggestions.length > 0) {
            e.preventDefault()
            setOpen(true)
            setActive((i) => (i + 1) % suggestions.length)
            return
        }
        if (e.key === "ArrowUp" && suggestions.length > 0) {
            e.preventDefault()
            setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
            return
        }
        if (e.key === "Enter") {
            e.preventDefault()
            if (showSuggestions && active >= 0 && suggestions[active]) choose(suggestions[active])
            else commit(draft)
        }
    }

    const top = results.data?.tab === "top" ? results.data.top : null
    const topQueryId = top?.queryId ?? ""
    const onTopClick = useCallback(
        (entity: "users" | "posts" | "hashtags", id: string, position: number) => {
            if (!topQueryId) return
            recordClick.mutate({ query_id: topQueryId, entity_type: entity, entity_id: id, position })
        },
        [topQueryId, recordClick],
    )

    const returnTo = searchPageHref(query, tab)
    const recentItems = recents.data ?? []
    const popularItems = popular.data ?? []
    const nothingToSuggest =
        (!signedIn || (recents.isSuccess && recentItems.length === 0)) && !(popular.isSuccess && popularItems.length > 0)

    return (
        <div className="srch-page">
            <header className="srch-head">
                <div className="srch-head__inner">
                    <form
                        role="search"
                        className="srch-box"
                        onSubmit={(e) => {
                            e.preventDefault()
                            commit(draft)
                        }}
                    >
                        <span className="srch-box__icon" aria-hidden>
                            {results.isFetching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                        </span>
                        <input
                            ref={inputRef}
                            type="search"
                            className="srch-box__input"
                            value={draft}
                            placeholder="Search people, videos, sounds and hashtags"
                            aria-label="Search"
                            role="combobox"
                            aria-expanded={showSuggestions}
                            aria-controls={listId}
                            aria-autocomplete="list"
                            aria-activedescendant={showSuggestions && active >= 0 ? `${listId}-${active}` : undefined}
                            enterKeyHint="search"
                            autoComplete="off"
                            autoFocus={!query}
                            onChange={(e) => {
                                setDraft(e.target.value)
                                setOpen(true)
                            }}
                            onFocus={() => setOpen(true)}
                            onBlur={() => setOpen(false)}
                            onKeyDown={onKeyDown}
                        />
                        {draft ? (
                            <button type="button" className="srch-icon-button srch-box__clear" aria-label="Clear search" onClick={clearBox}>
                                <X size={18} aria-hidden />
                            </button>
                        ) : null}
                        {showSuggestions ? (
                            <ul id={listId} role="listbox" aria-label="Suggestions" className="srch-suggest">
                                {suggestions.map((s, i) => (
                                    <li
                                        key={s.key}
                                        id={`${listId}-${i}`}
                                        role="option"
                                        aria-selected={i === active}
                                        className="srch-suggest__item"
                                        // mousedown, not click: the input's blur would close the list first
                                        onMouseDown={(e) => {
                                            e.preventDefault()
                                            choose(s)
                                        }}
                                    >
                                        <span className="srch-suggest__icon" aria-hidden>
                                            {s.kind === "user" ? <UserRound size={14} /> : s.kind === "hashtag" ? <Hash size={14} /> : <Search size={14} />}
                                        </span>
                                        <span className="srch-suggest__label">{s.kind === "query" ? `Search for “${s.label}”` : s.label}</span>
                                        <span className="srch-suggest__kind">
                                            {s.kind === "user" ? s.sub || "Person" : s.kind === "hashtag" ? "Hashtag" : ""}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                    </form>
                    {query ? <SearchTabs active={tab} onSelect={selectTab} /> : null}
                </div>
            </header>

            <main className="srch-main">
                {query ? (
                    <div role="tabpanel" id={PANEL_ID} aria-labelledby={tabId(tab)}>
                        <ResultsView
                            tab={tab}
                            query={query}
                            status={statusOf(results)}
                            data={results.data}
                            onRetry={() => void results.refetch()}
                            onSelectTab={selectTab}
                            onTopClick={onTopClick}
                        />
                    </div>
                ) : (
                    <>
                        {signedIn ? (
                            <RecentSearches
                                items={recentItems}
                                status={statusOf(recents)}
                                onSelect={(q) => commit(q)}
                                onRemove={(id) => removeRecent.mutate(id)}
                                onClearAll={() => clearRecents.mutate()}
                                onRetry={() => void recents.refetch()}
                            />
                        ) : (
                            <SignedOutRecentsNote signInHref={signInHref(returnTo)} />
                        )}
                        <PopularSearches items={popularItems} status={statusOf(popular)} onSelect={(q) => commit(q)} />
                        {nothingToSuggest ? <StartPrompt /> : null}
                    </>
                )}
            </main>
        </div>
    )
}

function SearchPageFallback() {
    return (
        <div className="srch-page">
            <div className="srch-state" aria-busy="true">
                <Loader2 size={22} className="animate-spin" aria-label="Loading" />
            </div>
        </div>
    )
}

export default function SearchPage() {
    return (
        <Suspense fallback={<SearchPageFallback />}>
            <SearchPageContent />
        </Suspense>
    )
}
