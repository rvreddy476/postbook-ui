"use client"

import { useEffect, useState } from "react"
import { AtSign, Check, Globe, Hash, Link as LinkIcon, Loader2, Lock, MapPin, SlidersHorizontal, UserCheck, Users, X } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { useMentionSearch } from "@/components/comments/useMentionSearch"

import {
  AUDIENCE_OPTIONS,
  audienceRowLabel,
  commentAccessFor,
  commentsAllowed,
  languageName,
  linkProblem,
  MAX_ALT_TEXT_LENGTH,
  MAX_LINK_LENGTH,
  MAX_TITLE_LENGTH,
  normalizeLink,
  POST_LANGUAGES,
  baseLanguage,
  remixSettingFor,
  reuseAllowed,
  type ComposeMedia,
  type PostAudience,
  type PostDetailsForm,
} from "../model"
import { ComposeSheet, LinkRow, SectionLabel, SheetDone, SwitchRow } from "./ComposeSheet"

export type DetailsPatch = Partial<PostDetailsForm>

/* ─── Title ────────────────────────────────────────────────────────── */

export function TitleField({ value, onChange, disabled }: { value: string; onChange: (next: string) => void; disabled?: boolean }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      maxLength={MAX_TITLE_LENGTH}
      placeholder="Add a title"
      aria-label="Title"
      data-compose="title"
      className="w-full bg-transparent text-[17px] font-semibold text-brand-text outline-hidden placeholder:text-brand-text/40"
    />
  )
}

/* ─── # Hashtags and @ Mention ─────────────────────────────────────── */

export interface CaptionHelpersProps {
  onInsertHashtag: () => void
  onPickMention: (username: string) => void
  /** Tags a draft carried that its caption does not; shown so they can be removed. */
  extraHashtags?: readonly string[]
  onRemoveExtraHashtag?: (tag: string) => void
  extraMentions?: readonly string[]
  onRemoveExtraMention?: (name: string) => void
  disabled?: boolean
}

const chip =
  "inline-flex items-center gap-1.5 rounded-full bg-brand-secondary px-3 py-1.5 text-[13px] font-medium text-brand-text transition hover:bg-brand-text/10 disabled:opacity-40"

export function CaptionHelpers({
  onInsertHashtag,
  onPickMention,
  extraHashtags = [],
  onRemoveExtraHashtag,
  extraMentions = [],
  onRemoveExtraMention,
  disabled,
}: CaptionHelpersProps) {
  const [mentioning, setMentioning] = useState(false)
  return (
    <div data-compose="caption-helpers">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={chip} onClick={onInsertHashtag} disabled={disabled} aria-label="Add a hashtag to the description">
          <Hash className="h-4 w-4" aria-hidden="true" />
          Hashtags
        </button>
        <button
          type="button"
          className={chip}
          onClick={() => setMentioning((v) => !v)}
          disabled={disabled}
          aria-expanded={mentioning}
          aria-label="Mention someone in the description"
        >
          <AtSign className="h-4 w-4" aria-hidden="true" />
          Mention
        </button>
        {extraHashtags.map((tag) => (
          <span key={`#${tag}`} className="inline-flex items-center gap-1 rounded-full border border-brand-divider px-2.5 py-1 text-[12px] font-medium text-primary-ink">
            #{tag}
            {onRemoveExtraHashtag ? (
              <button type="button" onClick={() => onRemoveExtraHashtag(tag)} aria-label={`Remove #${tag}`} className="text-primary-ink/60 hover:text-primary-ink">
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            ) : null}
          </span>
        ))}
        {extraMentions.map((name) => (
          <span key={`@${name}`} className="inline-flex items-center gap-1 rounded-full border border-brand-divider px-2.5 py-1 text-[12px] font-medium text-primary-ink">
            @{name}
            {onRemoveExtraMention ? (
              <button type="button" onClick={() => onRemoveExtraMention(name)} aria-label={`Remove @${name}`} className="text-primary-ink/60 hover:text-primary-ink">
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            ) : null}
          </span>
        ))}
      </div>
      {mentioning ? (
        <MentionPicker
          onPick={(username) => {
            onPickMention(username)
            setMentioning(false)
          }}
          onClose={() => setMentioning(false)}
        />
      ) : null}
    </div>
  )
}

function MentionPicker({ onPick, onClose }: { onPick: (username: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState("")
  const term = query.trim().replace(/^@/, "")
  const { candidates, loading, settled } = useMentionSearch(term || null)
  return (
    <div className="mt-2 rounded-2xl border border-brand-divider bg-brand-card p-2" data-compose="mention-picker">
      <div className="flex items-center gap-2 rounded-xl bg-brand-secondary px-3 py-2">
        <AtSign className="h-4 w-4 shrink-0 text-brand-text/50" aria-hidden="true" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault()
              e.stopPropagation()
              onClose()
            }
          }}
          placeholder="Search people"
          aria-label="Search people to mention"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-brand-text outline-hidden placeholder:text-brand-text/45"
        />
        <button type="button" onClick={onClose} aria-label="Close people search" className="text-brand-text/50 hover:text-brand-text">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {term ? (
        <ul className="mt-1 max-h-56 overflow-y-auto" aria-label="People">
          {loading && candidates.length === 0 ? (
            <li className="flex items-center gap-2 px-3 py-2 text-[12px] text-brand-text/60">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Searching…
            </li>
          ) : null}
          {settled && candidates.length === 0 ? <li className="px-3 py-2 text-[12px] text-brand-text/60">No one found.</li> : null}
          {candidates.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                onClick={() => onPick(person.username)}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left hover:bg-brand-secondary"
              >
                {person.avatar ? <img src={person.avatar} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" /> : <span className="h-8 w-8 shrink-0 rounded-full bg-brand-secondary" aria-hidden="true" />}
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-brand-text">{person.name || person.username}</span>
                  <span className="block truncate text-[12px] text-brand-text/60">@{person.username}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/* ─── The rows and their sheets ────────────────────────────────────── */

type Sheet = "location" | "link" | "audience" | "more" | "disclosure" | "alt" | "language"

const AUDIENCE_ICON: Record<PostAudience, LucideIcon> = {
  public: Globe,
  followers: Users,
  friends: UserCheck,
  private: Lock,
}

export interface DetailRowsProps {
  details: PostDetailsForm
  onDetails: (patch: DetailsPatch) => void
  media: readonly ComposeMedia[]
  onAltText: (key: string, text: string) => void
  disabled?: boolean
  /** Open on a sheet (tests render a sheet without clicking). */
  initialSheet?: Sheet | null
}

function DetailRow({
  icon: Icon,
  title,
  value,
  problem,
  onClick,
  name,
  disabled,
}: {
  icon: LucideIcon
  title: string
  value?: string | null
  problem?: string | null
  onClick: () => void
  name: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-row={name}
      aria-haspopup="dialog"
      className="flex w-full items-center gap-3 px-1 py-3 text-left transition hover:bg-brand-secondary/60 disabled:opacity-50"
    >
      <Icon className="h-5 w-5 shrink-0 text-brand-text" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium text-brand-text">{title}</span>
        {value ? <span className="block truncate text-[12px] text-brand-text/60">{value}</span> : null}
        {problem ? <span className="block text-[12px] text-danger">{problem}</span> : null}
      </span>
    </button>
  )
}

const RECENT_PLACES_KEY = "post-compose:recent-places"

function readRecentPlaces(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_PLACES_KEY)
    const list: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string").slice(0, 5) : []
  } catch {
    return []
  }
}

function rememberPlace(name: string) {
  try {
    const next = [name, ...readRecentPlaces().filter((p) => p.toLowerCase() !== name.toLowerCase())].slice(0, 5)
    window.localStorage.setItem(RECENT_PLACES_KEY, JSON.stringify(next))
  } catch {
    // Storage blocked: the list is only a convenience.
  }
}

export function DetailRows({ details, onDetails, media, onAltText, disabled, initialSheet = null }: DetailRowsProps) {
  const [sheet, setSheet] = useState<Sheet | null>(initialSheet)
  const close = () => setSheet(null)
  const backToMore = () => setSheet("more")
  const photos = media.filter((m) => m.kind === "image")
  const link = normalizeLink(details.link)
  const problem = linkProblem(details.link)

  return (
    <div data-compose="detail-rows" className="divide-y divide-brand-divider">
      <DetailRow
        icon={MapPin}
        title={details.locationName.trim() || "Location"}
        value={details.locationName.trim() ? "Change or remove the place" : null}
        onClick={() => setSheet("location")}
        name="location"
        disabled={disabled}
      />
      <DetailRow icon={LinkIcon} title="Add link" value={link} problem={problem} onClick={() => setSheet("link")} name="link" disabled={disabled} />
      <DetailRow
        icon={AUDIENCE_ICON[details.visibility]}
        title={audienceRowLabel(details.visibility)}
        onClick={() => setSheet("audience")}
        name="audience"
        disabled={disabled}
      />
      <DetailRow icon={SlidersHorizontal} title="More options" onClick={() => setSheet("more")} name="more" disabled={disabled} />

      <LocationSheet
        open={sheet === "location"}
        initial={details.locationName}
        onClose={close}
        onDone={(name) => {
          const trimmed = name.trim()
          if (trimmed !== details.locationName.trim()) {
            // A typed place has no provider id or coordinates.
            onDetails({ locationName: trimmed, locationPlaceId: null, locationLat: null, locationLng: null })
          }
          if (trimmed) rememberPlace(trimmed)
          close()
        }}
      />
      <LinkSheet open={sheet === "link"} initial={details.link} onClose={close} onDone={(value) => { onDetails({ link: value.trim() }); close() }} />

      <ComposeSheet open={sheet === "audience"} title="Who can view" onClose={close}>
        <div role="radiogroup" aria-label="Who can view this post">
          {AUDIENCE_OPTIONS.map((option) => {
            const Icon = AUDIENCE_ICON[option.value]
            const selected = option.value === details.visibility
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                data-audience={option.value}
                data-autofocus={selected ? "" : undefined}
                onClick={() => {
                  onDetails({ visibility: option.value })
                  close()
                }}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-brand-secondary"
              >
                <Icon className="h-5 w-5 shrink-0 text-brand-text" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium text-brand-text">{option.label}</span>
                  <span className="block text-[12px] text-brand-text/60">{option.detail}</span>
                </span>
                {selected ? <Check className="h-5 w-5 shrink-0 text-primary-ink" aria-hidden="true" /> : null}
              </button>
            )
          })}
        </div>
      </ComposeSheet>

      <ComposeSheet open={sheet === "more"} title="More options" onClose={close} footer={<SheetDone onClick={close} />}>
        <SectionLabel>Privacy</SectionLabel>
        <SwitchRow
          name="allow-comments"
          title="Allow comments"
          checked={commentsAllowed(details.commentAccess)}
          onChange={(on) => onDetails({ commentAccess: commentAccessFor(on) })}
        />
        <SwitchRow
          name="allow-reuse"
          title="Allow reuse of content"
          detail="Others can remix your photos and use them in their own posts."
          checked={reuseAllowed(details.remixSetting)}
          onChange={(on) => onDetails({ remixSetting: remixSettingFor(on) })}
        />
        <SectionLabel>Advanced</SectionLabel>
        <LinkRow name="disclosure" title="Content disclosure" detail={disclosureSummary(details)} onClick={() => setSheet("disclosure")} />
        {photos.length > 0 ? (
          <LinkRow name="alt-text" title="Add alternative text" detail="Describe each photo for people who can't see it" onClick={() => setSheet("alt")} />
        ) : null}
        <SwitchRow
          name="ai-generated"
          title="AI-generated content"
          detail="Turn this on when AI made or substantially changed what people will see. It adds a label to the post."
          checked={details.aiGenerated}
          onChange={(on) => onDetails({ aiGenerated: on })}
        />
        <LinkRow name="language" title="Language" detail={languageName(details.language)} onClick={() => setSheet("language")} />
      </ComposeSheet>

      <ComposeSheet open={sheet === "disclosure"} title="Content disclosure" onClose={close} onBack={backToMore} footer={<SheetDone onClick={backToMore} />}>
        <p className="px-2 pb-2 text-[13px] leading-relaxed text-brand-text/70">
          Say when this post promotes a product, a service or a brand. A label shows on the post.
        </p>
        <SwitchRow
          name="paid-partnership"
          title="Paid partnership"
          detail="You were paid or given something to make it."
          checked={details.paidPromotion}
          onChange={(on) => onDetails({ paidPromotion: on })}
        />
        <SwitchRow
          name="your-brand"
          title="Your brand"
          detail="It promotes your own business or products."
          checked={details.isBranded}
          onChange={(on) => onDetails({ isBranded: on })}
        />
      </ComposeSheet>

      <ComposeSheet open={sheet === "alt"} title="Alternative text" onClose={close} onBack={backToMore} footer={<SheetDone onClick={backToMore} />}>
        <p className="px-2 pb-2 text-[13px] leading-relaxed text-brand-text/70">
          Screen readers read this out for people who can&apos;t see the photo.
        </p>
        <ul className="space-y-3">
          {media.map((item, index) =>
            item.kind === "image" ? (
              <li key={item.key} className="flex items-start gap-3 px-2">
                <img src={item.previewUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                <textarea
                  value={item.altText}
                  onChange={(e) => onAltText(item.key, e.target.value)}
                  maxLength={MAX_ALT_TEXT_LENGTH}
                  rows={2}
                  placeholder={`Describe photo ${index + 1}`}
                  aria-label={`Alternative text for photo ${index + 1}`}
                  className="min-w-0 flex-1 resize-none rounded-xl border border-brand-divider bg-brand-secondary px-3 py-2 text-[13px] text-brand-text outline-hidden placeholder:text-brand-text/45 focus:border-primary-outline"
                />
              </li>
            ) : null,
          )}
        </ul>
      </ComposeSheet>

      <ComposeSheet open={sheet === "language"} title="Language" onClose={close} onBack={backToMore}>
        <div role="radiogroup" aria-label="Language of this post">
          {POST_LANGUAGES.map((lang) => {
            const selected = lang.code === baseLanguage(details.language)
            return (
              <button
                key={lang.code}
                type="button"
                role="radio"
                aria-checked={selected}
                data-language={lang.code}
                data-autofocus={selected ? "" : undefined}
                onClick={() => {
                  onDetails({ language: lang.code })
                  backToMore()
                }}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-brand-secondary"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium text-brand-text">{lang.name}</span>
                  {lang.native ? <span className="block text-[12px] text-brand-text/60">{lang.native}</span> : null}
                </span>
                {selected ? <Check className="h-5 w-5 shrink-0 text-primary-ink" aria-hidden="true" /> : null}
              </button>
            )
          })}
        </div>
      </ComposeSheet>
    </div>
  )
}

export function disclosureSummary(details: Pick<PostDetailsForm, "paidPromotion" | "isBranded">): string {
  if (details.paidPromotion && details.isBranded) return "Paid partnership, your brand"
  if (details.paidPromotion) return "Paid partnership"
  if (details.isBranded) return "Your brand"
  return "Say when a post promotes a brand"
}

function LocationSheet({ open, initial, onDone, onClose }: { open: boolean; initial: string; onDone: (name: string) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(initial)
  const [recent, setRecent] = useState<string[]>([])
  useEffect(() => {
    if (!open) return
    setDraft(initial)
    setRecent(readRecentPlaces())
  }, [open, initial])
  return (
    <ComposeSheet
      open={open}
      title="Location"
      onClose={onClose}
      footer={
        <div className="space-y-2">
          <SheetDone onClick={() => onDone(draft)} />
          {initial.trim() ? (
            <button type="button" onClick={() => onDone("")} className="w-full rounded-full px-4 py-2 text-[13px] font-medium text-brand-text/70 hover:bg-brand-secondary">
              Remove place
            </button>
          ) : null}
        </div>
      }
    >
      <label className="flex items-center gap-2 rounded-xl border border-brand-divider bg-brand-secondary px-3 py-2.5">
        <MapPin className="h-4 w-4 shrink-0 text-brand-text/60" aria-hidden="true" />
        <input
          data-autofocus=""
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              onDone(draft)
            }
          }}
          maxLength={120}
          placeholder="Where was this?"
          aria-label="Place name"
          className="min-w-0 flex-1 bg-transparent text-[14px] text-brand-text outline-hidden placeholder:text-brand-text/45"
        />
      </label>
      {recent.length > 0 ? (
        <>
          <SectionLabel>Recent places</SectionLabel>
          <div className="flex flex-wrap gap-2 px-2">
            {recent.map((place) => (
              <button key={place} type="button" onClick={() => onDone(place)} className={chip}>
                {place}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </ComposeSheet>
  )
}

function LinkSheet({ open, initial, onDone, onClose }: { open: boolean; initial: string; onDone: (value: string) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(initial)
  useEffect(() => {
    if (open) setDraft(initial)
  }, [open, initial])
  const problem = linkProblem(draft)
  return (
    <ComposeSheet
      open={open}
      title="Add link"
      onClose={onClose}
      footer={
        <div className="space-y-2">
          <SheetDone onClick={() => onDone(draft)} disabled={problem !== null} />
          {initial.trim() ? (
            <button type="button" onClick={() => onDone("")} className="w-full rounded-full px-4 py-2 text-[13px] font-medium text-brand-text/70 hover:bg-brand-secondary">
              Remove link
            </button>
          ) : null}
        </div>
      }
    >
      <label className="flex items-center gap-2 rounded-xl border border-brand-divider bg-brand-secondary px-3 py-2.5">
        <LinkIcon className="h-4 w-4 shrink-0 text-brand-text/60" aria-hidden="true" />
        <input
          data-autofocus=""
          type="url"
          inputMode="url"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !linkProblem(draft)) {
              e.preventDefault()
              onDone(draft)
            }
          }}
          maxLength={MAX_LINK_LENGTH + 20}
          placeholder="https://"
          aria-label="Link"
          aria-invalid={problem !== null}
          aria-describedby={problem ? "post-compose-link-problem" : undefined}
          className="min-w-0 flex-1 bg-transparent text-[14px] text-brand-text outline-hidden placeholder:text-brand-text/45"
        />
      </label>
      {problem ? (
        <p id="post-compose-link-problem" role="alert" className="mt-2 px-1 text-[12px] text-danger">
          {problem}
        </p>
      ) : (
        <p className="mt-2 px-1 text-[12px] text-brand-text/60">People can open it from your post.</p>
      )}
    </ComposeSheet>
  )
}
