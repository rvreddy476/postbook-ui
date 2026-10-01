"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useGlobalToast } from "@/contexts/ToastContext"
import { useBatchProfiles } from "@/hooks/useProfile"
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
import { canSendChat, chatRole, messageActions, nextModerators, streamTools, type MessageActionKey } from "../chat"
import { chatSendErrorCopy, isChatBan, moderationErrorCopy } from "../errors"
import { ChatMessageRow } from "./ChatMessageRow"
import { ModerationPanel } from "./ModerationPanel"
import { ReportSheet } from "./ReportSheet"

const MAX_SEND_CHARS = 500

type ProfileLite = { display_name?: string; first_name?: string; username?: string }

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

  const [draft, setDraft] = useState("")
  const [sendError, setSendError] = useState<string | null>(null)
  const [banTarget, setBanTarget] = useState<string | null>(null)
  const [reportMessageId, setReportMessageId] = useState<string | null>(null)
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  const userIds = useMemo(
    () => Array.from(new Set([...chat.messages.map((m) => m.user_id), ...chat.banned, ...chat.moderators])),
    [chat.messages, chat.banned, chat.moderators],
  )
  const { data: profiles } = useBatchProfiles(userIds)
  const nameOf = (id: string) => {
    const p = (profiles instanceof Map ? profiles.get(id) : undefined) as ProfileLite | undefined
    return p?.display_name || p?.first_name || p?.username || "Someone"
  }

  useEffect(() => {
    const el = scrollerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chat.messages.length])

  const mayType = canSendChat({ role, meId, banned: chat.banned, chatOpen: view.chatOpen })
  const amBanned = !!meId && chat.banned.includes(meId)

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

  const onAction = async (key: MessageActionKey, m: LiveChatMessage) => {
    switch (key) {
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

  const roleTag = (id: string) => (id === hostId ? "Host" : chat.moderators.includes(id) ? "Moderator" : undefined)

  return (
    <div className="flex flex-col gap-3">
      <div className="live-chat">
        <div className="live-chat__head">
          <span>Live chat</span>
          {room.polling && <span className="live-chat__mode">Updating every few seconds</span>}
        </div>
        <div ref={scrollerRef} className="live-chat__list" aria-live="polite">
          {room.chatLoading && chat.messages.length === 0 ? (
            <p className="live-chat__empty">Loading chat…</p>
          ) : chat.messages.length === 0 ? (
            <p className="live-chat__empty">No messages yet.</p>
          ) : (
            chat.messages.map((m) => (
              <ChatMessageRow
                key={m.id}
                message={m}
                name={nameOf(m.user_id)}
                roleTag={roleTag(m.user_id)}
                actions={messageActions({
                  role, meId, hostId, authorId: m.user_id, moderators: chat.moderators, banned: chat.banned,
                })}
                onAction={onAction}
              />
            ))
          )}
        </div>
        {role === "guest" ? (
          <p className="live-chat__note">Sign in to chat.</p>
        ) : amBanned ? (
          <p className="live-chat__note">You&apos;ve been removed from this stream.</p>
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
            <button type="submit" className="live-btn live-btn--primary" disabled={send.isPending || !draft.trim()}>
              Send
            </button>
          </form>
        )}
        {sendError && <div className="live-chat__error" role="alert">{sendError}</div>}
      </div>

      <ModerationPanel
        role={role}
        banned={chat.banned}
        moderators={chat.moderators}
        nameOf={nameOf}
        onUnban={doUnban}
        onRemoveModerator={(id) => changeModerators(id, "remove")}
        busy={unban.isPending || setMods.isPending}
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
