'use client'
import Link from 'next/link'
import { splitMentions } from './mentions'
import './comments.css'

/** A comment body with every `@username` linked to that profile. */
export default function MentionText({ body }: { body: string }) {
  const segments = splitMentions(body)
  return (
    <>
      {segments.map((segment, index) => segment.type === 'mention'
        ? <Link key={index} href={`/u/${segment.username}`} className="comment-mention-link" onClick={event => event.stopPropagation()}>@{segment.username}</Link>
        : <span key={index}>{segment.value}</span>)}
    </>
  )
}
