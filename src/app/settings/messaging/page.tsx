"use client"

import { useId, useState, type ReactNode } from "react"
import Link from "next/link"
import {
    Activity,
    ArrowLeft,
    BellRing,
    CheckCheck,
    Ellipsis,
    EyeOff,
    ListFilter,
    MessageCircle,
    Palette,
    Phone,
    Plus,
    ShieldCheck,
    UserCheck,
    Users,
    X,
    type LucideIcon,
} from "lucide-react"

import AppShell from "@/components/AppShell"
import { BUBBLE_STYLES, BUBBLE_STYLE_LABELS, bubbleClass, bubbleSwatchClass, type BubbleStyle } from "@/lib/chat/bubbleStyle"
import { useMessagingSettings, useUpdateMessagingSettings } from "@/hooks/useMessagingSettings"
import {
    addKeyword,
    callChoices,
    chatAvailabilityValue,
    diffMessagingSettings,
    displayedCallAudience,
    displayedMessageAudience,
    groupAddChoices,
    heldFields,
    keywordCountText,
    keywordProblemText,
    messageAudienceChoices,
    messageAudiencePatch,
    messagesOn,
    messagingSettingsError,
    removeKeyword,
    visibilityChoices,
    MAX_FILTERED_KEYWORDS,
    MAX_KEYWORD_LENGTH,
    type MessagingKey,
    type MessagingPatch,
} from "../_lib/messagingSettings"
import type { Option } from "../_lib/privacySettings"
import { useSaveToast } from "../_components/useSaveToast"
import { SettingsLoadError, SettingsLoading } from "../_components/SettingsLoadState"
import "../_components/settings-hub.css"
import "@/components/messenger/chat-bubbles.css"
import "./messaging-settings.css"

/*
  Settings › Inbox & messaging (CONTRACT §9 order). Every control is a field
  of the settings document on identity user-service (GET/PUT
  /v1/users/me/settings):

    Messages (master switch)         chat_availability      enabled | paused
    Who can message you              who_can_message        the four choices (DM consent §1)
    Who can add you to groups        who_can_add_to_groups
    Who can call you                 who_can_call
    Activity status                  who_can_see_online_status
    Read receipts                    who_can_see_read_receipts
    Typing indicators                send_typing_indicators
    Message previews in notif.       show_message_preview
    Safe requests                    dm_safe_mode
    Blur sensitive media             dm_sensitive_media_filter
    Filtered words                   dm_filtered_keywords   (explicit Save; whole list)
    Bubble colour                    chat_bubble_style      (explicit Save)

  Selects and switches save on change: a PUT of that one field, shown at once
  and rolled back if the server refuses. The form is drawn only after the
  read, and only changed fields are ever sent.
*/

type FieldErrors = Partial<Record<MessagingKey, string>>

export default function MessagingSettingsPage() {
    const query = useMessagingSettings()
    const update = useUpdateMessagingSettings()
    const { showResult, Toast } = useSaveToast()
    const [pending, setPending] = useState<Partial<Record<MessagingKey, boolean>>>({})
    const [errors, setErrors] = useState<FieldErrors>({})

    /** Save `desired` for the control `key`. Resolves true when the server stored it. */
    const save = async (key: MessagingKey, desired: MessagingPatch): Promise<boolean> => {
        const base = query.data
        if (!base) return false
        const patch = diffMessagingSettings(base, desired)
        if (Object.keys(patch).length === 0) return true
        setErrors((e) => ({ ...e, [key]: undefined }))
        setPending((p) => ({ ...p, [key]: true }))
        try {
            const stored = await update.mutateAsync(patch)
            const held = heldFields(patch, stored)
            showResult(
                { ok: true, data: stored },
                held.length > 0 ? "Saved, but your account's protections keep this setting fixed." : "Saved",
            )
            return true
        } catch (err) {
            const e = messagingSettingsError(err)
            const field = e.field as MessagingKey | undefined
            if (field && field in base) setErrors((prev) => ({ ...prev, [field]: e.message }))
            showResult({ ok: false, status: e.status, code: e.code, message: e.message })
            return false
        } finally {
            setPending((p) => ({ ...p, [key]: false }))
        }
    }

    const s = query.data

    return (
        <AppShell>
            <div className="settings-hub">
                <div className="settings-hub__inner">
                    <Link href="/settings" className="msg-settings__back">
                        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden />
                        Settings
                    </Link>
                    <h1 className="settings-hub__title">Inbox &amp; messaging</h1>
                    <p className="msg-settings__intro">Who can reach you, what your chats show others, and how requests are screened.</p>

                    {query.isError ? (
                        <SettingsLoadError onRetry={() => void query.refetch()} />
                    ) : !s ? (
                        <SettingsLoading />
                    ) : (
                        <div className="settings-hub__groups">
                            <Group title="Who can reach you">
                                <SwitchRow
                                    icon={MessageCircle}
                                    label="Messages"
                                    hint={
                                        messagesOn(s)
                                            ? "On: people can message you as you choose below."
                                            : "Off: nobody can start a chat or message you, and you can't send. Your chats stay readable."
                                    }
                                    checked={messagesOn(s)}
                                    busy={pending.chat_availability}
                                    error={errors.chat_availability}
                                    onChange={(on) => void save("chat_availability", { chat_availability: chatAvailabilityValue(!on) })}
                                />
                                <AudiencePicker
                                    stored={s.who_can_message}
                                    under18={s.under_18_mode === true}
                                    busy={pending.who_can_message}
                                    error={errors.who_can_message}
                                    onPick={(v) => void save("who_can_message", messageAudiencePatch(s.who_can_message, v))}
                                />
                                <SelectRow
                                    icon={Users}
                                    label="Who can add you to groups"
                                    value={s.who_can_add_to_groups}
                                    options={groupAddChoices(s.who_can_add_to_groups)}
                                    busy={pending.who_can_add_to_groups}
                                    error={errors.who_can_add_to_groups}
                                    onChange={(v) => void save("who_can_add_to_groups", { who_can_add_to_groups: v })}
                                />
                                <SelectRow
                                    icon={Phone}
                                    label="Who can call you"
                                    value={displayedCallAudience(s.who_can_call)}
                                    options={callChoices(s.who_can_call)}
                                    busy={pending.who_can_call}
                                    error={errors.who_can_call}
                                    onChange={(v) => void save("who_can_call", { who_can_call: v })}
                                />
                            </Group>

                            <Group title="What others see">
                                <SelectRow
                                    icon={Activity}
                                    label="Activity status"
                                    hint="Who sees when you're active."
                                    value={s.who_can_see_online_status}
                                    options={visibilityChoices(s.who_can_see_online_status)}
                                    busy={pending.who_can_see_online_status}
                                    error={errors.who_can_see_online_status}
                                    onChange={(v) => void save("who_can_see_online_status", { who_can_see_online_status: v })}
                                />
                                <SelectRow
                                    icon={CheckCheck}
                                    label="Read receipts"
                                    hint="Who sees when you've read a message. With No one, you won't see theirs either."
                                    value={s.who_can_see_read_receipts}
                                    options={visibilityChoices(s.who_can_see_read_receipts)}
                                    busy={pending.who_can_see_read_receipts}
                                    error={errors.who_can_see_read_receipts}
                                    onChange={(v) => void save("who_can_see_read_receipts", { who_can_see_read_receipts: v })}
                                />
                                <SwitchRow
                                    icon={Ellipsis}
                                    label="Typing indicators"
                                    hint="Let people see when you're typing."
                                    checked={s.send_typing_indicators}
                                    busy={pending.send_typing_indicators}
                                    error={errors.send_typing_indicators}
                                    onChange={(v) => void save("send_typing_indicators", { send_typing_indicators: v })}
                                />
                                <SwitchRow
                                    icon={BellRing}
                                    label="Message previews in notifications"
                                    hint="Show who wrote and what they said. Off, notifications just say you have a new message."
                                    checked={s.show_message_preview}
                                    busy={pending.show_message_preview}
                                    error={errors.show_message_preview}
                                    onChange={(v) => void save("show_message_preview", { show_message_preview: v })}
                                />
                            </Group>

                            <Group title="Safety">
                                <SwitchRow
                                    icon={ShieldCheck}
                                    label="Safe requests"
                                    hint="Requests from new accounts, or with links, filtered words or sensitive media, go to a separate Filtered list."
                                    checked={s.dm_safe_mode}
                                    busy={pending.dm_safe_mode}
                                    error={errors.dm_safe_mode}
                                    onChange={(v) => void save("dm_safe_mode", { dm_safe_mode: v })}
                                />
                                <SwitchRow
                                    icon={EyeOff}
                                    label="Blur sensitive media"
                                    hint="Photos and videos marked sensitive stay blurred until you tap them. In requests they are always blurred."
                                    checked={s.dm_sensitive_media_filter}
                                    busy={pending.dm_sensitive_media_filter}
                                    error={errors.dm_sensitive_media_filter}
                                    onChange={(v) => void save("dm_sensitive_media_filter", { dm_sensitive_media_filter: v })}
                                />
                                <li>
                                    <KeywordEditor
                                        saved={s.dm_filtered_keywords}
                                        busy={pending.dm_filtered_keywords}
                                        serverError={errors.dm_filtered_keywords}
                                        onSave={(list) => save("dm_filtered_keywords", { dm_filtered_keywords: list })}
                                    />
                                </li>
                            </Group>

                            <Group title="Bubble colour">
                                <li>
                                    <BubblePicker
                                        saved={s.chat_bubble_style}
                                        busy={pending.chat_bubble_style}
                                        serverError={errors.chat_bubble_style}
                                        onSave={(style) => save("chat_bubble_style", { chat_bubble_style: style })}
                                    />
                                </li>
                            </Group>

                        </div>
                    )}

                    <div className="msg-settings__toast" aria-live="polite">{Toast}</div>
                </div>
            </div>
        </AppShell>
    )
}

/* ---- Building blocks ------------------------------------------------- */

function Group({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="settings-hub__group" aria-label={title}>
            <h2 className="settings-hub__heading">{title}</h2>
            <ul className="settings-hub__card">{children}</ul>
        </section>
    )
}

function RowIcon({ icon: Icon }: { icon: LucideIcon }) {
    return (
        <span className="settings-hub__icon">
            <Icon size={18} strokeWidth={1.75} aria-hidden />
        </span>
    )
}

function RowText({ id, label, hint }: { id: string; label: string; hint?: string }) {
    return (
        <span className="msg-settings__text">
            <span id={id} className="msg-settings__label">{label}</span>
            {hint ? <span className="msg-settings__hint">{hint}</span> : null}
        </span>
    )
}

function FieldError({ text }: { text?: string }) {
    return text ? <p className="msg-settings__error" role="alert">{text}</p> : null
}

function SelectRow({
    icon,
    label,
    hint,
    value,
    options,
    busy,
    error,
    onChange,
}: {
    icon: LucideIcon
    label: string
    hint?: string
    value: string
    options: Option<string>[]
    busy?: boolean
    error?: string
    onChange: (value: string) => void
}) {
    const id = useId()
    return (
        <li>
            <div className="msg-settings__row">
                <RowIcon icon={icon} />
                <RowText id={id} label={label} hint={hint} />
                <select
                    className="msg-settings__select"
                    aria-labelledby={id}
                    value={value}
                    disabled={busy}
                    onChange={(e) => onChange(e.target.value)}
                >
                    {options.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </select>
            </div>
            <FieldError text={error} />
        </li>
    )
}

function SwitchRow({
    icon,
    label,
    hint,
    checked,
    busy,
    error,
    onChange,
}: {
    icon: LucideIcon
    label: string
    hint?: string
    checked: boolean
    busy?: boolean
    error?: string
    onChange: (checked: boolean) => void
}) {
    const id = useId()
    return (
        <li>
            <div className="msg-settings__row">
                <RowIcon icon={icon} />
                <RowText id={id} label={label} hint={hint} />
                <button
                    type="button"
                    role="switch"
                    aria-checked={checked}
                    aria-labelledby={id}
                    disabled={busy}
                    className="msg-settings__switch"
                    onClick={() => onChange(!checked)}
                >
                    <span className="msg-settings__knob" />
                </button>
            </div>
            <FieldError text={error} />
        </li>
    )
}

/**
 * Who can message you (DM consent §1): the four choices, each with its one
 * line. People you follow always reach your chats, except under No one. A
 * retired stored value shows as the choice it maps to; an under-18 account
 * is not offered Everyone or Followers.
 */
function AudiencePicker({
    stored,
    under18,
    busy,
    error,
    onPick,
}: {
    stored: string
    under18: boolean
    busy?: boolean
    error?: string
    onPick: (value: string) => void
}) {
    const id = useId()
    const shown = displayedMessageAudience(stored)
    const options = messageAudienceChoices(stored, { under18 })
    return (
        <li>
            <div className="msg-settings__row">
                <RowIcon icon={UserCheck} />
                <RowText
                    id={id}
                    label="Who can message you"
                    hint={under18 ? "Accounts under 18 only get messages from people they follow." : undefined}
                />
            </div>
            <div className="msg-settings__choices" role="radiogroup" aria-labelledby={id}>
                {options.map((o) => (
                    <button
                        key={o.value}
                        type="button"
                        role="radio"
                        aria-checked={o.value === shown}
                        disabled={busy}
                        className="msg-settings__choice"
                        onClick={() => {
                            if (o.value !== shown || stored !== shown) onPick(o.value)
                        }}
                    >
                        <span className="msg-settings__radio" aria-hidden />
                        <span className="msg-settings__text">
                            <span className="msg-settings__label">{o.label}</span>
                            {o.description ? <span className="msg-settings__hint">{o.description}</span> : null}
                        </span>
                    </button>
                ))}
            </div>
            <FieldError text={error} />
        </li>
    )
}

function sameList(a: readonly string[], b: readonly string[]) {
    return a.length === b.length && a.every((v, i) => v === b[i])
}

/**
 * Filtered words: a chip list edited locally, then saved as one whole list
 * (the server replaces it). `draft` is null while nothing has been edited, so
 * a fresh read shows straight through; a failed save keeps the draft.
 */
function KeywordEditor({
    saved,
    busy,
    serverError,
    onSave,
}: {
    saved: string[]
    busy?: boolean
    serverError?: string
    onSave: (list: string[]) => Promise<boolean>
}) {
    const labelId = useId()
    const inputId = useId()
    const [draft, setDraft] = useState<string[] | null>(null)
    const [text, setText] = useState("")
    const [problem, setProblem] = useState<string | null>(null)
    const list = draft ?? saved
    const dirty = draft !== null && !sameList(draft, saved)

    const add = () => {
        if (!text.trim()) return
        const result = addKeyword(list, text)
        if (!result.ok) {
            setProblem(keywordProblemText(result.problem))
            return
        }
        setDraft(result.list)
        setText("")
        setProblem(null)
    }

    const remove = (word: string) => {
        setDraft(removeKeyword(list, word))
        setProblem(null)
    }

    const submit = async () => {
        if (!dirty || !draft) return
        if (await onSave(draft)) setDraft(null)
    }

    return (
        <div className="settings-hub__block">
            <div className="msg-settings__row">
                <RowIcon icon={ListFilter} />
                <RowText
                    id={labelId}
                    label="Filtered words"
                    hint="Requests with these words are filtered, and messages with them from people you don't know show collapsed."
                />
            </div>
            <div className="msg-settings__panel" role="group" aria-labelledby={labelId}>
                <div className="msg-settings__add">
                    <label htmlFor={inputId} className="sr-only">Add a word or phrase</label>
                    <input
                        id={inputId}
                        className="msg-settings__input"
                        value={text}
                        maxLength={MAX_KEYWORD_LENGTH * 2}
                        placeholder="Add a word or phrase"
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
                        disabled={busy || !text.trim() || list.length >= MAX_FILTERED_KEYWORDS}
                        onClick={add}
                    >
                        <Plus size={16} strokeWidth={1.75} aria-hidden />
                        Add
                    </button>
                </div>
                {problem ? <p className="msg-settings__error msg-settings__error--inline" role="alert">{problem}</p> : null}
                {list.length === 0 ? (
                    <p className="msg-settings__empty">No filtered words yet.</p>
                ) : (
                    <ul className="msg-settings__chips" aria-label="Your filtered words">
                        {list.map((word) => (
                            <li key={word} className="msg-settings__chip">
                                <span>{word}</span>
                                <button
                                    type="button"
                                    className="msg-settings__chip-remove"
                                    aria-label={`Remove ${word}`}
                                    disabled={busy}
                                    onClick={() => remove(word)}
                                >
                                    <X size={14} strokeWidth={2} aria-hidden />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                {serverError ? <p className="msg-settings__error msg-settings__error--inline" role="alert">{serverError}</p> : null}
                <div className="msg-settings__actions">
                    <span className="msg-settings__count" aria-label={`${list.length} of ${MAX_FILTERED_KEYWORDS} words`}>
                        {keywordCountText(list)}
                    </span>
                    {dirty ? (
                        <button type="button" className="msg-settings__button" disabled={busy} onClick={() => { setDraft(null); setProblem(null) }}>
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
    )
}

/** Bubble colour: six swatches, a live preview, and an explicit Save. */
function BubblePicker({
    saved,
    busy,
    serverError,
    onSave,
}: {
    saved: BubbleStyle
    busy?: boolean
    serverError?: string
    onSave: (style: BubbleStyle) => Promise<boolean>
}) {
    const labelId = useId()
    const [choice, setChoice] = useState<BubbleStyle | null>(null)
    const style = choice ?? saved
    const dirty = choice !== null && choice !== saved

    const submit = async () => {
        if (!dirty || !choice) return
        if (await onSave(choice)) setChoice(null)
    }

    return (
        <div className="settings-hub__block">
            <div className="msg-settings__row">
                <RowIcon icon={Palette} />
                <RowText id={labelId} label="Bubble colour" hint="The colour of your messages in every chat." />
            </div>
            <div className="msg-settings__panel">
                <div className="msg-settings__swatches" role="radiogroup" aria-labelledby={labelId}>
                    {BUBBLE_STYLES.map((option) => (
                        <span key={option} className="msg-settings__swatch-item">
                            <button
                                type="button"
                                role="radio"
                                aria-checked={style === option}
                                aria-label={BUBBLE_STYLE_LABELS[option]}
                                disabled={busy}
                                className={`msg-settings__swatch ${bubbleSwatchClass(option)}`}
                                onClick={() => setChoice(option === saved ? null : option)}
                            />
                            <span aria-hidden>{BUBBLE_STYLE_LABELS[option]}</span>
                        </span>
                    ))}
                </div>
                <div className="msg-settings__preview" aria-label="Preview">
                    <p className="msg-settings__bubble msg-settings__bubble--in">Are we still on for tonight?</p>
                    <p className={`msg-settings__bubble msg-settings__bubble--out bg-primary-ink text-white ${bubbleClass(style)}`}>Yes! See you at 7.</p>
                    <p className={`msg-settings__bubble msg-settings__bubble--out bg-primary-ink text-white ${bubbleClass(style)}`}>I&apos;ll bring the snacks.</p>
                </div>
                {serverError ? <p className="msg-settings__error msg-settings__error--inline" role="alert">{serverError}</p> : null}
                <div className="msg-settings__actions">
                    {dirty ? (
                        <button type="button" className="msg-settings__button" disabled={busy} onClick={() => setChoice(null)}>
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
    )
}

