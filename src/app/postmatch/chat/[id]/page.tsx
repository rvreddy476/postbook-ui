'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getPostMatchSession } from '@/lib/postmatchApi'
import { checkPostMatchAuth, postmatchLoginRedirect } from '@/lib/postmatchGuard'
import { usePostMatchMessages, useSendPostMatchMessage, usePostMatchConversations } from '@/hooks/usePostmatch'

export default function PostMatchChatPage() {
  const router = useRouter()
  const params = useParams()
  const conversationId = params.id as string
  const [session, setSession] = useState<ReturnType<typeof getPostMatchSession>>(null)

  const { data, isLoading } = usePostMatchMessages(conversationId)
  const { data: conversations } = usePostMatchConversations()
  const sendMessage = useSendPostMatchMessage(conversationId)

  const [text, setText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const convo = conversations?.find(c => c.id === conversationId)
  const otherName = convo?.other_user?.first_name ?? 'Chat'

  useEffect(() => {
    const state = checkPostMatchAuth()
    if (state === 'unauthenticated') { router.replace(postmatchLoginRedirect(`/postmatch/chat/${conversationId}`)); return }
    if (state === 'needs_onboarding') { router.replace('/postmatch/onboarding'); return }
    setSession(getPostMatchSession())
  }, [router, conversationId])

  const messages = data?.messages ?? []

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const handleSend = async () => {
    if (!text.trim()) return
    const body = text.trim()
    setText('')
    try {
      await sendMessage.mutateAsync({ message_type: 'text', body_text: body })
    } catch {
      setText(body)
    }
  }

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a]">
      {/* Header */}
      <header className="bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-[#1a1a1a] px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button onClick={() => router.push('/postmatch/matches')} className="text-[#666] hover:text-white transition">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-500 to-orange-500 p-[2px] flex-shrink-0">
          <div className="w-full h-full rounded-full bg-[#1a1a1a] flex items-center justify-center text-[#666] font-black text-sm">
            {otherName[0]}
          </div>
        </div>
        <div className="flex-1">
          <h2 className="font-bold text-white text-sm">{otherName}</h2>
          <p className="text-[10px] text-[#555] font-bold uppercase tracking-widest">Matched</p>
        </div>
        <Link href={`/postmatch/matches`} className="text-[10px] font-black text-[#555] uppercase tracking-widest hover:text-rose-500 transition">
          Info
        </Link>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center mb-4">
              <span className="text-3xl">💬</span>
            </div>
            <h3 className="font-bold text-white mb-1">Start the conversation</h3>
            <p className="text-[#666] text-sm max-w-xs">Say hello to {otherName}! First impressions matter.</p>
          </div>
        ) : (
          <>
            {messages.map(msg => {
              const isMine = msg.sender_user_id === session?.id
              return (
                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                    isMine
                      ? 'bg-gradient-to-r from-rose-600 to-orange-500 text-white rounded-br-md'
                      : 'bg-[#111] border border-[#222] text-white rounded-bl-md'
                  }`}>
                    <p className="leading-relaxed">{msg.body_text}</p>
                    <p className={`text-[9px] mt-1 ${isMine ? 'text-white/50' : 'text-[#555]'} text-right font-bold`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="bg-[#0a0a0a] border-t border-[#1a1a1a] px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-2 max-w-lg mx-auto">
          <input
            className="flex-1 border border-[#333] rounded-full px-4 py-2.5 text-sm text-white bg-[#1a1a1a] focus:bg-[#111] focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition placeholder:text-[#555]"
            placeholder="Type a message..."
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sendMessage.isPending}
            className="w-10 h-10 rounded-full bg-gradient-to-r from-rose-600 to-orange-500 flex items-center justify-center text-white disabled:opacity-30 hover:shadow-lg hover:shadow-rose-500/20 active:scale-90 transition flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-7 7m7-7l7 7" /></svg>
          </button>
        </div>
      </div>
    </div>
  )
}
