"use client"

import { useState } from "react"

import { MAX_MODERATORS } from "../model"
import {
  MAX_FILTER_WORD_CHARS,
  moderationTools,
  normalizeFilterWord,
  streamTools,
  type ChatRole,
  type LivePinned,
} from "../chat"

/**
 * Host / moderator tools outside a single message. Viewers never get it.
 *
 *   Banned (host, moderators)  GET /bans, Unban
 *   Muted (host, moderators)   GET /chat/mutes, Unmute
 *   Pinned (host)              the current pin, Unpin
 *   Filtered words (host)      GET/POST /chat/word-filters, Remove
 *   Moderators (host)          GET /moderators, Remove
 *
 * Each section exists only where live-service-v2 serves its route to that
 * role; the lists are the server's, kept current by moderation.* frames
 * while the page is open.
 */
export function ModerationPanel({
  role,
  banned,
  moderators,
  muted = [],
  pinned = null,
  pinnedName,
  words,
  nameOf,
  onUnban,
  onRemoveModerator,
  onUnmute,
  onUnpin,
  onAddWord,
  onRemoveWord,
  wordError,
  busy,
}: {
  role: ChatRole
  banned: string[]
  moderators: string[]
  muted?: string[]
  pinned?: LivePinned | null
  /** The pinned message's author name (author card, else the authors seen in chat). */
  pinnedName?: string
  /** The host's filtered words; undefined while loading. */
  words?: string[]
  nameOf: (userId: string) => string
  onUnban: (userId: string) => void
  onRemoveModerator: (userId: string) => void
  onUnmute?: (userId: string) => void
  onUnpin?: (messageId: string) => void
  /** Resolves true when the word was stored (the field then clears). */
  onAddWord?: (word: string) => Promise<boolean> | boolean
  onRemoveWord?: (word: string) => void
  wordError?: string | null
  busy?: boolean
}) {
  const [draft, setDraft] = useState("")
  const [localError, setLocalError] = useState<string | null>(null)
  const tools = streamTools(role)
  const sections = moderationTools(role)
  if (!tools.moderationPanel) return null
  const byName = (a: string, b: string) => nameOf(a).localeCompare(nameOf(b))

  const submitWord = async (e: React.FormEvent) => {
    e.preventDefault()
    const word = normalizeFilterWord(draft)
    if (!word) {
      setLocalError(`Filter words can be 1 to ${MAX_FILTER_WORD_CHARS} characters.`)
      return
    }
    if (words?.includes(word)) {
      setLocalError("That word is already filtered.")
      return
    }
    setLocalError(null)
    if (await onAddWord?.(word)) setDraft("")
  }

  const summary = [
    `${banned.length} banned`,
    sections.mutes ? `${muted.length} muted` : null,
    tools.setModerators ? `${moderators.length} moderators` : null,
  ].filter(Boolean).join(" · ")

  return (
    <details className="live-section live-moderation" data-testid="live-moderation">
      <summary>Moderation tools <span className="live-page__meta">{summary}</span></summary>
      <div className="live-moderation__body">
      <div className="live-section__title">Banned from this stream</div>
      {banned.length === 0 ? (
        <p className="live-page__meta">No one is banned.</p>
      ) : (
        <div className="live-list">
          {[...banned].sort(byName).map((id) => (
            <div key={id} className="live-list__row">
              <span>{nameOf(id)}</span>
              <button type="button" className="live-btn live-btn--ghost" disabled={busy} onClick={() => onUnban(id)}>
                Unban
              </button>
            </div>
          ))}
        </div>
      )}

      {sections.mutes && (
        <section className="live-moderation__group" data-section="mutes" aria-label="Muted in chat">
          <div className="live-section__title">Muted in chat</div>
          {muted.length === 0 ? (
            <p className="live-page__meta">No one is muted. Muted people can watch but not send messages.</p>
          ) : (
            <div className="live-list">
              {[...muted].sort(byName).map((id) => (
                <div key={id} className="live-list__row">
                  <span>{nameOf(id)}</span>
                  <button type="button" className="live-btn live-btn--ghost" disabled={busy} onClick={() => onUnmute?.(id)}>
                    Unmute
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {sections.pin && (
        <section className="live-moderation__group" data-section="pin" aria-label="Pinned message">
          <div className="live-section__title">Pinned message</div>
          {pinned ? (
            <div className="live-list__row">
              <span className="live-moderation__pinned"><strong>{pinnedName || nameOf(pinned.user_id)}</strong> {pinned.text}</span>
              <button type="button" className="live-btn live-btn--ghost" disabled={busy} onClick={() => onUnpin?.(pinned.message_id)}>
                Unpin
              </button>
            </div>
          ) : (
            <p className="live-page__meta">Nothing is pinned. Pin a message from its menu.</p>
          )}
        </section>
      )}

      {sections.wordFilters && (
        <section className="live-moderation__group" data-section="word-filters" aria-label="Filtered words">
          <div className="live-section__title">Filtered words</div>
          <p className="live-page__meta">Messages containing these words aren&apos;t posted.</p>
          <form className="live-moderation__form" onSubmit={submitWord}>
            <input
              type="text"
              className="live-field"
              value={draft}
              maxLength={MAX_FILTER_WORD_CHARS}
              onChange={(e) => { setDraft(e.target.value); setLocalError(null) }}
              placeholder="Add a word"
              aria-label="Word to filter"
            />
            <button type="submit" className="live-btn live-btn--ghost" disabled={busy || !draft.trim()}>Add</button>
          </form>
          {localError || wordError ? <p className="live-chat__error" role="alert">{localError || wordError}</p> : null}
          {words === undefined ? (
            <p className="live-page__meta">Loading words…</p>
          ) : words.length === 0 ? (
            <p className="live-page__meta">No words are filtered.</p>
          ) : (
            <ul className="live-moderation__words">
              {words.map((w) => (
                <li key={w} className="live-moderation__word">
                  <span>{w}</span>
                  <button
                    type="button"
                    className="live-moderation__word-remove"
                    disabled={busy}
                    aria-label={`Stop filtering ${w}`}
                    onClick={() => onRemoveWord?.(w)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tools.setModerators && (
        <>
          <div className="live-section__title mt-3">
            Moderators <span className="live-page__meta">({moderators.length}/{MAX_MODERATORS})</span>
          </div>
          {moderators.length === 0 ? (
            <p className="live-page__meta">Choose up to {MAX_MODERATORS} from a chat message&apos;s menu.</p>
          ) : (
            <div className="live-list">
              {[...moderators].sort(byName).map((id) => (
                <div key={id} className="live-list__row">
                  <span>{nameOf(id)}</span>
                  <button type="button" className="live-btn live-btn--ghost" disabled={busy} onClick={() => onRemoveModerator(id)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      </div>
    </details>
  )
}
