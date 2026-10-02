"use client"

/*
  Past matches (mechanic M19): on the safety page, the matches that ended
  recently, each with a way to report the other person. Presentational only;
  the screen reads the server and opens the report flow.
*/

import { Flag } from "lucide-react"

import { endedLine, NO_PAST_MATCHES, pastMatchName, type PastMatch } from "../model/pastMatches"
import { Button, Pill } from "./kit"

export function PastMatchList({ items, onReport }: { items: PastMatch[]; onReport: (m: PastMatch) => void }) {
  if (items.length === 0) return <p className="pulse-text pulse-text--muted">{NO_PAST_MATCHES}</p>
  return (
    <ul className="pulse-plain">
      {items.map((m) => {
        const name = pastMatchName(m)
        return (
          <li key={m.matchId} className="pulse-plain__block">
            <div className="pulse-plain__row">
              <span className="pulse-past">
                <span className="pulse-past__name">{name}</span>
                <span className="pulse-past__meta">{endedLine(m)}</span>
              </span>
              {m.reported ? (
                <Pill tone="success">Reported</Pill>
              ) : (
                <Button variant="quiet" icon={Flag} onClick={() => onReport(m)} aria-label={`Report ${name}`}>
                  Report
                </Button>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
