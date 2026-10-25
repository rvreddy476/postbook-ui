'use client'

/*
  Hidden chats in Messages (contract 24 Oct 2026): the settings, the hidden
  list behind the secret key, the chat password, and the re-lock rules. The
  tokens themselves never leave lib/chat/hiddenChats/tokenStore.ts (memory).
*/

import { useCallback, useEffect, useRef, useState } from 'react'

import type { InboxRow } from '@/lib/chat/contract'
import { hiddenChatTokens, type HiddenTokenSnapshot } from '@/lib/chat/hiddenChats/tokenStore'
import { installHiddenChatGuards } from '@/lib/chat/hiddenChats/guards'
import { couldBeSecretKey } from '@/lib/chat/hiddenChats/validation'
import { effectiveShortcut, type Shortcut } from '@/lib/chat/hiddenChats/shortcut'
import type { HiddenSettings } from '@/lib/chat/hiddenChats/requests'
import {
  fetchHiddenConversations,
  fetchHiddenSettings,
  hideConversation,
  openHiddenChats,
  revealHiddenChats,
  unhideConversation,
  type OpenOutcome,
  type RevealOutcome,
} from '@/services/hiddenChatsApi'
import { getSession } from '@/services/authService'

export function useHiddenChats(myId: string) {
  const [snap, setSnap] = useState<HiddenTokenSnapshot>(() => hiddenChatTokens.snapshot())
  /** undefined while loading; null when the server has no hidden chats yet. */
  const [settings, setSettings] = useState<HiddenSettings | null | undefined>(undefined)
  const [rows, setRows] = useState<InboxRow[] | null>(null)
  const [viewOpen, setViewOpen] = useState(false)
  const lastSearchTry = useRef<string | null>(null)

  useEffect(
    () =>
      hiddenChatTokens.subscribe((s) => {
        setSnap(s)
        if (!s.revealed) {
          // Re-locked: the list leaves memory and the view closes.
          setRows(null)
          setViewOpen(false)
        }
      }),
    [],
  )

  // Leaving Messages locks too: nothing else on the site shows hidden chats.
  useEffect(() => () => hiddenChatTokens.drop('lock'), [])

  // Re-lock on tab hidden, 1 minute idle, and a change of signed-in account.
  useEffect(() => {
    if (typeof document === 'undefined' || !myId) return
    return installHiddenChatGuards(
      { doc: document, win: window, currentUserId: () => getSession()?.id ?? null },
      hiddenChatTokens,
      myId,
    )
  }, [myId])

  const loadSettings = useCallback(async () => {
    try {
      setSettings(await fetchHiddenSettings())
    } catch {
      setSettings(null)
    }
  }, [])

  useEffect(() => {
    if (myId) void loadSettings()
  }, [myId, loadSettings])

  const loadRows = useCallback(async (): Promise<InboxRow[] | null> => {
    try {
      const list = await fetchHiddenConversations(myId)
      setRows(list)
      return list
    } catch {
      setRows(null)
      return null
    }
  }, [myId])

  /** A key from the prompt: the outcome is shown there. */
  const tryKey = useCallback(async (key: string): Promise<RevealOutcome> => {
    const out = await revealHiddenChats(key)
    if (out.ok) {
      setViewOpen(true)
      await loadRows()
    }
    return out
  }, [loadRows])

  /**
   * A search submitted from the chat search box. Only text that could be a
   * key, only when this account has hidden chats set up, and never the same
   * text twice in a row. A wrong key changes nothing on screen — the search
   * results stay exactly as they were. Returns true when it opened the list.
   */
  const trySearchKey = useCallback(async (text: string): Promise<boolean> => {
    const key = text.trim()
    if (!settings?.configured || !couldBeSecretKey(key)) return false
    if (lastSearchTry.current === key) return false
    lastSearchTry.current = key
    const out = await revealHiddenChats(key)
    if (!out.ok) return false
    lastSearchTry.current = null
    setViewOpen(true)
    await loadRows()
    return true
  }, [settings])

  const openWithPassword = useCallback((password: string): Promise<OpenOutcome> => openHiddenChats(password), [])

  const lock = useCallback(() => hiddenChatTokens.drop('lock'), [])

  /** Hide a chat for me; the caller removes it from the normal lists. */
  const hide = useCallback(async (row: InboxRow) => {
    await hideConversation(row.id)
  }, [])

  const unhide = useCallback(async (conversationId: string) => {
    await unhideConversation(conversationId)
    setRows((prev) => (prev ? prev.filter((r) => r.id !== conversationId) : prev))
  }, [])

  const shortcut: Shortcut = effectiveShortcut(settings?.shortcut ?? null)

  return {
    settings,
    reloadSettings: loadSettings,
    setSettings,
    revealed: snap.revealed,
    opened: snap.opened,
    lastDrop: snap.lastDrop,
    rows,
    viewOpen: viewOpen && snap.revealed,
    loadRows,
    tryKey,
    trySearchKey,
    openWithPassword,
    lock,
    hide,
    unhide,
    shortcut,
  }
}

export type HiddenChats = ReturnType<typeof useHiddenChats>
