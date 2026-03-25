'use client'

import React, { useState } from 'react'
import { BookOpen, Plus, Pin, X } from 'lucide-react'
import { useWikiPages, useCreateWikiPage, useUpdateWikiPage } from '@/hooks/useCommunityAdmin'
import { isAtLeast } from '@/lib/communityRoles'
import type { WikiPageV2 } from '@/hooks/useCommunityAdmin'

interface Props {
  communityId: string
  viewerRole?: string
}

export default function CommunityWikiTab({ communityId, viewerRole }: Props) {
  const { data: pages, isLoading } = useWikiPages(communityId)
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [editingPage, setEditingPage] = useState<WikiPageV2 | null>(null)
  const canEdit = isAtLeast(viewerRole, 'moderator')

  const selectedPage = pages?.find(p => p.slug === selectedSlug)

  // Group by category
  const grouped = React.useMemo(() => {
    if (!pages) return {}
    const map: Record<string, WikiPageV2[]> = {}
    for (const page of pages) {
      const cat = page.category || 'General'
      if (!map[cat]) map[cat] = []
      map[cat].push(page)
    }
    // Sort pinned first within each category
    for (const cat of Object.keys(map)) {
      map[cat].sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0))
    }
    return map
  }, [pages])

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white border border-brand-divider rounded-xl p-4 animate-pulse">
            <div className="h-4 w-32 bg-brand-bg rounded mb-2" />
            <div className="h-3 w-48 bg-brand-bg rounded" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-brand-text">Wiki</h2>
        {canEdit && (
          <button
            onClick={() => { setEditingPage(null); setShowEditor(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-text text-brand-bg text-xs font-bold rounded-lg hover:bg-brand-text/90 transition-colors"
          >
            <Plus className="w-3 h-3" /> New Page
          </button>
        )}
      </div>

      <div className="flex gap-4">
        {/* Page list sidebar */}
        <div className="w-[200px] flex-shrink-0">
          {Object.entries(grouped).length > 0 ? (
            Object.entries(grouped).map(([category, catPages]) => (
              <div key={category} className="mb-4">
                <h4 className="text-[10px] font-bold text-brand-text/40 uppercase tracking-wider mb-1.5">{category}</h4>
                <div className="space-y-0.5">
                  {catPages.map(page => (
                    <button
                      key={page.slug}
                      onClick={() => { setSelectedSlug(page.slug); setShowEditor(false) }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1 ${
                        selectedSlug === page.slug
                          ? 'bg-brand-bg font-semibold text-brand-text'
                          : 'text-brand-text/60 hover:bg-brand-bg hover:text-brand-text'
                      }`}
                    >
                      {page.is_pinned && <Pin className="w-2.5 h-2.5 text-brand-text/40" />}
                      <span className="truncate">{page.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-brand-text/30">No pages yet</p>
          )}
        </div>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          {showEditor ? (
            <WikiEditor
              communityId={communityId}
              editingPage={editingPage}
              onClose={() => setShowEditor(false)}
              onSaved={slug => { setSelectedSlug(slug); setShowEditor(false) }}
            />
          ) : selectedPage ? (
            <div className="bg-white border border-brand-divider rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-brand-text">{selectedPage.title}</h3>
                {canEdit && (
                  <button
                    onClick={() => { setEditingPage(selectedPage); setShowEditor(true) }}
                    className="text-xs text-brand-text/50 hover:text-brand-text transition-colors"
                  >
                    Edit
                  </button>
                )}
              </div>
              {selectedPage.content_html ? (
                <div className="prose prose-sm max-w-none text-brand-text/80" dangerouslySetInnerHTML={{ __html: selectedPage.content_html }} />
              ) : (
                <p className="text-sm text-brand-text/70 leading-relaxed whitespace-pre-wrap">{selectedPage.content}</p>
              )}
              <div className="flex items-center gap-3 mt-6 pt-4 border-t border-brand-divider text-[10px] text-brand-text/30">
                <span>v{selectedPage.version}</span>
                <span>Updated {new Date(selectedPage.updated_at).toLocaleDateString()}</span>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-brand-divider p-8 text-center">
              <BookOpen className="w-8 h-8 text-brand-text/20 mx-auto mb-2" />
              <p className="text-sm text-brand-text/50">
                {pages && pages.length > 0 ? 'Select a page to view' : 'No wiki pages yet'}
              </p>
              {canEdit && (!pages || pages.length === 0) && (
                <button
                  onClick={() => setShowEditor(true)}
                  className="mt-3 px-4 py-2 bg-brand-text text-brand-bg text-xs font-bold rounded-lg hover:bg-brand-text/90 transition-colors"
                >
                  Create First Page
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function WikiEditor({ communityId, editingPage, onClose, onSaved }: {
  communityId: string
  editingPage: WikiPageV2 | null
  onClose: () => void
  onSaved: (slug: string) => void
}) {
  const [title, setTitle] = useState(editingPage?.title ?? '')
  const [slug, setSlug] = useState(editingPage?.slug ?? '')
  const [content, setContent] = useState(editingPage?.content ?? '')
  const [category, setCategory] = useState(editingPage?.category ?? '')

  const createPage = useCreateWikiPage(communityId)
  const updatePage = useUpdateWikiPage(communityId)

  const handleSubmit = () => {
    if (!title.trim() || !content.trim()) return
    const finalSlug = slug.trim() || title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

    if (editingPage) {
      updatePage.mutate(
        { slug: editingPage.slug, title: title.trim(), content: content.trim(), category: category.trim() || undefined },
        { onSuccess: () => onSaved(editingPage.slug) }
      )
    } else {
      createPage.mutate(
        { title: title.trim(), slug: finalSlug, content: content.trim(), category: category.trim() || undefined },
        { onSuccess: () => onSaved(finalSlug) }
      )
    }
  }

  const isPending = createPage.isPending || updatePage.isPending

  return (
    <div className="bg-white border border-brand-divider rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-brand-text">{editingPage ? 'Edit Page' : 'New Wiki Page'}</h3>
        <button onClick={onClose} className="text-brand-text/40 hover:text-brand-text"><X className="w-4 h-4" /></button>
      </div>

      <div className="space-y-3">
        <input type="text" placeholder="Page title" value={title} onChange={e => setTitle(e.target.value)}
          className="w-full px-3 py-2 bg-brand-bg border border-brand-divider rounded-xl text-sm text-brand-text placeholder:text-brand-text/30 outline-none focus:ring-1 focus:ring-brand-text/20" />

        {!editingPage && (
          <input type="text" placeholder="URL slug (auto-generated)" value={slug} onChange={e => setSlug(e.target.value)}
            className="w-full px-3 py-2 bg-brand-bg border border-brand-divider rounded-xl text-xs font-mono text-brand-text placeholder:text-brand-text/30 outline-none focus:ring-1 focus:ring-brand-text/20" />
        )}

        <input type="text" placeholder="Category (optional)" value={category} onChange={e => setCategory(e.target.value)}
          className="w-full px-3 py-2 bg-brand-bg border border-brand-divider rounded-xl text-sm text-brand-text placeholder:text-brand-text/30 outline-none focus:ring-1 focus:ring-brand-text/20" />

        <textarea placeholder="Page content..." value={content} onChange={e => setContent(e.target.value)} rows={12}
          className="w-full px-3 py-2 bg-brand-bg border border-brand-divider rounded-xl text-sm text-brand-text placeholder:text-brand-text/30 outline-none focus:ring-1 focus:ring-brand-text/20 resize-none" />

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-xs text-brand-text/50 hover:text-brand-text transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={!title.trim() || !content.trim() || isPending}
            className="px-5 py-2 bg-brand-text text-brand-bg text-xs font-bold rounded-lg hover:bg-brand-text/90 transition-colors disabled:opacity-40">
            {isPending ? 'Saving...' : editingPage ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
