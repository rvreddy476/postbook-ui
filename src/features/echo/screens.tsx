"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ArrowLeft } from "lucide-react"

import SegmentedControl from "@/components/ui/SegmentedControl"
import { useAuthUser } from "@/store/auth"

import { PROFILE_NOTES_TABS, TIMELINES, type ProfileNotesTab, type Timeline } from "./api"
import { useConversation, useNote, useReplies, useTimeline, useUserNotes } from "./hooks"
import { ECHO_WORDS, echoErrorMessage, replyPolicyLabel } from "./model"
import { EchoActionsProvider, useEchoActions } from "./components/EchoActions"
import { EchoLayout } from "./components/EchoLayout"
import { InlineComposer } from "./components/InlineComposer"
import { NoteCard } from "./components/NoteCard"
import { NoteList } from "./components/NoteList"

/*
  The three Echo surfaces. Each is mounted only after the product gate
  (components/ProductRouteGate for /echo routes, useProductOpen("echo") for
  the profile tab) says Echo is open, so none of them calls an Echo route
  while the product is closed.
*/

function CompactHeader({ title, back = false }: { title: string; back?: boolean }) {
  const router = useRouter()
  const actions = useEchoActions()
  return (
    <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-brand-card/95 px-4 py-3 backdrop-blur">
      {back && (
        <button type="button" aria-label="Back" onClick={() => router.back()} className="rounded-full p-1.5 hover:bg-brand-secondary">
          <ArrowLeft className="h-5 w-5 text-brand-text" />
        </button>
      )}
      <h1 className="text-lg font-bold text-brand-text">{title}</h1>
      {!back && actions.viewerId && (
        <button type="button" onClick={actions.compose} className="ml-auto rounded-full bg-primary-ink px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover lg:hidden">
          Post
        </button>
      )}
    </div>
  )
}

function Timelines() {
  // Following is the default on first open (design §2).
  const [timeline, setTimeline] = useState<Timeline>("following")
  const query = useTimeline(timeline)
  return (
    <>
      <CompactHeader title="Echo" />
      <div className="border-b border-border px-4 py-3">
        <SegmentedControl
          aria-label="Timeline"
          layoutId="echo-timeline"
          fullWidth
          value={timeline}
          onChange={(id) => setTimeline(id as Timeline)}
          segments={TIMELINES.map((t) => ({ id: t.value, label: t.label }))}
        />
      </div>
      <InlineComposer />
      <NoteList
        query={query}
        empty={timeline === "following" ? "Notes from people you follow show up here." : "Nothing to show yet. Check back soon."}
      />
    </>
  )
}

/** /echo: the timelines, for a signed-in viewer (middleware keeps strangers out). */
export function EchoHomeScreen() {
  return (
    <EchoActionsProvider>
      <EchoLayout>
        <Timelines />
      </EchoLayout>
    </EchoActionsProvider>
  )
}

function NoteThread({ id }: { id: string }) {
  const user = useAuthUser()
  const note = useNote(id)
  const conversation = useConversation(id, note.isSuccess && !!note.data?.replyToId)
  const replies = useReplies(id, note.isSuccess)

  if (note.isLoading) {
    return (
      <p role="status" className="px-4 py-10 text-center text-sm text-muted-foreground">
        Loading…
      </p>
    )
  }
  if (note.isError || !note.data) {

    return (
      <div className="flex flex-col items-center gap-3 px-4 py-12 text-center" data-note-missing>
        <p className="text-base text-brand-text">{note.error ? echoErrorMessage(note.error) : ECHO_WORDS.noteNotFound}</p>
        <Link href={user ? "/echo" : "/"} className="text-sm font-medium text-primary-ink hover:underline">
          {user ? "Back to Echo" : "Go to Home"}
        </Link>
      </div>
    )
  }

  const n = note.data
  const above = (conversation.data ?? []).filter((c) => c.id !== n.id)
  return (
    <div>
      {above.length > 0 && (
        <ol aria-label="Earlier in the conversation">
          {above.map((c) => (
            <li key={c.id}>
              <NoteCard note={c} threadLine />
            </li>
          ))}
        </ol>
      )}
      <div className="border-b border-border">
        <NoteCard note={n} focused />
        {n.replyPolicy !== "everyone" && (
          <p className="px-4 pb-3 text-sm text-muted-foreground">Who can reply: {replyPolicyLabel(n.replyPolicy)}</p>
        )}
      </div>
      {user ? (
        n.viewerCanReply ? (
          <InlineComposer replyTo={n} />
        ) : (
          <p className="border-b border-border px-4 py-3 text-sm text-muted-foreground" data-reply-closed>
            {ECHO_WORDS.replyNotAllowed}
          </p>
        )
      ) : (
        <p className="border-b border-border px-4 py-3 text-sm text-muted-foreground">
          <Link href={`/login?redirect=${encodeURIComponent(`/echo/note/${id}`)}`} className="font-medium text-primary-ink hover:underline">
            Sign in
          </Link>{" "}
          to reply.
        </p>
      )}
      <NoteList query={replies} empty="No replies yet." />
    </div>
  )
}

/** /echo/note/<id>: the conversation above, the note, the reply box, the replies. Works signed out for a public note. */
export function NoteScreen({ id }: { id: string }) {
  const router = useRouter()
  return (
    <EchoActionsProvider
      onDeleted={(deleted) => {
        if (deleted.id === id) router.replace("/echo")
      }}
    >
      <EchoLayout>
        <CompactHeader title="Note" back />
        <NoteThread key={id} id={id} />
      </EchoLayout>
    </EchoActionsProvider>
  )
}

/** The Echo tab on a profile: Notes, Replies, Reposts (GET /v1/notes/users/:userId?tab=). */
export function ProfileEchoTab({ userId }: { userId: string }) {
  const [tab, setTab] = useState<ProfileNotesTab>("notes")
  const query = useUserNotes(userId, tab)
  return (
    <EchoActionsProvider>
      <div className="overflow-hidden rounded-2xl border border-border bg-brand-card" data-profile-echo>
        <div className="border-b border-border px-4 py-3">
          <SegmentedControl
            aria-label="Echo"
            layoutId="profile-echo-tab"
            fullWidth
            size="sm"
            value={tab}
            onChange={(id) => setTab(id as ProfileNotesTab)}
            segments={PROFILE_NOTES_TABS.map((t) => ({ id: t.value, label: t.label }))}
          />
        </div>
        <NoteList query={query} empty={tab === "notes" ? "No notes yet." : tab === "replies" ? "No replies yet." : "No reposts yet."} />
      </div>
    </EchoActionsProvider>
  )
}

