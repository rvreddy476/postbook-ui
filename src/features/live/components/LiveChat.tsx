"use client"

import { useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ArrowDown, MessageCircle, Send } from "lucide-react"

import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useGlobalToast } from "@/contexts/ToastContext"
import {
  liveV2Keys,
  useBanUser,
  useRemoveChatMessage,
  useSendLiveChat,
  useSetModerators,
  useStreamBans,
  useUnbanUser,
  type LiveRoom,
} from "@/hooks/useLiveV2"
import { errorCode, type LiveChatMessage } from "../model"
import type { LiveStatusView } from "../status"
import {
  canSendChat,
  chatRole,
  messageActions,
  moderationTools,
  nextModerators,
  streamTools,
  type MessageActionKey,
} from "../chat"
import { MUTED_COPY, chatSendErrorCopy, isChatBan, isChatMute, moderationErrorCopy } from "../errors"
import { chatAuthorAvatar, chatAuthorName, chatRoleTag, collectAuthors, nameFromAuthors } from "../author"
import { chatTimeline } from "../joins"
import {
  useAddWordFilter,
  useMuteUser,
  usePinMessage,
  usePinnedMessage,
  useRemoveWordFilter,
  useStreamMutes,
  useUnmuteUser,
  useUnpinMessage,
  useWordFilters,
} from "../useLiveModeration"
import { ChatMessageRow } from "./ChatMessageRow"
import { ChatJoinRow, PinnedMessageBar } from "./ChatSystemRows"
import { ModerationPanel } from "./ModerationPanel"
import { ReportSheet } from "./ReportSheet"
import { TopSupporters } from "./TopSupporters"

const MAX_SEND_CHARS = 500

export function LiveChat({
  streamId,
  hostId,
  meId,
  room,
  view,
}: {
  streamId: string
  hostId: string
  meId: string | null
  room: LiveRoom
  view: LiveStatusView
}) {
  const toast = useGlobalToast()
  const qc = useQueryClient()
  const { chat, dispatch } = room
  const role = chatRole(meId, hostId, chat.moderators)

  const send = useSendLiveChat(streamId)
  const remove = useRemoveChatMessage(streamId)
  const ban = useBanUser(streamId)
  const unban = useUnbanUser(streamId)
  const setMods = useSetModerators(streamId)

  // The host and moderators read the stream's real ban list (GET /bans);
  // frames keep it current while the page is open.
  const bans = useStreamBans(streamId, streamTools(role).moderationPanel)
  useEffect(() => {
    if (bans.data) dispatch({ type: "bans_seed", user_ids: bans.data })
  }, [bans.data, dispatch])

  // Mutes (host, moderators), word filters (host) and the pin (everyone):
  // live-service-v2's chat moderation routes (features/live/moderation.ts).
  const sections = moderationTools(role)
  const mutes = useStreamMutes(streamId, sections.mutes)
  useEffect(() => {
    if (mutes.data) dispatch({ type: "mutes_seed", user_ids: mutes.data })
  }, [mutes.data, dispatch])
  const pinnedQuery = usePinnedMessage(streamId)
  useEffect(() => {
    if (pinnedQuery.data !== undefined) dispatch({ type: "pinned_seed", pinned: pinnedQuery.data })
  }, [pinnedQuery.data, dispatch])
  const wordFilters = useWordFilters(streamId, sections.wordFilters)
  const mute = useMuteUser(streamId)
  const unmute = useUnmuteUser(streamId)
  const pin = usePinMessage(streamId)
  const unpin = useUnpinMessage(streamId)
  const addWord = useAddWordFilter(streamId)
  const removeWord = useRemoveWordFilter(streamId)
  const [wordError, setWordError] = useState<string | null>(null)

  const [draft, setDraft] = useState("")
  const [sendError, setSendError] = useState<string | null>(null)
  const [banTarget, setBanTarget] = useState<string | null>(null)
  const [reportMessageId, setReportMessageId] = useState<string | null>(null)
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const nearBottom = useRef(true)
  const [unseen, setUnseen] = useState(false)

  // Names come from the author card on each chat row (live-service-v2
  // hydrates it), never from a user id. The authors seen so far are kept, so
  // someone whose messages were removed still has a name in the ban dialog
  // and the moderation panel; anyone who never wrote here is "Viewer".
  const [authors, setAuthors] = useState(() => collectAuthors(new Map(), chat.messages))
  useEffect(() => {
    setAuthors((seen) => collectAuthors(seen, chat.messages))
  }, [chat.messages])
  const nameOf = (id: string) => nameFromAuthors(authors, id)

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    if (nearBottom.current) el.scrollTop = el.scrollHeight
    else setUnseen(true)
  }, [chat.messages.length])

  // A join row follows the tail like a message but never raises "Latest messages".
  useEffect(() => {
    const el = scrollerRef.current
    if (el && nearBottom.current) el.scrollTop = el.scrollHeight
  }, [chat.joins])

  const mayType = canSendChat({ role, meId, banned: chat.banned, chatOpen: view.chatOpen, muted: chat.muted })
  const amBanned = !!meId && chat.banned.includes(meId)
  const amMuted = !!meId && chat.muted.includes(meId)
  // Join notices are system rows beside the messages, never mixed into them.
  const timeline = chatTimeline(chat.messages, chat.joins, meId)
  const pinned = chat.pinned
  const pinnedName = pinned ? (pinned.author ? chatAuthorName(pinned.author) : nameOf(pinned.user_id)) : ""

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text || !mayType) return
    setSendError(null)
    try {
      const msg = await send.mutateAsync({ text })
      if (msg?.id) dispatch({ type: "sent", message: { ...msg, stream_id: msg.stream_id || streamId } })
      setDraft("")
    } catch (err) {
      setSendError(chatSendErrorCopy(err))
      // CHAT_BANNED: this stream banned me; close the composer like a
      // moderation.ban frame would. STREAM_NOT_LIVE: our status is behind.
      if (isChatBan(err) && meId) dispatch({ type: "frame", frame: { kind: "ban", stream_id: streamId, user_id: meId } })
      // CHAT_MUTED: close the composer like a moderation.mute frame would.
      if (isChatMute(err) && meId) dispatch({ type: "frame", frame: { kind: "mute", stream_id: streamId, user_id: meId } })
      // CHAT_BLOCKED_WORD keeps the draft so it can be edited (BLOCKED_WORD_COPY says so).
      if (errorCode(err) === "STREAM_NOT_LIVE") void qc.invalidateQueries({ queryKey: liveV2Keys.stream(streamId) })
    }
  }

  const changeModerators = async (userId: string, op: "add" | "remove") => {
    const next = nextModerators(chat.moderators, userId, op, hostId)
    if (!next.ok) {
      toast({
        type: "info",
        title: next.reason === "limit" ? "You can have up to 5 moderators." : "You already moderate your stream.",
      })
      return
    }
    try {
      const stored = await setMods.mutateAsync(next.user_ids)
      dispatch({ type: "moderators_seed", user_ids: stored })
    } catch (err) {
      toast({ type: "error", title: moderationErrorCopy(err) })
    }
  }

  const doUnban = async (userId: string) => {
    try {
      await unban.mutateAsync(userId)
      dispatch({ type: "frame", frame: { kind: "unban", stream_id: streamId, user_id: userId } })
    } catch (err) {
      toast({ type: "error", title: moderationErrorCopy(err) })
    }
  }

  const doUnmute = async (userId: string) => {
    try {
      await unmute.mutateAsync(userId)
      dispatch({ type: "frame", frame: { kind: "unmute", stream_id: streamId, user_id: userId } })
    } catch (err) {
      toast({ type: "error", title: moderationErrorCopy(err) })
    }
  }

  const doUnpin = async (messageId: string) => {
    try {
      await unpin.mutateAsync(messageId)
      dispatch({ type: "frame", frame: { kind: "unpin", stream_id: streamId, message_id: messageId } })
    } catch (err) {
      toast({ type: "error", title: moderationErrorCopy(err) })
    }
  }

  const doAddWord = async (word: string) => {
    setWordError(null)
    try {
      await addWord.mutateAsync(word)
      return true
    } catch (err) {
      setWordError(moderationErrorCopy(err))
      return false
    }
  }

  const doRemoveWord = async (word: string) => {
    setWordError(null)
    try {
      await removeWord.mutateAsync(word)
    } catch (err) {
      setWordError(moderationErrorCopy(err))
    }
  }

  const onAction = async (key: MessageActionKey, m: LiveChatMessage) => {
    switch (key) {
      case "mute":
        try {
          await mute.mutateAsync(m.user_id)
          dispatch({ type: "frame", frame: { kind: "mute", stream_id: streamId, user_id: m.user_id } })
        } catch (err) {
          toast({ type: "error", title: moderationErrorCopy(err) })
        }
        return
      case "unmute":
        await doUnmute(m.user_id)
        return
      case "pin":
        try {
          await pin.mutateAsync(m.id)
          dispatch({ type: "pinned_seed", pinned: { message_id: m.id, user_id: m.user_id, text: m.text, author: m.author ?? null } })
        } catch (err) {
          toast({ type: "error", title: moderationErrorCopy(err) })
        }
        return
      case "unpin":
        await doUnpin(m.id)
        return
      case "remove":
        try {
          await remove.mutateAsync(m.id)
          dispatch({ type: "removed_locally", message_id: m.id })
        } catch (err) {
          toast({ type: "error", title: moderationErrorCopy(err) })
        }
        return
      case "ban":
        setBanTarget(m.user_id)
        return
      case "unban":
        await doUnban(m.user_id)
        return
      case "make_moderator":
        await changeModerators(m.user_id, "add")
        return
      case "remove_moderator":
        await changeModerators(m.user_id, "remove")
        return
      case "report":
        setReportMessageId(m.id)
        return
    }
  }

  const confirmBan = async () => {
    const target = banTarget
    if (!target) return
    try {
      await ban.mutateAsync(target)
      dispatch({ type: "frame", frame: { kind: "ban", stream_id: streamId, user_id: target } })
      setBanTarget(null)
    } catch (err) {
      setBanTarget(null)
      toast({ type: "error", title: moderationErrorCopy(err) })
    }
  }

  return (
    <div className="live-chat-column">
      <div className="live-chat">
        <div className="live-chat__head">
          <span className="live-chat__heading"><MessageCircle size={17} aria-hidden="true" />Live chat</span>
          {room.polling && <span className="live-chat__mode">Updating every few seconds</span>}
          <TopSupporters streamId={streamId} status={view.kind} />
        </div>
        {pinned ? (
          <PinnedMessageBar
            name={pinnedName}
            text={pinned.text}
            canUnpin={sections.pin}
            busy={unpin.isPending}
            onUnpin={() => void doUnpin(pinned.message_id)}
          />
        ) : null}
        <div ref={scrollerRef} className="live-chat__list" role="log" aria-label="Live messages" aria-live="polite" aria-relevant="additions text" onScroll={(event) => {
          const el = event.currentTarget
          nearBottom.current = el.scrollHeight - el.clientHeight - el.scrollTop < 60
          if (nearBottom.current) setUnseen(false)
        }}>
          {room.chatLoading && timeline.length === 0 ? (
            <p className="live-chat__empty">Loading chat…</p>
          ) : timeline.length === 0 ? (
            <p className="live-chat__empty">No messages yet.</p>
          ) : (
            timeline.map((item) => {
              if (item.kind === "joins") return <ChatJoinRow key={item.key} label={item.label} />
              const m = item.message
              return (
                <ChatMessageRow
                  key={m.id}
                  message={m}
                  name={chatAuthorName(m.author)}
                  avatarUrl={chatAuthorAvatar(m.author)}
                  roleTag={chatRoleTag(m, hostId, chat.moderators)}
                  badges={m.author?.badges}
                  actions={messageActions({
                    role, meId, hostId, authorId: m.user_id, moderators: chat.moderators, banned: chat.banned,
                    muted: chat.muted, messageId: m.id, pinnedId: pinned?.message_id ?? null,
                  })}
                  onAction={onAction}
                />
              )
            })
          )}
        </div>
        {unseen ? <button type="button" className="live-chat__latest" onClick={() => {
          const el = scrollerRef.current
          if (el) el.scrollTop = el.scrollHeight
          nearBottom.current = true
          setUnseen(false)
        }}><ArrowDown size={14} aria-hidden="true" />Latest messages</button> : null}
        {role === "guest" ? (
          <p className="live-chat__note">Sign in to chat.</p>
        ) : amBanned ? (
          <p className="live-chat__note">You&apos;ve been removed from this stream.</p>
        ) : amMuted && view.chatOpen ? (
          <p className="live-chat__note">{MUTED_COPY}</p>
        ) : !view.chatOpen ? (
          <p className="live-chat__note">Chat opens when the stream is live.</p>
        ) : (
          <form onSubmit={handleSend} className="live-chat__form">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, MAX_SEND_CHARS))}
              placeholder="Say something…"
              aria-label="Chat message"
              className="live-chat__input"
              maxLength={MAX_SEND_CHARS}
            />
            <button type="submit" className="live-btn live-btn--primary live-chat__send" aria-label={send.isPending ? "Sending message" : "Send message"} disabled={send.isPending || !draft.trim()}>
              <Send size={18} aria-hidden="true" />
            </button>
          </form>
        )}
        {sendError && <div className="live-chat__error" role="alert">{sendError}</div>}
      </div>

      <ModerationPanel
        role={role}
        banned={chat.banned}
        moderators={chat.moderators}
        muted={chat.muted}
        pinned={pinned}
        pinnedName={pinnedName}
        words={sections.wordFilters ? wordFilters.data ?? (wordFilters.isError ? [] : undefined) : undefined}
        wordError={wordError ?? (wordFilters.isError ? "We couldn't load your filtered words." : null)}
        nameOf={nameOf}
        onUnban={doUnban}
        onRemoveModerator={(id) => changeModerators(id, "remove")}
        onUnmute={doUnmute}
        onUnpin={doUnpin}
        onAddWord={doAddWord}
        onRemoveWord={doRemoveWord}
        busy={unban.isPending || setMods.isPending || unmute.isPending || unpin.isPending || addWord.isPending || removeWord.isPending}
      />

      <ConfirmDialog
        open={!!banTarget}
        onClose={() => setBanTarget(null)}
        onConfirm={confirmBan}
        title="Ban from this stream?"
        description={banTarget ? `${nameOf(banTarget)} won't be able to chat or watch this stream. You can unban them later.` : ""}
        confirmLabel="Ban"
        loading={ban.isPending}
      />

      <ReportSheet
        open={!!reportMessageId}
        onClose={() => setReportMessageId(null)}
        streamId={streamId}
        messageId={reportMessageId}
      />
    </div>
  )
}
