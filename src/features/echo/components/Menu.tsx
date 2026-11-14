"use client"

import { useEffect, useRef, useState } from "react"

/*
  The small floating menus X uses everywhere (repost, share, ···, More,
  the account chip): a trigger, a panel that closes on an outside press or
  Escape, and plain items. Rendering `initialOpen` lets a test draw the
  open panel without a click.
*/

export interface MenuItem {
  key: string
  label: string
  icon?: React.ReactNode
  danger?: boolean
  onSelect: () => void
}

export function MenuPanel({ items, align = "right", label, className = "" }: { items: readonly MenuItem[]; align?: "left" | "right"; label: string; className?: string }) {
  return (
    <div
      role="menu"
      aria-label={label}
      className={`absolute z-40 mt-1 min-w-[12rem] overflow-hidden rounded-xl border border-border bg-brand-card py-1 text-brand-text shadow-lg ${align === "right" ? "right-0" : "left-0"} ${className}`}
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="menuitem"
          data-menu-item={item.key}
          onClick={(e) => {
            e.stopPropagation()
            item.onSelect()
          }}
          className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold hover:bg-brand-secondary ${item.danger ? "text-danger" : ""}`}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  )
}

export function MenuButton({
  label,
  items,
  children,
  align = "right",
  className = "",
  panelClassName = "",
  initialOpen = false,
  onOpen,
  buttonProps,
}: {
  label: string
  items: readonly MenuItem[]
  children: React.ReactNode
  align?: "left" | "right"
  className?: string
  panelClassName?: string
  initialOpen?: boolean
  onOpen?: () => void
  buttonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>
}) {
  const [open, setOpen] = useState(initialOpen)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", outside)
    document.addEventListener("keydown", key)
    return () => {
      document.removeEventListener("pointerdown", outside)
      document.removeEventListener("keydown", key)
    }
  }, [open])

  const wrapped = items.map((item) => ({
    ...item,
    onSelect: () => {
      setOpen(false)
      item.onSelect()
    },
  }))

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        {...buttonProps}
        onClick={(e) => {
          e.stopPropagation()
          if (!open) onOpen?.()
          setOpen((v) => !v)
        }}
        className={className}
      >
        {children}
      </button>
      {open && <MenuPanel items={wrapped} align={align} label={label} className={panelClassName} />}
    </div>
  )
}
