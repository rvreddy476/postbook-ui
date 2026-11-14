import Link from "next/link"

import { echoProfilePath, hashtagPath, textSegments } from "../model"

/*
  Look v3: a note's words are set in Momentum's serif (font-echo-serif),
  larger than body text, at ~1.4 leading: 18 on the timeline (16 for a long
  note), 22 on the note page, 16 inside a quoted card. "body" is the plain
  UI face, for a profile bio.
*/
export type NoteTextSize = "body" | "timeline" | "long" | "lead" | "quote"

const SIZE: Record<NoteTextSize, string> = {
  body: "text-base",
  timeline: "font-echo-serif text-lg leading-echo",
  long: "font-echo-serif text-base leading-echo",
  lead: "font-echo-serif text-echo-lead leading-echo",
  quote: "font-echo-serif text-base leading-echo",
}

/** A note's words, with @mentions to the profile, #hashtags to the tag page, and links opened safely. */
export function NoteText({ text, className = "", size = "body" }: { text: string; className?: string; size?: NoteTextSize }) {
  if (!text) return null
  return (
    <p className={`whitespace-pre-wrap break-words text-brand-text ${SIZE[size]} ${className}`} data-echo-text={size}>
      {textSegments(text).map((seg, i) => {
        switch (seg.kind) {
          case "mention":
            return (
              <Link key={i} href={echoProfilePath(seg.username)} className="text-echo-accent hover:underline" onClick={(e) => e.stopPropagation()}>
                {seg.text}
              </Link>
            )
          case "hashtag":
            return (
              <Link key={i} href={hashtagPath(seg.tag)} className="text-echo-accent hover:underline" onClick={(e) => e.stopPropagation()}>
                {seg.text}
              </Link>
            )
          case "link":
            return (
              <a key={i} href={seg.href} target="_blank" rel="noopener noreferrer nofollow ugc" className="text-echo-accent underline-offset-2 hover:underline" onClick={(e) => e.stopPropagation()}>
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
