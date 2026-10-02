"use client"

/* /dating/people/[userId] — the full profile: gallery, bio, prompts, interests, basics, languages, distance bucket, verified marker, report and block. */

import { useRouter } from "next/navigation"
import { useState } from "react"
import { BadgeCheck, ChevronLeft, ChevronRight, UserX } from "lucide-react"

import { DatingPhoto } from "../components/DatingPhoto"
import { PromptClipPlayer } from "../components/PromptClips"
import { ErrorState, Guard } from "../components/Guard"
import { LinkButton, Loading, PageHead, Panel, Pill, StatePanel, TravelPill } from "../components/kit"
import { SafetyActions } from "../components/SafetyActions"
import { usePerson } from "../hooks/discovery"
import { useProfileOptions } from "../hooks/profile"
import { languageLabel } from "../model/labels"
import { basicsLabels, interestLabels, languageLabels, type ProfileOptions } from "../model/options"
import { metaLine, nameLine, type Person } from "../model/people"
import { DATING_BASE } from "../model/profile"
import { errorStatus } from "../model/wire"

export function Gallery({ person }: { person: Person }) {
  const [index, setIndex] = useState(0)
  const photos = person.photos
  if (photos.length === 0) return <DatingPhoto path="" alt="No photo" className="pulse-gallery__photo" />
  const i = Math.min(index, photos.length - 1)
  return (
    <div className="pulse-gallery" role="group" aria-roledescription="photo gallery" aria-label={`Photos of ${person.firstName || "this person"}`}>
      <DatingPhoto path={photos[i].url} alt={`Photo ${i + 1} of ${photos.length}`} className="pulse-gallery__photo" />
      {photos.length > 1 ? (
        <div className="pulse-gallery__nav">
          <button type="button" className="pulse-act pulse-act--small" onClick={() => setIndex(Math.max(i - 1, 0))} disabled={i === 0} aria-label="Previous photo">
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <span className="pulse-gallery__count" aria-live="polite">
            {i + 1} / {photos.length}
          </span>
          <button type="button" className="pulse-act pulse-act--small" onClick={() => setIndex(Math.min(i + 1, photos.length - 1))} disabled={i === photos.length - 1} aria-label="Next photo">
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  )
}

/** Everything about the person except the actions; what the tests render. Without `options`, interests and basics aren't drawn. */
export function PersonDetails({ person, options = null }: { person: Person; options?: ProfileOptions | null }) {
  const facts = metaLine(person)
  const interests = interestLabels(person.basics, options)
  const basics = basicsLabels(person.basics, options)
  // With the options list the codes get their labels; without it, the old capitalised words.
  const languages = options ? languageLabels(person.languageCodes, options, languageLabel) : [...person.languages].sort()
  return (
    <>
      <div className="pulse-person__head">
        <h1 className="pulse-head__title">{nameLine(person)}</h1>
        {person.verified ? (
          <Pill tone="success">
            <BadgeCheck size={12} aria-hidden="true" /> Verified
          </Pill>
        ) : null}
        <TravelPill person={person} />
      </div>
      {facts.length ? (
        <ul className="pulse-facts">
          {facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      ) : null}
      {person.bio ? (
        <Panel title="About">
          <p className="pulse-text">{person.bio}</p>
        </Panel>
      ) : null}
      {person.prompts.length ? (
        <Panel title="In their words">
          <dl className="pulse-prompts">
            {person.prompts.map((p) => (
              <div key={p.promptId}>
                <dt>{p.question}</dt>
                {p.answer ? <dd>{p.answer}</dd> : null}
                {p.clip ? (
                  <dd>
                    <PromptClipPlayer clip={p.clip} />
                  </dd>
                ) : null}
              </div>
            ))}
          </dl>
        </Panel>
      ) : null}
      {interests.length ? (
        <Panel title="Interests">
          <ChipList labels={interests} />
        </Panel>
      ) : null}
      {basics.length ? (
        <Panel title="Basics">
          <ChipList labels={basics} />
        </Panel>
      ) : null}
      {languages.length ? (
        <Panel title="Languages">
          <ChipList labels={languages} />
        </Panel>
      ) : null}
    </>
  )
}

function ChipList({ labels }: { labels: string[] }) {
  return (
    <ul className="pulse-chips">
      {labels.map((l) => (
        <li key={l}>
          <Pill>{l}</Pill>
        </li>
      ))}
    </ul>
  )
}

function PersonBody({ userId }: { userId: string }) {
  const router = useRouter()
  const person = usePerson(userId)
  // Labels for interests and basics; a failed read just leaves them out.
  const options = useProfileOptions()
  if (person.isPending) return <Loading />
  if (person.isError && errorStatus(person.error) !== 404) return <ErrorState error={person.error} onRetry={() => void person.refetch()} />
  if (person.isError || !person.data) {
    return (
      <StatePanel icon={UserX} title="This person isn't available" body="They may have left Pulse, or they're no longer in your deck.">
        <LinkButton href={DATING_BASE} variant="primary">
          Back to the deck
        </LinkButton>
      </StatePanel>
    )
  }
  const p = person.data
  return (
    <>
      <Gallery person={p} />
      <PersonDetails person={p} options={options.data ?? null} />
      <Panel title="Safety" sub="Reports are confidential.">
        <SafetyActions userId={p.userId} name={p.firstName || "this person"} onGone={() => router.replace(DATING_BASE)} />
      </Panel>
    </>
  )
}

export function PersonScreen({ userId }: { userId: string }) {
  return (
    <Guard need="ready">
      <div className="pulse-page pulse-page--narrow">
        <PageHead title="Profile" back={{ href: DATING_BASE, label: "Deck" }} />
        <PersonBody userId={userId} />
      </div>
    </Guard>
  )
}
