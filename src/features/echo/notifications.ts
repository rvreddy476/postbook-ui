/*
  Echo's two notifications (echo-contract.md, notification-service):

    note_reply   "{actor} replied to your note"
    note_quote   "{actor} quoted your note"

  Both open the note at /echo/note/{note_id}. The row's deep link is the
  app's momentum://echo/note/{id}, which lib/notificationInbox turns into
  the web path; only a link that is exactly an Echo note path is kept, so a
  row can never send the viewer anywhere else. The server's sentence wins
  when it sent one; otherwise the actor's name fills the contract's copy.
*/

export const ECHO_NOTIFICATION_TYPES = ["note_reply", "note_quote"] as const

const NOTE_LINK = /^\/echo\/note\/([0-9A-Za-z-]{1,64})\/?$/

/** The note an Echo link points at, or null when the link is not an Echo note path. */
export function echoNoteIdFromLink(link: string | undefined | null): string | null {
  if (!link) return null
  const m = NOTE_LINK.exec(link.split(/[?#]/)[0])
  return m ? m[1] : null
}

/** `/echo/note/{id}` for a link that names one; undefined otherwise. */
export function echoNotificationHref(type: string, link: string | undefined): string | undefined {
  if (!(ECHO_NOTIFICATION_TYPES as readonly string[]).includes(type)) return undefined
  const id = echoNoteIdFromLink(link)
  return id ? `/echo/note/${id}` : undefined
}

export function echoNotificationCopy(
  type: string,
  actorName: string | undefined,
  serverTitle: string | undefined,
  link: string | undefined,
): { title: string; body: string; link: string | undefined } | null {
  const who = actorName?.trim() || "Someone"
  if (type === "note_reply") {
    return { title: serverTitle ?? `${who} replied to your note`, body: "Open the note to see the reply.", link: echoNotificationHref(type, link) }
  }
  if (type === "note_quote") {
    return { title: serverTitle ?? `${who} quoted your note`, body: "Open the note to see the quote.", link: echoNotificationHref(type, link) }
  }
  return null
}
