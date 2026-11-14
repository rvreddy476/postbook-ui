import Link from "next/link"

import { echoProfilePath, hashtagPath, textSegments } from "../model"

/** A note's words, with @mentions to the profile, #hashtags to the tag page, and links opened safely. */
export function NoteText({ text, className = "" }: { text: string; className?: string }) {
  if (!text) return null
  return (
    <p className={`whitespace-pre-wrap break-words text-base text-brand-text ${className}`}>
      {textSegments(text).map((seg, i) => {
        switch (seg.kind) {
          case "mention":
            return (
              <Link key={i} href={echoProfilePath(seg.username)} className="text-primary-ink hover:underline" onClick={(e) => e.stopPropagation()}>
                {seg.text}
              </Link>
            )
          case "hashtag":
            return (
              <Link key={i} href={hashtagPath(seg.tag)} className="text-primary-ink hover:underline" onClick={(e) => e.stopPropagation()}>
                {seg.text}
              </Link>
            )
          case "link":
            return (
              <a key={i} href={seg.href} target="_blank" rel="noopener noreferrer nofollow ugc" className="text-primary-ink underline-offset-2 hover:underline" onClick={(e) => e.stopPropagation()}>
                {seg.text}
              </a>
            )
          default:
            return <span key={i}>{seg.text}</span>
        }
      })}
    </p>
  )
}
