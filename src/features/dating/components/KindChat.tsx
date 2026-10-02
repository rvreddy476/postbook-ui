"use client"

/*
  Kind messages (mechanic M13) inside the shared messenger.

  The messenger's DmChat calls useDatingKindChat once and asks it four
  things: may this text go (okToSend), the note over the composer (nudge),
  a received bubble's text (bubbleText) and what goes under it (afterBubble).
  For any chat that is not a Pulse chat every answer is "as before": okToSend
  is never awaited, the text comes back untouched and nothing is drawn.

  A chat is a Pulse chat only when one of the viewer's own matches names its
  conversation (hooks/kindness useDatingMatchFor), and only DmChat opened
  with a conversation id (/messenger?conversation=…, which is how every
  "Open chat" on Pulse arrives) asks at all.

  The check never stops a message: an error, a 429, a 404 or an answer
  slower than KIND_CHECK_WAIT_MS sends it as it is. A 404 from kind-check or
  from bothered switches the mechanic off for this chat: no blur, no question.
*/

import "../dating.css"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"

import { kindCheck, sendBothered } from "../api/kindness"
import { useDatingMatchFor } from "../hooks/kindness"
import {
  ASKING,
  botheredAfterError,
  botheredDone,
  decideSend,
  kindCheckFailure,
  nudgeApplies,
  receivedKey,
  receivedToCheck,
  receivedView,
  type BotheredState,
  type ChatMessageLike,
  type KindCheck,
} from "../model/kindMessages"
import { BotheredPrompt, KindBubbleText, KindNudge } from "./KindMessages"
import { ReportDialog } from "./SafetyActions"

/** Verdicts on received messages, kept for the session (message id + text). Nothing about the text goes anywhere else. */
const verdicts = new Map<string, KindCheck>()

export interface KindChat {
  /** A Pulse chat, with the mechanic not known to be off. */
  active: boolean
  /** Resolves true when the text may go now; false when the note is showing (or a check is already running). */
  okToSend: (text: string) => Promise<boolean>
  /** The note over the composer, while it is about the text in the box. */
  nudge: (input: string, actions: { onEdit: () => void; onSendAnyway: () => void }) => ReactNode
  /** A message's text, blurred when it is a received unkind one. */
  bubbleText: (msg: ChatMessageLike, text: ReactNode) => ReactNode
  /** "Did this bother you?" under a received unkind message. */
  afterBubble: (msg: ChatMessageLike) => ReactNode
  /** The report dialog. */
  dialogs: ReactNode
}

export function useDatingKindChat({
  conversationId,
  myId,
  peerName,
  messages,
}: {
  /** Set only when the chat was opened by conversation id; undefined asks nothing. */
  conversationId: string | undefined
  myId: string
  peerName: string
  messages: readonly ChatMessageLike[]
}): KindChat {
  const matchId = useDatingMatchFor(conversationId)
  const [off, setOff] = useState(false)
  const [limited, setLimited] = useState(false)
  const [nudgeOn, setNudgeOn] = useState<{ text: string; reasons: string[] } | null>(null)
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set())
  const [asks, setAsks] = useState<Record<string, BotheredState>>({})
  const [reportUserId, setReportUserId] = useState("")
  const [, setVersion] = useState(0)
  const checkingRef = useRef(false)
  const inflight = useRef(new Set<string>())
  const failed = useRef(new Set<string>())
  const mounted = useRef(true)
  const active = Boolean(matchId) && !off

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // Another chat: start clean. (Not on mount, so an ordinary chat renders exactly as before.)
  const lastConversation = useRef(conversationId)
  useEffect(() => {
    if (lastConversation.current === conversationId) return
    lastConversation.current = conversationId
    setOff(false)
    setLimited(false)
    setNudgeOn(null)
    setRevealed(new Set())
    setAsks({})
    setReportUserId("")
    failed.current = new Set()
  }, [conversationId])

  // Received messages, newest first, one at a time.
  useEffect(() => {
    if (!active || limited) return
    const known = (key: string) => verdicts.has(key) || inflight.current.has(key) || failed.current.has(key)
    const todo = receivedToCheck(messages, myId, known)
    if (todo.length === 0) return
    let stopped = false
    void (async () => {
      for (const m of todo) {
        const key = receivedKey(m)
        if (stopped || !mounted.current) return
        if (known(key)) continue
        inflight.current.add(key)
        try {
          verdicts.set(key, await kindCheck(m.text))
          if (mounted.current) setVersion((v) => v + 1)
        } catch (error) {
          const failure = kindCheckFailure(error)
          if (failure === "off") {
            if (mounted.current) setOff(true)
            return
          }
          if (failure === "limited") {
            if (mounted.current) setLimited(true)
            return
          }
          // Left as it is: a failed check never blurs, and is not asked again here.
          failed.current.add(key)
        } finally {
          inflight.current.delete(key)
        }
      }
    })()
    return () => {
      stopped = true
    }
  }, [active, limited, messages, myId])

  const okToSend = useCallback(
    async (text: string): Promise<boolean> => {
      if (!active) return true
      // A second tap while a check runs does nothing; the first one sends.
      if (checkingRef.current) return false
      checkingRef.current = true
      try {
        const decision = await decideSend(text, kindCheck)
        if (!mounted.current) return decision.kind === "send"
        if (decision.kind === "send") {
          if (decision.off) setOff(true)
          setNudgeOn(null)
          return true
        }
        setNudgeOn({ text: decision.text, reasons: decision.reasons })
        return false
      } finally {
        checkingRef.current = false
      }
    },
    [active],
  )

  const reveal = (id: string) => setRevealed((s) => new Set(s).add(id))
  const setAsk = (id: string, state: BotheredState) => setAsks((a) => ({ ...a, [id]: state }))

  const answer = (msg: ChatMessageLike, bothered: boolean) => {
    setAsk(msg.id, { kind: "sending", answer: bothered })
    // "No" unblurs at once; the answer is still sent.
    if (!bothered) reveal(msg.id)
    sendBothered(matchId, bothered).then(
      (result) => {
        if (mounted.current) setAsk(msg.id, bothered ? botheredDone(result) : { kind: "dismissed" })
      },
      (error) => {
        if (!mounted.current) return
        const next = botheredAfterError(bothered, error)
        if (next === "off") setOff(true)
        else setAsk(msg.id, next)
      },
    )
  }

  const unkind = (msg: ChatMessageLike) => {
    if (!active || !msg.senderId || msg.senderId === myId || !msg.text) return false
    const verdict = verdicts.get(receivedKey(msg))
    return Boolean(verdict && !verdict.kind)
  }

  return {
    active,
    okToSend,
    nudge: (input, actions) => {
      if (!active || !nudgeOn || !nudgeApplies(nudgeOn.text, input)) return null
      return (
        <KindNudge
          reasons={nudgeOn.reasons}
          onEdit={() => {
            setNudgeOn(null)
            actions.onEdit()
          }}
          onSendAnyway={() => {
            setNudgeOn(null)
            actions.onSendAnyway()
          }}
        />
      )
    },
    bubbleText: (msg, text) => {
      if (!unkind(msg)) return text
      const view = receivedView(verdicts.get(receivedKey(msg)), revealed.has(msg.id), off)
      return <KindBubbleText view={view} text={text} onReveal={() => reveal(msg.id)} />
    },
    afterBubble: (msg) => {
      if (!unkind(msg)) return null
      return <BotheredPrompt state={asks[msg.id] ?? ASKING} name={peerName} canReport onAnswer={(b) => answer(msg, b)} onReport={() => setReportUserId(msg.senderId)} />
    },
    dialogs: active ? <ReportDialog open={reportUserId !== ""} userId={reportUserId} name={peerName} onClose={() => setReportUserId("")} /> : null,
  }
}
