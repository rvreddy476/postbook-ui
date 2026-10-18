'use client'

/*
  Chat settings (CONTRACT §1.1, §1.4, §9): the page the thread header's ⋯
  opens. Every row is backed by a real route; a route the server does not
  have yet hides its row (prefs, shared tabs) or answers "not available yet"
  after a tap (clear, delete). Switches move at once and roll back, with a
  short line, if the server says no. Bubble colour is the account-wide
  chat_bubble_style setting, not a per-chat one.
*/

import { useCallback, useEffect, useMemo, useRef, useState, type JSX, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  AudioLines,
  Ban,
  BellOff,
  BellRing,
  Check,
  Clapperboard,
  Eraser,
  FileText,
  Flag,
  Loader2,
  LogOut,
  PhoneOff,
  Pin,
  Play,
  PlayCircle,
  Search,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'

import Avatar from '@/components/ui/Avatar'
import { useGlobalToast } from '@/contexts/ToastContext'
import { useBlockUser } from '@/hooks/useBlocking'
import { useMessagingSettings, useUpdateMessagingSettings } from '@/hooks/useMessagingSettings'
import { useSubmitReport } from '@/hooks/useReport'
import { previewChatAlert } from '@/hooks/useChatAlertTone'
import { alertPrefsCache, alertToneSrc } from '@/lib/chat/alertTone'
import { BUBBLE_STYLES, BUBBLE_STYLE_LABELS, bubbleClass, bubbleSwatchClass, parseBubbleStyle, type BubbleStyle } from '@/lib/chat/bubbleStyle'
import { ALERT_TONES, type AlertTone, type ConversationPrefs, type SharedMediaItem, type SharedPostItem } from '@/lib/chat/contract'
import {
  clearChat,
  deleteChatForMe,
  fetchSharedMedia,
  fetchSharedPosts,
  getConversationPrefs,
  MESSAGE_REPORT_REASONS,
  reportConversation,
  updateConversationPrefs,
  type MessageReportReason,
  type PrefsPatch,
} from '@/services/chatParityApi'
import { leaveConversation } from '@/services/messageService'

import { postCardView, usePostCards } from '../postCards'
import {
  ALERT_TONE_LABELS,
  CONFIRM_COPY,
  NOT_AVAILABLE_YET,
  PREF_SWITCH_LABELS,
  REPORT_GROUP_NOT_AVAILABLE,
  REPORT_THANKS,
  alertTonePatch,
  applyPrefSwitch,
  legacyUserReportReason,
  prefSwitchPatch,
  profileHref,
  sharedMediaSrc,
  sharedTabsVisible,
  type ConfirmKind,
  type PrefSwitch,
} from './chatSettings'
import { uniqueIds } from './sharedViewer'
import { REPORT_NOTE_MAX, REPORT_REASON_LABELS, reportNote } from './pickerSheetModels'
import '../chat-bubbles.css'

export interface ChatSettingsPanelProps {
  conversationId: string
  isGroup: boolean
  title: string // DM: peer name; group: group title
  peer: { userId: string; displayName: string; username: string | null; avatarUrl: string | null } | null
  members?: { userId: string; displayName: string | null; avatarUrl: string | null; role: string | null }[]
  onClose(): void
  onSearchInChat(): void
  onOpenSharedPost(postId: string, postIds: string[]): void // opens the in-messenger reels viewer
  onCleared(): void // history cleared
  onDeleted(): void // chat hidden for me → parent closes thread + drops row
  onLeft?(): void // group left
  onPrefsChange?(prefs: import('@/lib/chat/contract').ConversationPrefs): void
}

const SWITCH_ICONS: Record<PrefSwitch, typeof BellOff> = { isMuted: BellOff, muteCalls: PhoneOff, isPinned: Pin }
const SAVE_FAILED = "Couldn't save that. Try again."

export default function ChatSettingsPanel(props: ChatSettingsPanelProps): JSX.Element {
  const { conversationId, isGroup, title, peer, members, onClose, onSearchInChat, onOpenSharedPost, onCleared, onDeleted, onLeft, onPrefsChange } = props
  const router = useRouter()
  const toast = useGlobalToast()
  const blockUser = useBlockUser()

  /* ── per-chat prefs (§1.1) ─────────────────────────────── */
  // undefined = loading; null = the route is missing or failed (rows hide).
  const [prefs, setPrefs] = useState<ConversationPrefs | null | undefined>(undefined)
  const [saving, setSaving] = useState(false)
  const [prefError, setPrefError] = useState<string | null>(null)
  const prefsRef = useRef<ConversationPrefs | null | undefined>(undefined)
  prefsRef.current = prefs

  useEffect(() => {
    let live = true
    setPrefs(undefined)
    getConversationPrefs(conversationId)
      .then((p) => {
        if (p) alertPrefsCache.set(conversationId, { tone: p.alertTone, muted: p.isMuted, muteUntil: p.muteUntil })
        if (live) setPrefs(p)
      })
      .catch(() => { if (live) setPrefs(null) })
    return () => { live = false }
  }, [conversationId])

  const savePrefs = useCallback(
    async (optimistic: ConversationPrefs, patch: PrefsPatch) => {
      const before = prefsRef.current
      if (!before || saving) return
      setSaving(true)
      setPrefError(null)
      setPrefs(optimistic)
      try {
        const saved = await updateConversationPrefs(conversationId, patch)
        alertPrefsCache.set(conversationId, { tone: saved.alertTone, muted: saved.isMuted, muteUntil: saved.muteUntil })
        setPrefs(saved)
        onPrefsChange?.(saved)
      } catch {
        setPrefs(before)
        setPrefError(SAVE_FAILED)
      } finally {
        setSaving(false)
      }
    },
    [conversationId, onPrefsChange, saving],
  )

  const flip = (key: PrefSwitch) => {
    if (!prefs) return
    const on = !prefs[key]
    void savePrefs(applyPrefSwitch(prefs, key, on), prefSwitchPatch(key, on))
  }

  const pickTone = (tone: AlertTone) => {
    // Picking a tone plays it, so the choice is heard, not guessed.
    const src = alertToneSrc(tone)
    if (src) previewChatAlert(src)
    if (!prefs || prefs.alertTone === tone) return
    void savePrefs({ ...prefs, alertTone: tone }, alertTonePatch(tone))
  }

  /* ── confirmations ─────────────────────────────────────── */
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)

  const runConfirmed = async (kind: ConfirmKind) => {
    setConfirmBusy(true)
    try {
      if (kind === 'block' && peer) {
        await blockUser.mutateAsync(peer.userId)
        toast({ type: 'success', title: `${peer.displayName} is blocked` })
      } else if (kind === 'clear') {
        const done = await clearChat(conversationId)
        if (done === null) toast({ type: 'info', title: NOT_AVAILABLE_YET.clear })
        else {
          toast({ type: 'success', title: 'Chat cleared' })
          onCleared()
        }
      } else if (kind === 'delete') {
        const done = await deleteChatForMe(conversationId)
        if (done === null) toast({ type: 'info', title: NOT_AVAILABLE_YET.delete })
        else onDeleted()
      } else if (kind === 'leave') {
        await leaveConversation(conversationId)
        toast({ type: 'success', title: 'You left the group' })
        onLeft?.()
      }
      setConfirm(null)
    } catch {
      // useBlockUser already says why a block failed.
      if (kind !== 'block') toast({ type: 'error', title: "That didn't work", description: 'Please try again.' })
      setConfirm(null)
    } finally {
      setConfirmBusy(false)
    }
  }

  const name = (isGroup ? title : peer?.displayName || title) || 'Chat'
  const avatarSrc = isGroup ? null : peer?.avatarUrl ?? null

  return (
    <section className="flex h-full w-full flex-col overflow-y-auto bg-brand-bg" aria-label="Chat settings">
      <header className="sticky top-0 z-10 flex shrink-0 items-center gap-2 border-b border-brand-divider bg-brand-card/90 px-3 py-3 backdrop-blur-md">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to chat"
          className="flex h-8 w-8 items-center justify-center rounded-full text-brand-text/70 transition-colors hover:bg-brand-secondary hover:text-brand-text"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="text-[15px] font-semibold text-brand-text">Chat settings</h2>
      </header>

      {/* Who */}
      <div className="flex flex-col items-center px-4 pb-4 pt-6 text-center">
        <Avatar src={avatarSrc} name={name} className="h-20 w-20" />
        <p className="mt-3 text-[15px] font-semibold text-brand-text">{name}</p>
        {!isGroup && peer?.username ? <p className="mt-0.5 text-[12px] text-brand-text/60">@{peer.username}</p> : null}
        {isGroup && members ? <p className="mt-0.5 text-[12px] text-brand-text/60">{members.length === 1 ? '1 member' : `${members.length} members`}</p> : null}
        <div className="mt-4 flex gap-2">
          {!isGroup && peer ? (
            <PillButton icon={UserRound} label="View profile" onClick={() => router.push(profileHref(peer))} />
          ) : null}
          <PillButton icon={Search} label="Search in chat" onClick={onSearchInChat} />
        </div>
      </div>

      <BubbleColourSection />

      {/* Per-chat switches */}
      {prefs === undefined ? (
        <div className="flex justify-center py-4" aria-busy="true">
          <Loader2 className="h-4 w-4 animate-spin text-brand-text/40" aria-label="Loading settings" />
        </div>
      ) : prefs ? (
        <Group title="Notifications">
          <div className="px-4 py-3">
            <p className="flex items-center gap-2 text-[14px] text-brand-text">
              <BellRing className="h-4 w-4 text-brand-text/60" aria-hidden />
              Alert tone
            </p>
            <div role="radiogroup" aria-label="Alert tone" className="mt-2 flex flex-wrap gap-1.5">
              {ALERT_TONES.map((tone) => {
                const on = prefs.alertTone === tone
                return (
                  <button
                    key={tone}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={saving}
                    onClick={() => pickTone(tone)}
                    className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-colors disabled:opacity-60 ${
                      on ? 'border-primary-ink bg-primary-tint text-primary-ink' : 'border-brand-divider text-brand-text/70 hover:bg-brand-secondary'
                    }`}
                  >
                    {ALERT_TONE_LABELS[tone]}
                  </button>
                )
              })}
            </div>
          </div>
          {(['isMuted', 'muteCalls', 'isPinned'] as const).map((key) => (
            <SwitchRow key={key} icon={SWITCH_ICONS[key]} label={PREF_SWITCH_LABELS[key]} on={prefs[key]} disabled={saving} onToggle={() => flip(key)} />
          ))}
          {prefError ? <p role="alert" className="px-4 pb-3 text-[12px] text-danger">{prefError}</p> : null}
        </Group>
      ) : null}

      {/* Group members */}
      {isGroup && members && members.length > 0 ? (
        <Group title="Members">
          {members.map((m) => {
            const memberName = m.displayName || 'Member'
            const role = m.role === 'owner' ? 'Owner' : m.role === 'admin' ? 'Admin' : null
            return (
              <button
                key={m.userId}
                type="button"
                onClick={() => router.push(`/u/${encodeURIComponent(m.userId)}`)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-brand-secondary"
              >
                <Avatar src={m.avatarUrl} name={memberName} className="h-8 w-8" />
                <span className="min-w-0 flex-1 truncate text-[14px] text-brand-text">{memberName}</span>
                {role ? <span className="rounded-full bg-brand-secondary px-2 py-0.5 text-[11px] text-brand-text/60">{role}</span> : null}
              </button>
            )
          })}
        </Group>
      ) : null}

      {/* Privacy and the chat itself */}
      <Group title="Privacy and support">
        {isGroup || peer ? <ActionRow icon={Flag} label="Report" onClick={() => setReportOpen(true)} /> : null}
        {!isGroup && peer ? <ActionRow icon={Ban} label="Block" danger onClick={() => setConfirm('block')} /> : null}
        <ActionRow icon={Eraser} label="Clear chat" onClick={() => setConfirm('clear')} />
        <ActionRow icon={Trash2} label="Delete chat" danger onClick={() => setConfirm('delete')} />
        {isGroup ? <ActionRow icon={LogOut} label="Leave group" danger onClick={() => setConfirm('leave')} /> : null}
      </Group>

      <SharedTabs conversationId={conversationId} onOpenSharedPost={onOpenSharedPost} />

      <div className="h-6 shrink-0" />

      {confirm ? (
        <ConfirmSheet
          kind={confirm}
          name={confirm === 'leave' ? name : peer?.displayName || name}
          busy={confirmBusy}
          onCancel={() => setConfirm(null)}
          onConfirm={() => void runConfirmed(confirm)}
        />
      ) : null}
      {reportOpen && (isGroup || peer) ? (
        <ReportSheet
          conversationId={conversationId}
          userId={isGroup ? null : peer?.userId ?? null}
          name={isGroup ? name : peer?.displayName || name}
          onDone={() => {
            setReportOpen(false)
            toast({ type: 'success', title: REPORT_THANKS })
          }}
          onClose={() => setReportOpen(false)}
        />
      ) : null}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Bubble colour (account-wide chat_bubble_style)                     */
/* ------------------------------------------------------------------ */

function BubbleColourSection() {
  const settings = useMessagingSettings()
  const update = useUpdateMessagingSettings()
  const toast = useGlobalToast()
  const [picked, setPicked] = useState<BubbleStyle | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (settings.isError) return null
  if (!settings.data) return null

  const saved = parseBubbleStyle(settings.data.chat_bubble_style)
  const current = picked ?? saved
  const dirty = current !== saved

  const save = () => {
    setError(null)
    update.mutate(
      { chat_bubble_style: current },
      {
        onSuccess: () => {
          setPicked(null)
          toast({ type: 'success', title: 'Bubble colour saved' })
        },
        onError: () => setError(SAVE_FAILED),
      },
    )
  }

  return (
    <Group title="Bubble colour">
      <div className="px-4 py-3">
        <div className="rounded-xl bg-brand-secondary/60 p-3" aria-hidden>
          <div className="flex justify-start">
            <span className="rounded-2xl rounded-bl-sm bg-brand-card px-3 py-1.5 text-[13px] text-brand-text">How does this look?</span>
          </div>
          <div className="mt-1.5 flex justify-end">
            <span className={`rounded-2xl rounded-br-sm bg-primary-ink px-3 py-1.5 text-[13px] text-white ${bubbleClass(current)}`}>
              Looks great to me
            </span>
          </div>
        </div>
        <div role="radiogroup" aria-label="Bubble colour" className="mt-3 flex flex-wrap gap-2.5">
          {BUBBLE_STYLES.map((style) => {
            const on = current === style
            return (
              <button
                key={style}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={BUBBLE_STYLE_LABELS[style]}
                title={BUBBLE_STYLE_LABELS[style]}
                onClick={() => setPicked(style)}
                className={`flex h-8 w-8 items-center justify-center rounded-full ${bubbleSwatchClass(style)} ${
                  on ? 'ring-2 ring-primary-ink ring-offset-2 ring-offset-brand-bg' : ''
                }`}
              >
                {on ? <Check className="h-4 w-4 text-white" aria-hidden /> : null}
              </button>
            )
          })}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-[12px] text-brand-text/60">{BUBBLE_STYLE_LABELS[current]} · used in every chat</p>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || update.isPending}
            className="rounded-full bg-primary-ink px-4 py-1.5 text-[13px] font-semibold text-white transition-opacity disabled:opacity-40"
          >
            {update.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
        {error ? <p role="alert" className="mt-2 text-[12px] text-danger">{error}</p> : null}
      </div>
    </Group>
  )
}

/* ------------------------------------------------------------------ */
/*  Shared posts · Media (§1.4)                                        */
/* ------------------------------------------------------------------ */

interface Paged<T> {
  items: T[]
  cursor: string | null
  loading: boolean
  error: boolean
}

type PagedState<T> = Paged<T> | null | undefined

function usePagedShared<T>(conversationId: string, load: (id: string, cursor?: string | null) => Promise<{ items: T[]; nextCursor: string | null } | null>) {
  const [state, setState] = useState<PagedState<T>>(undefined)
  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    let live = true
    setState(undefined)
    loadRef.current(conversationId)
      .then((page) => {
        if (!live) return
        setState(page ? { items: page.items, cursor: page.nextCursor, loading: false, error: false } : null)
      })
      .catch(() => { if (live) setState({ items: [], cursor: null, loading: false, error: true }) })
    return () => { live = false }
  }, [conversationId])

  const stateRef = useRef(state)
  stateRef.current = state
  const more = useCallback(() => {
    const s = stateRef.current
    if (!s || s.loading || !s.cursor) return
    const cursor = s.cursor
    setState({ ...s, loading: true, error: false })
    loadRef.current(conversationId, cursor)
      .then((page) =>
        setState((cur) =>
          cur ? { items: [...cur.items, ...(page?.items ?? [])], cursor: page?.nextCursor ?? null, loading: false, error: false } : cur,
        ),
      )
      .catch(() => setState((cur) => (cur ? { ...cur, loading: false, error: true } : cur)))
  }, [conversationId])

  return { state, more }
}

function SharedTabs({ conversationId, onOpenSharedPost }: { conversationId: string; onOpenSharedPost(postId: string, postIds: string[]): void }) {
  const posts = usePagedShared<SharedPostItem>(conversationId, fetchSharedPosts)
  const media = usePagedShared<SharedMediaItem>(conversationId, fetchSharedMedia)
  const [tab, setTab] = useState<'posts' | 'media' | null>(null)

  const postsOn = posts.state != null
  const mediaOn = media.state != null
  // Hidden while both load, and for good when neither route exists.
  if (!sharedTabsVisible(posts.state && posts.state.items, media.state && media.state.items)) return null
  const active = tab === 'media' && mediaOn ? 'media' : tab === 'posts' && postsOn ? 'posts' : postsOn ? 'posts' : 'media'

  return (
    <section className="mt-2 border-t border-brand-divider">
      <div role="tablist" aria-label="Shared in this chat" className="flex border-b border-brand-divider">
        {postsOn ? <TabButton label="Shared posts" on={active === 'posts'} onClick={() => setTab('posts')} /> : null}
        {mediaOn ? <TabButton label="Media" on={active === 'media'} onClick={() => setTab('media')} /> : null}
      </div>
      <div role="tabpanel" className="p-2">
        {active === 'posts' && posts.state ? (
          <SharedPostsGrid page={posts.state} onMore={posts.more} onOpen={onOpenSharedPost} />
        ) : active === 'media' && media.state ? (
          <SharedMediaGrid page={media.state} onMore={media.more} />
        ) : null}
      </div>
    </section>
  )
}

function TabButton({ label, on, onClick }: { label: string; on: boolean; onClick(): void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={on}
      onClick={onClick}
      className={`flex-1 border-b-2 py-2.5 text-[13px] font-semibold transition-colors ${
        on ? 'border-primary-ink text-brand-text' : 'border-transparent text-brand-text/50 hover:text-brand-text'
      }`}
    >
      {label}
    </button>
  )
}

function PageFooter<T>({ page, onMore, emptyText }: { page: Paged<T>; onMore(): void; emptyText: string }) {
  if (page.items.length === 0 && !page.loading && !page.error) {
    return <p className="py-6 text-center text-[13px] text-brand-text/60">{emptyText}</p>
  }
  return (
    <div className="flex flex-col items-center gap-1 py-2">
      {page.error ? <p role="alert" className="text-[12px] text-danger">{page.items.length ? "Couldn't load more." : "Couldn't load these."}</p> : null}
      {page.cursor ? (
        <button
          type="button"
          onClick={onMore}
          disabled={page.loading || !page.cursor}
          className="rounded-full border border-brand-divider px-4 py-1.5 text-[12px] font-semibold text-brand-text/80 transition-colors hover:bg-brand-secondary disabled:opacity-50"
        >
          {page.loading ? 'Loading…' : 'Load more'}
        </button>
      ) : null}
    </div>
  )
}

function SharedPostsGrid({ page, onMore, onOpen }: { page: Paged<SharedPostItem>; onMore(): void; onOpen(postId: string, postIds: string[]): void }) {
  const ids = useMemo(() => uniqueIds(page.items.map((i) => i.postId)), [page.items])
  const cards = usePostCards(ids)
  const batch = { status: cards.status, posts: cards.data } as const

  return (
    <>
      {ids.length > 0 ? (
        <div className="grid grid-cols-3 gap-1">
          {ids.map((id) => {
            const view = postCardView(id, batch)
            const KindIcon = view.state === 'ready' ? (view.kindLabel === 'Reel' ? Clapperboard : view.kindLabel === 'Video' ? PlayCircle : FileText) : FileText
            return (
              <button
                key={id}
                type="button"
                onClick={() => onOpen(id, ids)}
                aria-label={view.state === 'ready' ? `${view.kindLabel}: ${view.title}` : 'Shared post'}
                className="relative aspect-[3/4] overflow-hidden rounded-lg bg-brand-secondary text-left"
              >
                {view.state === 'loading' ? <span className="absolute inset-0 animate-pulse bg-brand-secondary" /> : null}
                {view.state === 'ready' && view.posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={view.posterUrl} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
                ) : null}
                {view.state === 'ready' && !view.posterUrl ? (
                  <span className="absolute inset-0 line-clamp-5 p-2 text-[11px] leading-snug text-brand-text/80">{view.title}</span>
                ) : null}
                {view.state === 'unavailable' || view.state === 'error' ? (
                  <span className="absolute inset-0 flex items-center justify-center p-2 text-center text-[11px] text-brand-text/50">
                    {view.state === 'unavailable' ? view.text : "Couldn't load"}
                  </span>
                ) : null}
                {view.state === 'ready' ? (
                  <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[rgb(var(--reel-stage)/0.55)]">
                    <KindIcon className="h-3 w-3 text-[rgb(var(--reel-on-stage))]" aria-hidden />
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      ) : null}
      <PageFooter page={page} onMore={onMore} emptyText="No posts shared here yet." />
    </>
  )
}

function SharedMediaGrid({ page, onMore }: { page: Paged<SharedMediaItem>; onMore(): void }) {
  return (
    <>
      {page.items.length > 0 ? (
        <div className="grid grid-cols-3 gap-1">
          {page.items.map((item) => {
            const src = sharedMediaSrc(item)
            const serve = `/v1/media/${encodeURIComponent(item.mediaId)}/serve`
            return (
              <a
                key={item.messageId}
                href={serve}
                target="_blank"
                rel="noreferrer"
                aria-label={item.kind === 'video' ? 'Open video' : item.kind === 'audio' ? 'Open audio' : 'Open photo'}
                className="relative block aspect-square overflow-hidden rounded-lg bg-brand-secondary"
              >
                {item.kind === 'video' && src ? (
                  <video src={src} muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
                ) : src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <AudioLines className="h-6 w-6 text-brand-text/50" aria-hidden />
                  </span>
                )}
                {item.kind === 'video' ? (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgb(var(--reel-stage)/0.55)]">
                      <Play className="h-4 w-4 fill-current text-[rgb(var(--reel-on-stage))]" aria-hidden />
                    </span>
                  </span>
                ) : null}
              </a>
            )
          })}
        </div>
      ) : null}
      <PageFooter page={page} onMore={onMore} emptyText="No photos or videos here yet." />
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Rows                                                               */
/* ------------------------------------------------------------------ */

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-2 border-t border-brand-divider py-1">
      <h3 className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-brand-text/50">{title}</h3>
      {children}
    </section>
  )
}

function PillButton({ icon: Icon, label, onClick }: { icon: typeof Search; label: string; onClick(): void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full bg-brand-secondary px-3.5 py-1.5 text-[13px] font-medium text-brand-text transition-colors hover:bg-brand-secondary/70"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  )
}

function SwitchRow({ icon: Icon, label, on, disabled, onToggle }: { icon: typeof Search; label: string; on: boolean; disabled: boolean; onToggle(): void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onToggle}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-brand-secondary disabled:cursor-wait"
    >
      <Icon className="h-4 w-4 text-brand-text/60" aria-hidden />
      <span className="flex-1 text-[14px] text-brand-text">{label}</span>
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? 'bg-primary-ink' : 'bg-brand-divider'}`} aria-hidden>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-brand-card shadow-sm transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
    </button>
  )
}

function ActionRow({ icon: Icon, label, danger, onClick }: { icon: typeof Search; label: string; danger?: boolean; onClick(): void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left text-[14px] transition-colors hover:bg-brand-secondary ${danger ? 'text-danger' : 'text-brand-text'}`}
    >
      <Icon className={`h-4 w-4 ${danger ? 'text-danger' : 'text-brand-text/60'}`} aria-hidden />
      {label}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/*  Sheets                                                             */
/* ------------------------------------------------------------------ */

function Sheet({ label, onClose, children, alert }: { label: string; onClose(): void; children: ReactNode; alert?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div
      className="fixed inset-0 z-[1200] flex items-end justify-center bg-[rgb(var(--reel-stage)/0.6)] md:items-center md:p-4"
      onClick={onClose}
    >
      <div
        role={alert ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-t-2xl border border-brand-divider bg-brand-card p-4 shadow-xl md:rounded-2xl"
      >
        {children}
      </div>
    </div>
  )
}

function ConfirmSheet({ kind, name, busy, onCancel, onConfirm }: { kind: ConfirmKind; name: string; busy: boolean; onCancel(): void; onConfirm(): void }) {
  const copy = CONFIRM_COPY[kind]
  return (
    <Sheet label={copy.title} onClose={busy ? () => undefined : onCancel} alert>
      <h4 className="text-[15px] font-semibold text-brand-text">{copy.title}</h4>
      <p className="mt-1.5 text-[13px] leading-relaxed text-brand-text/70">{copy.body(name)}</p>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-full px-4 py-1.5 text-[13px] font-semibold text-brand-text/70 transition-colors hover:bg-brand-secondary"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-full bg-danger px-4 py-1.5 text-[13px] font-semibold text-white disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
          {copy.action}
        </button>
      </div>
    </Sheet>
  )
}

/**
 * Report this chat (POST /conversations/:id/report): a DM reports the other
 * person with recent messages as evidence, a group reports the group. A
 * server without the route yet: a DM falls back to reporting the person
 * (trust-safety /v1/reports, entity_type "user"); a group says so.
 */
function ReportSheet({ conversationId, userId, name, onDone, onClose }: { conversationId: string; userId: string | null; name: string; onDone(): void; onClose(): void }) {
  const report = useSubmitReport()
  const [reason, setReason] = useState<MessageReportReason | ''>('')
  const [sending, setSending] = useState(false)
  const [details, setDetails] = useState('')
  const [error, setError] = useState<string | null>(null)

  const send = async () => {
    if (!reason || sending) return
    setError(null)
    setSending(true)
    try {
      const done = await reportConversation(conversationId, reason, reportNote(details))
      if (done) return onDone()
      if (!userId) return setError(REPORT_GROUP_NOT_AVAILABLE)
      await report.mutateAsync({ targetType: 'user', targetId: userId, reason: legacyUserReportReason(reason), description: details.trim() })
      onDone()
    } catch (err) {
      const status = (err as { response?: { status?: number }; status?: number })?.response?.status ?? (err as { status?: number })?.status
      if (status === 409) onDone()
      else setError("Couldn't send the report. Try again.")
    } finally {
      setSending(false)
    }
  }

  return (
    <Sheet label={`Report ${name}`} onClose={onClose}>
      <div className="flex items-center justify-between">
        <h4 className="text-[15px] font-semibold text-brand-text">Report {name}</h4>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-7 w-7 items-center justify-center rounded-full text-brand-text/60 hover:bg-brand-secondary">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1 text-[12px] text-brand-text/60">{userId ? "They won't know you reported them." : "No one in the group will know you reported it."}</p>
      <div role="radiogroup" aria-label="Reason" className="mt-3 flex flex-col">
        {MESSAGE_REPORT_REASONS.map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={reason === r}
            onClick={() => setReason(r)}
            className="flex items-center justify-between rounded-lg px-2 py-2 text-left text-[14px] text-brand-text transition-colors hover:bg-brand-secondary"
          >
            {REPORT_REASON_LABELS[r]}
            <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${reason === r ? 'border-primary-ink bg-primary-ink' : 'border-brand-divider'}`} aria-hidden>
              {reason === r ? <Check className="h-3 w-3 text-white" /> : null}
            </span>
          </button>
        ))}
      </div>
      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value.slice(0, REPORT_NOTE_MAX))}
        placeholder="Anything else we should know? (optional)"
        rows={2}
        className="mt-2 w-full resize-none rounded-lg border border-brand-divider bg-brand-bg px-3 py-2 text-[13px] text-brand-text outline-none focus:border-primary-ink"
      />
      {error ? <p role="alert" className="mt-1 text-[12px] text-danger">{error}</p> : null}
      <button
        type="button"
        onClick={() => void send()}
        disabled={!reason || sending}
        className="mt-3 w-full rounded-full bg-primary-ink py-2 text-[13px] font-semibold text-white disabled:opacity-40"
      >
        {sending ? 'Sending…' : 'Send report'}
      </button>
    </Sheet>
  )
}
