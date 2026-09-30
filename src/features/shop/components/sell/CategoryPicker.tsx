"use client"

// The category tree as drill-down columns. A grouping node opens its
// children; only an `is_listable` node can be chosen, because a listing
// filed on "Fashion" sits on a browse heading no buyer reaches.

import { useMemo, useState } from "react"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CategoryNode } from "../../api/sell"

/** The root-first path to a node id, or null when the tree has no such node. */
export function pathTo(roots: readonly CategoryNode[], id: string): CategoryNode[] | null {
  for (const node of roots) {
    if (node.id === id) return [node]
    const below = pathTo(node.children ?? [], id)
    if (below) return [node, ...below]
  }
  return null
}

export function CategoryPicker({ roots, value, onChange }: { roots: CategoryNode[]; value: string | null; onChange: (node: CategoryNode) => void }) {
  const initial = useMemo(() => (value ? (pathTo(roots, value) ?? []) : []), [roots, value])
  const [path, setPath] = useState<CategoryNode[]>(initial)
  const columns: CategoryNode[][] = [roots.filter((n) => n.is_active !== false)]
  for (const node of path) {
    const kids = (node.children ?? []).filter((n) => n.is_active !== false)
    if (kids.length > 0) columns.push(kids)
  }

  function open(depth: number, node: CategoryNode) {
    const next = [...path.slice(0, depth), node]
    setPath(next)
    if (node.is_listable) onChange(node)
  }

  return (
    <div className="shop-sell-cats" role="tree" aria-label="Categories">
      {columns.map((col, depth) => (
        <ul key={depth} className="shop-sell-cats__col" role="group">
          {col
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name, "en"))
            .map((node) => {
              const chosen = path[depth]?.id === node.id
              const hasKids = (node.children ?? []).length > 0
              return (
                <li key={node.id} role="treeitem" aria-selected={chosen} aria-expanded={hasKids ? chosen : undefined}>
                  <button type="button" className={cn("shop-sell-cats__btn", chosen && "is-chosen", !node.is_listable && !hasKids && "is-disabled")} disabled={!node.is_listable && !hasKids} onClick={() => open(depth, node)}>
                    <span>{node.name}</span>
                    {hasKids ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : node.is_listable ? null : <span className="shop-sell-muted">not listable</span>}
                  </button>
                </li>
              )
            })}
        </ul>
      ))}
    </div>
  )
}
