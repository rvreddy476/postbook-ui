"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { Compass, Home, MessageCircle, Moon, PanelLeftClose, Sun, X } from "lucide-react"
import { HeaderBar } from "@/features/reels/components/HeaderBar"
import { VideoShell, type VideoNavigationProps } from "./VideoShell"
import { useVideoShell } from "./useVideoShell"
import { applyTheme, chooseTheme, readThemeChoice, resolveTheme, type ThemeChoice } from "./themeChoice"
import { workspaceLinkCurrent, type WorkspaceLink } from "./workspaceNavigation"
import { resolveAppBrand } from "@/lib/appBrand"
import "./workspace.css"

export function WorkspaceNavigation({ links, title, ...props }: VideoNavigationProps & { links: readonly WorkspaceLink[]; title: string }) {
  const pathname = usePathname() || "/"
  const shell = useVideoShell()
  const navRef = useRef<HTMLElement>(null)
  const [appearance, setAppearance] = useState<ThemeChoice>("auto")
  useEffect(() => {
    let choice: ThemeChoice = "auto"
    try { choice = readThemeChoice(window.localStorage) } catch { /* Private browsers still support an in-session theme. */ }
    setAppearance(choice)
    applyTheme(document.documentElement,resolveTheme(choice,window.matchMedia("(prefers-color-scheme: dark)").matches))
  }, [])
  useEffect(() => {
    if (appearance !== "auto") return
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const sync = () => applyTheme(document.documentElement, resolveTheme("auto", media.matches))
    media.addEventListener("change", sync)
    return () => media.removeEventListener("change", sync)
  }, [appearance])
  const setTheme = (choice: ThemeChoice) => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    try { chooseTheme(choice, { storage: window.localStorage, root: document.documentElement, prefersDark }) }
    catch { applyTheme(document.documentElement,resolveTheme(choice,prefersDark)) }
    setAppearance(choice)
  }
  useEffect(() => {
    if (!props.drawer) return
    const previous = document.activeElement as HTMLElement | null
    const node = navRef.current
    const outside = Array.from(node?.closest(".video-shell")?.querySelectorAll<HTMLElement>(".context-app-bar,.video-shell__main") ?? []).map(element => ({element,inert:element.inert}))
    outside.forEach(({element}) => {element.inert = true})
    node?.querySelector<HTMLButtonElement>("button")?.focus()
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return
      const targets = node?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled)')
      if (!targets?.length) return
      const first = targets[0], last = targets[targets.length-1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener("keydown",trap)
    return () => { document.removeEventListener("keydown",trap); outside.forEach(({element,inert}) => {element.inert = inert}); previous?.focus() }
  }, [props.drawer])
  return <nav ref={navRef} id={props.id} className={`video-nav workspace-nav${props.expanded ? " is-expanded" : " is-rail"}`} aria-label={`${title} navigation`} role={props.drawer ? "dialog" : undefined} aria-modal={props.drawer || undefined}>
    <div className="workspace-nav__head">
      {props.expanded ? <span>{title}</span> : null}
      <button type="button" className="video-nav__toggle" onClick={props.drawer ? props.onNavigate : shell.toggleSidebar} aria-label={props.drawer ? "Close menu" : props.expanded ? "Collapse menu" : "Expand menu"}>{props.drawer ? <X size={20}/> : <PanelLeftClose size={20}/>}</button>
    </div>
    <div className="video-nav__scroll">
      <ul className="video-nav__list">
        {links.map(({href,label,icon:Icon,count}) => { const current = workspaceLinkCurrent(pathname,href,links); return <li key={href}><Link href={href} onClick={props.onNavigate} title={!props.expanded ? label : undefined} className={`video-nav__item${current ? " is-current" : ""}`} aria-current={current ? "page" : undefined} aria-label={count ? `${label}, ${count} items` : label}><Icon className="video-nav__icon" size={20} strokeWidth={1.75} aria-hidden/><span className="video-nav__label">{label}</span>{props.expanded && count ? <span className="workspace-nav__count">{count > 99 ? "99+" : count}</span> : null}</Link></li> })}
      </ul>
      <ul className="video-nav__list workspace-nav__shared">
        <li><Link href="/messenger" className="video-nav__item" onClick={props.onNavigate} aria-label="Messenger"><MessageCircle className="video-nav__icon" size={20}/><span className="video-nav__label">Messenger</span></Link></li>
        <li><button type="button" className="video-nav__item" onClick={() => { props.onNavigate?.(); shell.openExplore() }} aria-haspopup="dialog" aria-label="Explore apps"><Compass className="video-nav__icon" size={20}/><span className="video-nav__label">Explore apps</span></button></li>
        <li><Link href="/" className="video-nav__item" onClick={props.onNavigate} aria-label="Home"><Home className="video-nav__icon" size={20}/><span className="video-nav__label">Home</span></Link></li>
      </ul>
    </div>
    <div className="workspace-nav__appearance" aria-label="Appearance">
      <button type="button" aria-label="Light appearance" aria-pressed={appearance === "light"} onClick={() => setTheme("light")}><Sun size={18}/></button>
      <button type="button" aria-label="Dark appearance" aria-pressed={appearance === "dark"} onClick={() => setTheme("dark")}><Moon size={18}/></button>
      <button type="button" onClick={() => setTheme("auto")} aria-pressed={appearance === "auto"} aria-label="Automatic appearance">Auto</button>
    </div>
  </nav>
}

export function WorkspaceShell({ children, links, title, kind }: { children: ReactNode; links: readonly WorkspaceLink[]; title: string; kind: "dating" | "feast" | "kitchen" | "admin" | "mopedu" }) {
  const route = {dating:"/dating",feast:"/feast",kitchen:"/feast/kitchen",admin:"/admin",mopedu:"/admin/mopedu"}[kind]
  return <div className="service-workspace" data-workspace={kind}>
    <a className="workspace-skip" href="#workspace-content">Skip to content</a>
    <VideoShell app="workspace" header={<HeaderBar hideSearch hideCreate brand={resolveAppBrand(route)} />} navigation={props => <WorkspaceNavigation {...props} links={links} title={title} />}>
      <div id="workspace-content" tabIndex={-1} className="workspace-content">{children}</div>
    </VideoShell>
  </div>
}
