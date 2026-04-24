'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSession } from '@/services/authService'
import {
  useCreatorPlaylists,
  useCreatePlaylist,
  useDeletePlaylist,
} from '@/hooks/usePosttubeExtras'

export default function PosttubePlaylistsPage() {
  const [userId, setUserId] = useState<string | undefined>()
  useEffect(() => {
    setUserId(getSession()?.id)
  }, [])

  const { data: playlists, isLoading } = useCreatorPlaylists(userId)
  const create = useCreatePlaylist()
  const del = useDeletePlaylist()

  const [showNew, setShowNew] = useState(false)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [isPublic, setIsPublic] = useState(true)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    await create.mutateAsync({ title, description: desc || undefined, is_public: isPublic })
    setTitle('')
    setDesc('')
    setShowNew(false)
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl p-6">
        <Link href="/posttube" className="text-sm text-gray-500 hover:text-violet-600">
          ← PostTube
        </Link>
        <div className="flex items-center justify-between mt-2 mb-6">
          <h1 className="text-2xl font-semibold">My playlists</h1>
          {!showNew ? (
            <button
              onClick={() => setShowNew(true)}
              className="bg-violet-600 text-white px-4 py-2 rounded text-sm hover:bg-violet-700"
            >
              + New playlist
            </button>
          ) : null}
        </div>

        {showNew ? (
          <form onSubmit={submit} className="rounded-xl border border-gray-200 bg-white p-6 mb-6 space-y-3">
            <input
              required
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <textarea
              placeholder="Description (optional)"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={3}
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              Public
            </label>
            <div className="flex gap-2">
              <button type="submit" disabled={create.isPending}
                className="bg-violet-600 text-white px-4 py-2 rounded text-sm disabled:bg-gray-300">
                {create.isPending ? 'Creating…' : 'Create'}
              </button>
              <button type="button" onClick={() => setShowNew(false)}
                className="px-4 py-2 rounded border text-sm">
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        {isLoading ? (
          <div className="py-12 text-center text-gray-500">Loading…</div>
        ) : !playlists || playlists.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            No playlists yet. Create one to organize your saved videos.
          </div>
        ) : (
          <div className="space-y-3">
            {playlists.map((p) => (
              <div key={p.id} className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
                <Link href={`/posttube/playlists/${p.id}`} className="flex-1 min-w-0">
                  <div className="font-medium">{p.title}</div>
                  <div className="text-sm text-gray-500">
                    {p.item_count} video{p.item_count === 1 ? '' : 's'} · {p.is_public ? 'Public' : 'Private'}
                  </div>
                </Link>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${p.title}"?`)) del.mutate(p.id)
                  }}
                  className="text-sm text-red-600 hover:underline"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
