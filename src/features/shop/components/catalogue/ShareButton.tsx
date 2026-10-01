"use client"

import { useEffect, useId, useRef, useState } from "react"
import { Link2, MessageCircle, Share2 } from "lucide-react"
import { useGlobalToast } from "@/contexts/ToastContext"
import { recordShare } from "../../api/share"
import {
  canShareNatively,
  isShareCancelled,
  sharePayload,
  SHARE_TARGETS,
  whatsappHref,
  type ShareNavigator,
  type SharePayload,
} from "../../model/share"

const ICONS = { copy_link: Link2, whatsapp: MessageCircle } as const

/**
 * The share icon. Where the browser has a share sheet it opens that;
 * otherwise a small menu: Copy link, WhatsApp (alphabetical). Every share
 * made is recorded, fire and forget; closing the sheet is not a share.
 */
export function ShareButton({ productId, title, priceMinor }: { productId: string; title: string; priceMinor: number | null }) {
  const toast = useGlobalToast()
  const [open, setOpen] = useState(false)
  const [payload, setPayload] = useState<SharePayload | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const share = async () => {
    const data = sharePayload({ origin: window.location.origin, productId, title, priceMinor })
    setPayload(data)
    const nav = navigator as unknown as ShareNavigator
    if (canShareNatively(nav)) {
      try {
        await nav.share!(data)
        void recordShare(productId, "native")
        return
      } catch (error) {
        if (isShareCancelled(error)) return
        // The sheet refused (not allowed, nothing to share to): the menu instead.
      }
    }
    setOpen((was) => !was)
  }

  const copy = async () => {
    setOpen(false)
    if (!payload) return
    try {
      await navigator.clipboard.writeText(payload.url)
      void recordShare(productId, "copy_link")
      toast({ type: "success", title: "Link copied" })
    } catch {
      toast({ type: "error", title: "Could not copy the link" })
    }
  }

  return (
    <div className="shop-menu shop-share" ref={root}>
      <button
        type="button"
        className="shop-react__btn"
        aria-label="Share this product"
        title="Share"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => void share()}
      >
        <Share2 size={18} aria-hidden="true" />
      </button>
      {open && payload ? (
        <ul id={menuId} className="shop-menu__panel shop-share__panel" role="menu" aria-label="Share">
          {SHARE_TARGETS.map((target) => {
            const Icon = ICONS[target.channel]
            return (
              <li key={target.channel} role="none">
                {target.channel === "whatsapp" ? (
                  <a
                    role="menuitem"
                    className="shop-menu__item"
                    href={whatsappHref(payload)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      void recordShare(productId, "whatsapp")
                      setOpen(false)
                    }}
                  >
                    <Icon size={16} aria-hidden="true" /> {target.label}
                  </a>
                ) : (
                  <button type="button" role="menuitem" className="shop-menu__item shop-share__item" onClick={() => void copy()}>
                    <Icon size={16} aria-hidden="true" /> {target.label}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
