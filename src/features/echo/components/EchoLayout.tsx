"use client"

import Link from "next/link"
import { AtSign, Feather, UserRound } from "lucide-react"

import Avatar from "@/components/ui/Avatar"
import { SuggestionFollowButton } from "@/components/PeopleYouMayKnowStrip"
import { useFriendSuggestions } from "@/hooks/useConnections"
import { useAuthUser } from "@/store/auth"

import { useEchoActions } from "./EchoActions"

/*
  Echo on a big screen (founder: not a ported phone screen): a centre
  column with side panels. Left: Echo's own navigation and the Post
  button. Right: who to follow, from the real suggestions route
  (GET /v1/suggestions/people). Both panels fold away on narrower screens;
  the centre column then holds a compact header with the same Post button.
*/

function LeftPanel() {
  const actions = useEchoActions()
  const user = useAuthUser()
  const me = user?.username || user?.id
  const link = "flex items-center gap-3 rounded-full px-4 py-2.5 text-base font-medium text-brand-text hover:bg-brand-secondary"
  return (
    <nav aria-label="Echo" className="sticky top-4 flex flex-col gap-1">
      <Link href="/echo" className="mb-2 flex items-center gap-2 px-4 text-xl font-bold text-brand-text">
        <AtSign className="h-6 w-6 text-primary-ink" aria-hidden /> Echo
      </Link>
      <Link href="/echo" className={link}>
        <Feather className="h-5 w-5" aria-hidden /> Timeline
      </Link>
      {me && (
        <Link href={`/u/${encodeURIComponent(me)}?tab=echo`} className={link}>
          <UserRound className="h-5 w-5" aria-hidden /> Your notes
        </Link>
      )}
      <button type="button" onClick={actions.compose} className="mt-4 rounded-full bg-primary-ink px-6 py-3 text-base font-semibold text-primary-foreground hover:bg-primary-hover">
        Post
      </button>
    </nav>
  )
}

function WhoToFollow() {
  const user = useAuthUser()
  const { data } = useFriendSuggestions(user?.id, 5)
  const people = (data ?? []).slice(0, 5)
  if (people.length === 0) return null
  return (
    <section aria-labelledby="echo-who-to-follow" className="sticky top-4 rounded-2xl border border-border bg-brand-card p-4">
      <h2 id="echo-who-to-follow" className="mb-3 text-lg font-bold text-brand-text">
        Who to follow
      </h2>
      <ul className="flex flex-col gap-3">
        {people.map((p) => {
          const name = p.display_name || p.username || "Someone"
          return (
            <li key={p.user_id} className="flex items-center gap-3">
              <Link href={`/u/${encodeURIComponent(p.username || p.user_id)}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar src={p.avatar_media_id ? `/v1/media/${p.avatar_media_id}/serve/avatar` : null} name={name} className="h-10 w-10" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-brand-text">{name}</span>
                  {p.username && <span className="block truncate text-sm text-muted-foreground">@{p.username}</span>}
                </span>
              </Link>
              <SuggestionFollowButton userId={p.user_id} name={name} following={false} variant="row" />
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function EchoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 px-0 pb-16 sm:px-4 lg:grid-cols-[13rem_minmax(0,1fr)] xl:grid-cols-[13rem_minmax(0,40rem)_20rem]">
      <aside className="hidden lg:block">
        <LeftPanel />
      </aside>
      <main className="min-w-0 border-border sm:rounded-2xl sm:border bg-brand-card">{children}</main>
      <aside className="hidden xl:block">
        <WhoToFollow />
      </aside>
    </div>
  )
}
