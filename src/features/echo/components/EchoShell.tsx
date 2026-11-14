"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createContext, useContext, useEffect, useState } from "react"
import {
  ArrowLeft,
  Bell,
  Bookmark,
  CalendarClock,
  CircleEllipsis,
  Crown,
  Ellipsis,
  Feather,
  Home,
  LogOut,
  MessageCircle,
  Search,
  Settings,
  Undo2,
  UserRound,
  X,
} from "lucide-react"

import Avatar from "@/components/ui/Avatar"
import { SuggestionFollowButton } from "@/components/PeopleYouMayKnowStrip"
import { useMyPremium, usePremiumAvailable } from "@/features/premium/hooks"
import { useFriendSuggestions } from "@/hooks/useConnections"
import { logoutUser } from "@/services/authService"
import { useAuthUser } from "@/store/auth"

import { useTrends } from "../hooks"
import { ECHO_MORE_ITEMS, ECHO_TAB_BAR_KEYS, activeNavKey, echoNavItems, trendCountLabel, type EchoNavKey } from "../v2"
import { hashtagPath } from "../model"
import { EchoActionsProvider } from "./EchoActions"
import { MenuButton } from "./Menu"
import { ViewTrackingProvider } from "./ViewTracking"
import { selfDisplayName } from "../look"

/*
  Echo is its own app on the web (echo-v2-contract.md §5), in the look v3
  "serif conversation cards" (echo-look-v3.md §4): no VChat header, no
  VChat rail. Three columns — the left menu (the Echo wordmark in the
  serif, Home … Profile, More, Write a note, the account chip), the centre
  column of cards on the page ground, and the right column (search,
  Premium, Talked about now, Who to follow). Below 1280px the left menu
  folds to icons; below 1024px the right column goes; at phone width the
  page is one column with a bottom tab bar and a drawer behind the avatar.
*/

const NAV_ICON: Record<EchoNavKey, typeof Home> = {
  home: Home,
  explore: Search,
  notifications: Bell,
  chat: MessageCircle,
  bookmarks: Bookmark,
  scheduled: CalendarClock,
  premium: Crown,
  profile: UserRound,
}

const MORE_ICON: Record<string, typeof Home> = { settings: Settings, vchat: Undo2 }

interface ShellValue {
  openDrawer: () => void
}

const ShellContext = createContext<ShellValue>({ openDrawer: () => {} })

export const useEchoShell = () => useContext(ShellContext)

function signOut() {
  logoutUser()
  try {
    localStorage.removeItem("postbook_unread_state")
  } catch {}
  window.location.assign("/api/auth/logout")
}

/** The wordmark: "Echo" in Momentum's serif. */
function EchoLogo({ className = "" }: { className?: string }) {
  return (
    <Link href="/echo" aria-label="Echo" className={`inline-flex items-center rounded-full px-3 py-2 font-echo-serif text-2xl font-semibold text-brand-text hover:text-echo-accent ${className}`}>
      Echo
    </Link>
  )
}

function useNavItems() {
  const user = useAuthUser()
  const premiumOpen = usePremiumAvailable(!!user)
  return echoNavItems(user?.username).filter((i) => i.key !== "premium" || premiumOpen)
}

const NAV_ROW = "flex items-center gap-4 rounded-full p-3 text-lg transition-colors xl:px-4 xl:py-2.5"

/** The Write a note pill: feather icon, ember fill. Opens the compose modal (/echo/compose). */
export function WriteNoteButton({ className = "", folded = false }: { className?: string; folded?: boolean }) {
  return (
    <Link
      href="/echo/compose"
      data-echo-post-button
      aria-label="Write a note"
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-echo-accent ${folded ? "h-12 w-12 xl:w-[90%]" : "px-5 py-2.5"} text-base font-semibold text-echo-on-accent shadow-sm transition-colors hover:bg-echo-accent-hover ${className}`}
    >
      <Feather className="h-5 w-5" aria-hidden />
      <span className={folded ? "hidden xl:inline" : ""}>Write a note</span>
    </Link>
  )
}

export function LeftNav() {
  const user = useAuthUser()
  const pathname = usePathname() || "/echo"
  const items = useNavItems()
  const active = activeNavKey(pathname, user?.username)
  const name = selfDisplayName(user)
  const router = useRouter()

  if (!user) {
    return (
      <nav aria-label="Echo" className="flex h-full flex-col items-center gap-2 py-2 xl:items-start">
        <EchoLogo />
      </nav>
    )
  }

  return (
    <nav aria-label="Echo" data-echo-left-nav className="flex h-full flex-col items-center py-2 xl:items-start">
      <EchoLogo />
      <ul className="mt-2 flex flex-col items-center gap-1 xl:w-full xl:items-stretch">
        {items.map((item) => {
          const Icon = NAV_ICON[item.key]
          const on = item.key === active
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={on ? "page" : undefined}
                data-nav={item.key}
                className={`${NAV_ROW} ${on ? "bg-echo-accent-tint font-semibold text-echo-accent" : "text-brand-text hover:bg-brand-secondary"}`}
              >
                <Icon className="h-6 w-6" strokeWidth={on ? 2.4 : 1.9} aria-hidden />
                <span className="hidden xl:inline">{item.label}</span>
              </Link>
            </li>
          )
        })}
        <li>
          <MenuButton
            label="More"
            align="left"
            items={ECHO_MORE_ITEMS.map((m) => {
              const Icon = MORE_ICON[m.key] ?? Settings
              return { key: m.key, label: m.label, icon: <Icon className="h-5 w-5" />, onSelect: () => router.push(m.href) }
            })}
            className={`${NAV_ROW} w-full text-brand-text hover:bg-brand-secondary`}
            panelClassName="bottom-full mb-2"
          >
            <CircleEllipsis className="h-6 w-6" strokeWidth={1.9} aria-hidden />
            <span className="hidden xl:inline">More</span>
          </MenuButton>
        </li>
      </ul>
      <WriteNoteButton folded className="mt-4" />
      <div className="mt-auto w-full pb-3">
        <MenuButton
          label="Account menu"
          align="left"
          items={[{ key: "logout", label: `Log out${user.username ? ` @${user.username}` : ""}`, icon: <LogOut className="h-5 w-5" />, onSelect: signOut }]}
          className="flex w-full items-center gap-3 rounded-full p-2 text-left hover:bg-brand-secondary"
          panelClassName="bottom-full mb-2"
        >
          <Avatar src={user.avatar || null} name={name || "?"} className="h-10 w-10" />
          <span className="hidden min-w-0 flex-1 leading-tight xl:block" data-echo-account-chip>
            <span className="block truncate text-sm font-semibold text-brand-text">{name}</span>
            {user.username && <span className="block truncate text-sm text-muted-foreground">@{user.username}</span>}
          </span>
          <Ellipsis className="hidden h-5 w-5 text-brand-text xl:block" aria-hidden />
        </MenuButton>
      </div>
    </nav>
  )
}

export function SearchBox({ initial = "", autoFocus = false }: { initial?: string; autoFocus?: boolean }) {
  const router = useRouter()
  const [q, setQ] = useState(initial)
  useEffect(() => setQ(initial), [initial])
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        const term = q.trim()
        if (term) router.push(`/echo/explore?q=${encodeURIComponent(term)}`)
      }}
      className="flex items-center gap-3 rounded-full border border-border bg-brand-card px-4 py-2.5 focus-within:border-echo-accent"
    >
      <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <input
        type="search"
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search Echo"
        aria-label="Search Echo"
        className="w-full min-w-0 bg-transparent text-base text-brand-text placeholder:text-muted-foreground focus:outline-none"
      />
    </form>
  )
}

function Box({ title, children, label }: { title: string; children: React.ReactNode; label: string }) {
  return (
    <section aria-label={label} className="overflow-hidden rounded-echo-card border border-border bg-brand-card">
      <h2 className="px-4 pb-1 pt-3.5 text-lg font-bold text-brand-text">{title}</h2>
      {children}
    </section>
  )
}

function SubscribeCard() {
  const user = useAuthUser()
  const available = usePremiumAvailable(!!user)
  const me = useMyPremium(!!user && available)
  // Hidden for members, while unknown, and when Premium is closed.
  if (!user || !available || !me.isSuccess || me.data.active || me.data.inGrace) return null
  return (
    <section aria-label="Subscribe to Premium" className="rounded-echo-card border border-border bg-brand-card p-4" data-echo-subscribe>
      <h2 className="text-lg font-bold text-brand-text">Subscribe to Premium</h2>
      <p className="mt-1 text-sm text-muted-foreground">Subscribe to unlock posting on Echo, threads and quotes.</p>
      <Link href="/premium" className="mt-3 inline-flex rounded-full bg-echo-accent px-4 py-2 text-sm font-semibold text-echo-on-accent hover:bg-echo-accent-hover">
        Subscribe
      </Link>
    </section>
  )
}

export function TrendRows({ limit }: { limit: number }) {
  const trends = useTrends(Math.max(limit, 10))
  if (trends.isLoading) return <p className="px-4 py-3 text-sm text-muted-foreground">Loading…</p>
  if (trends.isError || !trends.data || trends.data.length === 0) return <p className="px-4 py-3 text-sm text-muted-foreground">Nothing is being talked about right now.</p>
  return (
    <ol>
      {trends.data.slice(0, limit).map((t) => (
        <li key={t.tag}>
          <Link href={hashtagPath(t.tag)} className="block px-4 py-2.5 hover:bg-brand-secondary" data-trend={t.tag}>
            <span className="block text-xs text-muted-foreground">{t.rank} · Talked about</span>
            <span className="block text-base font-semibold text-echo-accent">#{t.tag}</span>
            {t.noteCount > 0 && <span className="block text-xs text-muted-foreground">{trendCountLabel(t.noteCount)}</span>}
          </Link>
        </li>
      ))}
    </ol>
  )
}

function Trends() {
  const trends = useTrends(10)
  if (trends.isError || (trends.isSuccess && trends.data.length === 0)) return null
  return (
    <Box title="Talked about now" label="Trends">
      <TrendRows limit={5} />
      <Link href="/echo/explore" className="block px-4 py-3 text-sm font-semibold text-echo-accent hover:bg-brand-secondary">
        Show more
      </Link>
    </Box>
  )
}

function WhoToFollow() {
  const user = useAuthUser()
  const { data } = useFriendSuggestions(user?.id, 3)
  const people = (data ?? []).slice(0, 3)
  if (!user || people.length === 0) return null
  return (
    <Box title="Who to follow" label="Who to follow">
      <ul>
        {people.map((p) => {
          const name = p.display_name || p.username || "Someone"
          return (
            <li key={p.user_id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-brand-secondary">
              <Link href={p.username ? `/echo/${encodeURIComponent(p.username)}` : `/u/${encodeURIComponent(p.user_id)}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar src={p.avatar_media_id ? `/v1/media/${p.avatar_media_id}/serve/avatar` : null} name={name} className="h-9 w-9" />
                <span className="min-w-0 leading-tight">
                  <span className="block truncate text-sm font-semibold text-brand-text">{name}</span>
                  {p.username && <span className="block truncate text-sm text-muted-foreground">@{p.username}</span>}
                </span>
              </Link>
              <SuggestionFollowButton userId={p.user_id} name={name} following={false} variant="row" />
            </li>
          )
        })}
      </ul>
    </Box>
  )
}

function SignedOutCard() {
  const pathname = usePathname() || "/echo"
  return (
    <section aria-label="New to Echo?" className="rounded-echo-card border border-border bg-brand-card p-4">
      <h2 className="font-echo-serif text-xl text-brand-text">New to Echo?</h2>
      <p className="mt-1 text-sm text-muted-foreground">Sign in to follow people, reply and see your timeline.</p>
      <Link href={`/login?redirect=${encodeURIComponent(pathname)}`} className="mt-3 flex justify-center rounded-full bg-echo-accent px-4 py-2 text-sm font-semibold text-echo-on-accent hover:bg-echo-accent-hover">
        Sign in
      </Link>
      <Link href="/register" className="mt-2 flex justify-center rounded-full border border-border px-4 py-2 text-sm font-semibold text-brand-text hover:bg-brand-secondary">
        Create account
      </Link>
    </section>
  )
}

export function RightColumn() {
  const user = useAuthUser()
  const pathname = usePathname() || ""
  const onExplore = pathname.startsWith("/echo/explore")
  return (
    <div className="flex flex-col gap-3 pb-16" data-echo-right-column>
      {!onExplore && (
        <div className="sticky top-0 z-10 bg-canvas py-2">
          <SearchBox />
        </div>
      )}
      {user ? <SubscribeCard /> : <SignedOutCard />}
      {!onExplore && <Trends />}
      <WhoToFollow />
      <p className="px-4 text-xs text-muted-foreground">
        <Link href="/terms" className="hover:underline">
          Terms
        </Link>{" "}
        ·{" "}
        <Link href="/privacy" className="hover:underline">
          Privacy
        </Link>
      </p>
    </div>
  )
}

function BottomTabBar() {
  const user = useAuthUser()
  const pathname = usePathname() || "/echo"
  const items = useNavItems().filter((i) => ECHO_TAB_BAR_KEYS.includes(i.key))
  const active = activeNavKey(pathname, user?.username)
  if (!user) return null
  return (
    <nav aria-label="Echo tabs" data-echo-tab-bar className="fixed inset-x-0 bottom-0 z-30 flex h-14 items-center justify-around border-t border-border bg-brand-card sm:hidden">
      {items.map((item) => {
        const Icon = NAV_ICON[item.key]
        const on = item.key === active
        return (
          <Link key={item.key} href={item.href} aria-label={item.label} aria-current={on ? "page" : undefined} className={`flex flex-1 justify-center p-3 ${on ? "text-echo-accent" : "text-brand-text"}`}>
            <Icon className="h-6 w-6" strokeWidth={on ? 2.4 : 1.9} aria-hidden />
          </Link>
        )
      })}
    </nav>
  )
}

function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useAuthUser()
  const items = useNavItems().filter((i) => !ECHO_TAB_BAR_KEYS.includes(i.key))
  const pathname = usePathname()
  useEffect(() => {
    onClose()
    // Close whenever the page changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])
  if (!open || !user) return null
  const name = selfDisplayName(user)
  const row = "flex items-center gap-4 px-4 py-3 text-lg font-semibold text-brand-text hover:bg-brand-secondary"
  return (
    <div className="fixed inset-0 z-50 sm:hidden" role="dialog" aria-label="Account menu">
      <button type="button" aria-label="Close menu" onClick={onClose} className="absolute inset-0 bg-brand-text/40" />
      <div className="absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col overflow-y-auto bg-brand-card shadow-xl">
        <div className="flex items-start justify-between p-4">
          <div className="min-w-0">
            <Avatar src={user.avatar || null} name={name || "?"} className="h-10 w-10" />
            <p className="mt-2 truncate text-lg font-semibold text-brand-text">{name}</p>
            {user.username && <p className="truncate text-sm text-muted-foreground">@{user.username}</p>}
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-full p-2 hover:bg-brand-secondary">
            <X className="h-5 w-5 text-brand-text" />
          </button>
        </div>
        <div className="px-4 pb-2">
          <WriteNoteButton className="w-full" />
        </div>
        {items.map((item) => {
          const Icon = NAV_ICON[item.key]
          return (
            <Link key={item.key} href={item.href} className={row}>
              <Icon className="h-6 w-6" aria-hidden /> {item.label}
            </Link>
          )
        })}
        <div className="my-1 border-t border-border" />
        {ECHO_MORE_ITEMS.map((m) => {
          const Icon = MORE_ICON[m.key] ?? Settings
          return (
            <Link key={m.key} href={m.href} className="flex items-center gap-4 px-4 py-3 text-base font-semibold text-brand-text hover:bg-brand-secondary">
              <Icon className="h-5 w-5" aria-hidden /> {m.label}
            </Link>
          )
        })}
        <button type="button" onClick={signOut} className="flex items-center gap-4 px-4 py-3 text-left text-base font-semibold text-brand-text hover:bg-brand-secondary">
          <LogOut className="h-5 w-5" aria-hidden /> Log out
        </button>
      </div>
    </div>
  )
}

/** The sticky title bar of a centre-column page: back arrow (or, on a phone, the avatar), title, subtitle, then tabs. */
export function PageHeader({ title, subtitle, back = false, children, right }: { title?: string; subtitle?: string; back?: boolean; children?: React.ReactNode; right?: React.ReactNode }) {
  const router = useRouter()
  const user = useAuthUser()
  const shell = useEchoShell()
  return (
    <div className="sticky top-0 z-20 bg-canvas/90 backdrop-blur-md" data-echo-page-header>
      {(title || back) && (
        <div className="flex min-h-[53px] items-center gap-4 px-4">
          {back ? (
            <button
              type="button"
              aria-label="Back"
              onClick={() => (window.history.length > 1 ? router.back() : router.push("/echo"))}
              className="-ml-2 rounded-full border border-border bg-brand-card p-2 hover:bg-brand-secondary"
            >
              <ArrowLeft className="h-5 w-5 text-brand-text" />
            </button>
          ) : (
            user && (
              <button type="button" aria-label="Open menu" onClick={shell.openDrawer} className="sm:hidden">
                <Avatar src={user.avatar || null} name={selfDisplayName(user) || "?"} className="h-8 w-8" />
              </button>
            )
          )}
          <div className="min-w-0 flex-1 leading-tight">
            {title && <h1 className="truncate text-xl font-bold text-brand-text">{title}</h1>}
            {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
    </div>
  )
}

/** Pill tabs; the selected one takes the ember tint. Links when `href` is given, buttons otherwise. */
export function Tabs<K extends string>({ tabs, active, onSelect, label }: { tabs: readonly { key: K; label: string; href?: string }[]; active: K; onSelect?: (k: K) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-2 overflow-x-auto px-3 py-2" data-echo-tabs>
      {tabs.map((t) => {
        const on = t.key === active
        const cls = `inline-flex shrink-0 items-center rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
          on ? "border-echo-accent/50 bg-echo-accent-tint text-echo-accent" : "border-border bg-brand-card text-muted-foreground hover:text-brand-text"
        }`
        return t.href ? (
          <Link key={t.key} href={t.href} role="tab" aria-selected={on} data-tab={t.key} className={cls} replace>
            {t.label}
          </Link>
        ) : (
          <button key={t.key} type="button" role="tab" aria-selected={on} data-tab={t.key} onClick={() => onSelect?.(t.key)} className={cls}>
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

/** The whole Echo app frame. `modal` is the @modal slot (the compose modal). */
export function EchoShell({ children, modal }: { children: React.ReactNode; modal?: React.ReactNode }) {
  const user = useAuthUser()
  const [drawer, setDrawer] = useState(false)
  return (
    <ShellContext.Provider value={{ openDrawer: () => setDrawer(true) }}>
      <ViewTrackingProvider enabled={!!user}>
        <EchoActionsProvider>
          <div data-echo-shell className="min-h-screen overflow-x-hidden bg-canvas font-sans text-brand-text">
            <div className="mx-auto flex w-full max-w-[1265px] justify-center">
              <header className="sticky top-0 hidden h-screen w-[88px] shrink-0 px-2 sm:block xl:w-[260px]">
                <LeftNav />
              </header>
              <main className="min-h-screen w-full min-w-0 max-w-[620px] pb-20 sm:pb-0">{children}</main>
              <aside className="hidden w-[340px] shrink-0 pl-6 pr-2 lg:block">
                <RightColumn />
              </aside>
            </div>
            <BottomTabBar />
            <Drawer open={drawer} onClose={() => setDrawer(false)} />
            {modal}
          </div>
        </EchoActionsProvider>
      </ViewTrackingProvider>
    </ShellContext.Provider>
  )
}
