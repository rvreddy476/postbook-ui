import { redirect } from "next/navigation"

type Props = { params: Promise<{ noteId: string }> }

/*
  /echo/note/<id> — the phase-1 permalink (shared links, note_reply and
  note_quote notifications, the app's momentum://echo/note/{id}). It now
  redirects to the X-style status page; "i" stands for the handle, which
  the status page replaces with the author's once the note has loaded.
*/
export default async function LegacyNotePage({ params }: Props) {
  const { noteId } = await params
  redirect(`/echo/i/status/${encodeURIComponent(noteId)}`)
}
