'use client'

import React, { useState, useRef, useEffect } from 'react'
import AppShell from '@/components/AppShell'
import { useParams, useRouter } from 'next/navigation'
import { useMyCommunities, useCommunity, useCommunitySpaces } from '@/hooks/useCommunities'
import { useCreateCommunityPost } from '@/hooks/useCommunityPosts'
import {
  ChevronDown,
  X,
  Plus,
  Image,
  Video,
  Link2,
  BarChart3,
  Type,
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code,
  Trash2,
  Upload,
  FileText,
  PenLine,
  Shield,
  ArrowLeft,
  Heading,
  Superscript,
  AlertCircle,
  Terminal,
  Table as TableIcon,
} from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import LinkExtension from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { Superscript as SuperscriptExtension } from '@tiptap/extension-superscript'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import type { Community } from '@/types/communities'

// ─── Types ───

type PostTab = 'text' | 'media' | 'link' | 'poll'

interface MediaFile {
  file: File
  preview: string
  type: 'image' | 'video'
}

// ─── Tab config ───

const POST_TABS: { key: PostTab; label: string; icon: React.ReactNode }[] = [
  { key: 'text', label: 'Text', icon: <Type className="w-4 h-4" /> },
  { key: 'media', label: 'Images & Video', icon: <Image className="w-4 h-4" /> },
  { key: 'link', label: 'Link', icon: <Link2 className="w-4 h-4" /> },
  { key: 'poll', label: 'Poll', icon: <BarChart3 className="w-4 h-4" /> },
]

// ─── Main Page ───

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export default function CommunityNewPostPage() {
  const params = useParams()
  const router = useRouter()
  const communityId = params.communityId as string

  // Data
  const { data: myCommunities } = useMyCommunities()
  const { data: currentCommunity } = useCommunity(communityId)
  const [selectedCommunityId, setSelectedCommunityId] = useState(communityId)
  const { data: spaces } = useCommunitySpaces(selectedCommunityId)
  const selectedCommunity = myCommunities?.find(c => c.id === selectedCommunityId) ?? currentCommunity

  // Auto-select first space silently (backend API requires spaceId)
  const effectiveSpaceId = spaces && spaces.length > 0 ? spaces[0].id : ''
  const createPost = useCreateCommunityPost(selectedCommunityId, effectiveSpaceId)

  // State
  const [activeTab, setActiveTab] = useState<PostTab>('text')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [showTagInput, setShowTagInput] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [pollOptions, setPollOptions] = useState(['', ''])
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])
  const [showCommunityPicker, setShowCommunityPicker] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit,
      LinkExtension.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: 'Body text (optional)' }),
      SuperscriptExtension,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: body,
    onUpdate: ({ editor }) => {
      setBody(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: "w-full px-5 py-4 text-[15px] font-medium text-brand-text border-none outline-none bg-transparent min-h-[200px] cursor-text [&_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_p.is-editor-empty:first-child::before]:float-left [&_p.is-editor-empty:first-child::before]:text-brand-text/40 [&_p.is-editor-empty:first-child::before]:pointer-events-none [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:border-brand-divider [&_blockquote]:pl-4 [&_code]:bg-brand-text/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_pre]:bg-brand-text/5 [&_pre]:p-3 [&_pre]:rounded-xl [&_table]:border-collapse [&_table]:w-full [&_table]:my-4 [&_th]:border [&_th]:border-brand-divider [&_th]:bg-brand-text/5 [&_th]:p-2 [&_td]:border [&_td]:border-brand-divider [&_td]:p-2 focus:outline-none",
      },
    },
  })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  // Close community picker on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowCommunityPicker(false)
      }
    }
    if (showCommunityPicker) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showCommunityPicker])

  // Tag handling
  const addTag = () => {
    const tag = tagInput.trim().replace(/^#/, '')
    if (tag && !tags.includes(tag) && tags.length < 10) {
      setTags([...tags, tag])
    }
    setTagInput('')
  }

  const removeTag = (tag: string) => setTags(tags.filter(t => t !== tag))

  // Media handling
  const handleFileSelect = (files: FileList | null) => {
    if (!files) return
    const maxFiles = 10
    const newFiles: MediaFile[] = []
    for (let i = 0; i < files.length && mediaFiles.length + newFiles.length < maxFiles; i++) {
      const file = files[i]
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) continue
      newFiles.push({
        file,
        preview: URL.createObjectURL(file),
        type: file.type.startsWith('video/') ? 'video' : 'image',
      })
    }
    setMediaFiles(prev => [...prev, ...newFiles].slice(0, maxFiles))
  }

  const removeMediaFile = (index: number) => {
    setMediaFiles(prev => {
      URL.revokeObjectURL(prev[index].preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    handleFileSelect(e.dataTransfer.files)
  }

  // Poll handling
  const addPollOption = () => {
    if (pollOptions.length < 6) setPollOptions([...pollOptions, ''])
  }
  const updatePollOption = (index: number, value: string) => {
    setPollOptions(prev => prev.map((v, i) => i === index ? value : v))
  }
  const removePollOption = (index: number) => {
    if (pollOptions.length > 2) setPollOptions(prev => prev.filter((_, i) => i !== index))
  }

  // Validation
  const isValid = title.trim().length > 0

  // Publish
  const handlePublish = async () => {
    if (!isValid || publishing || !effectiveSpaceId) return
    setPublishing(true)
    try {
      await createPost.mutateAsync({
        body: body.trim() || title.trim(),
        content_type: 'text',
        title: title.trim() || undefined,
      })
      router.push(`/communities/${selectedCommunityId}`)
    } catch (err) {
      console.error('Publish failed:', err)
    } finally {
      setPublishing(false)
    }
  }

  return (
    <AppShell>
      <div className="max-w-[800px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20 relative">
        <div className="flex flex-col gap-6">

          {/* ─── Top Navigation & Title ─── */}
          <div className="flex flex-col gap-2">
            <Link
              href={`/communities/${selectedCommunityId}`}
              className="inline-flex items-center gap-2 text-sm font-bold text-brand-text/50 hover:text-brand-text transition-colors w-fit group mb-2"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Back to Community
            </Link>
            <h1 className="text-3xl font-black text-brand-text tracking-tight flex items-center gap-3">
              <span className="bg-gradient-to-tr from-brand-text to-brand-text/50 bg-clip-text text-transparent">Create Post</span>
              <PenLine className="w-6 h-6 text-brand-text/20" />
            </h1>
          </div>

          {/* ─── Unified Creation Card ─── */}
          <div className="bg-white dark:bg-brand-bg rounded-[1.5rem] border border-brand-divider/60 shadow-xl overflow-visible relative z-10">

            {/* ── Header: Community Picker & Segmented Tabs ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:px-6 sm:py-4 border-b border-brand-divider/40 bg-brand-text/[0.015] rounded-t-[1.5rem]">
              
              {/* Community selector */}
              <div className="relative z-30" ref={pickerRef}>
                <button
                  onClick={() => setShowCommunityPicker(!showCommunityPicker)}
                  className="flex items-center gap-3 px-3 py-2 bg-white dark:bg-brand-bg border border-brand-divider/60 shadow-sm rounded-xl hover:bg-brand-text/5 transition-all duration-300 max-w-sm"
                >
                  <div className="w-7 h-7 rounded-[0.5rem] overflow-hidden flex-shrink-0 shadow-sm">
                    {selectedCommunity?.avatar_media_id ? (
                      <img
                        src={`/v1/media/${selectedCommunity.avatar_media_id}/serve`}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                        {selectedCommunity?.name?.charAt(0)?.toUpperCase() || 'C'}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col text-left mr-2 justify-center">
                    <span className="text-[9px] font-bold text-brand-text/50 uppercase tracking-widest leading-none mb-0.5">Posting to</span>
                    <span className="text-xs font-black text-brand-text leading-none truncate max-w-[120px]">
                      c/{selectedCommunity?.handle || selectedCommunity?.name || 'Select'}
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-brand-text/50 ml-auto" />
                </button>

                <AnimatePresence>
                  {showCommunityPicker && myCommunities && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="absolute top-full mt-2 left-0 w-80 bg-white/95 dark:bg-brand-bg/95 backdrop-blur-2xl border border-brand-divider/60 rounded-3xl shadow-2xl z-50 py-2 max-h-72 overflow-y-auto"
                    >
                      <p className="px-4 py-2.5 text-[10px] font-black text-brand-text/40 uppercase tracking-widest pl-5">Your communities</p>
                      <div className="px-2 space-y-1">
                        {myCommunities.map(community => (
                          <button
                            key={community.id}
                            onClick={() => {
                              setSelectedCommunityId(community.id)
                              setShowCommunityPicker(false)
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-brand-text/5 transition-colors ${
                              community.id === selectedCommunityId ? 'bg-brand-text/5 border border-brand-text/10' : 'border border-transparent'
                            }`}
                          >
                            <div className="w-9 h-9 rounded-[0.6rem] overflow-hidden flex-shrink-0">
                              {community.avatar_media_id ? (
                                <img
                                  src={`/v1/media/${community.avatar_media_id}/serve`}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                                  {community.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div className="text-left flex-1 min-w-0">
                              <p className="text-sm font-bold text-brand-text truncate">c/{community.handle || community.name}</p>
                              <p className="text-[11px] font-medium text-brand-text/50">{formatCount(community.member_count)} members</p>
                            </div>
                            {community.id === selectedCommunityId && (
                              <div className="w-2 h-2 rounded-full bg-rose-500 mr-2" />
                            )}
                          </button>
                        ))}
                      </div>
                      {myCommunities.length === 0 && (
                        <p className="px-4 py-8 text-sm font-semibold text-brand-text/40 text-center">You haven&apos;t joined any communities yet</p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Content type tabs */}
              <div className="flex bg-brand-text/5 dark:bg-brand-text/[0.04] rounded-xl border border-brand-text/10 p-1 w-full sm:w-auto">
                {POST_TABS.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-1.5 text-xs font-bold transition-all duration-300 rounded-lg whitespace-nowrap ${
                      activeTab === tab.key
                        ? 'text-brand-text shadow-sm bg-white dark:bg-brand-bg scale-100'
                        : 'text-brand-text/50 hover:text-brand-text hover:bg-brand-text/5'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Main Form Area ── */}
            <div className="p-6">
              {/* Title */}
              <div className="relative mb-6">
                <input
                  type="text"
                  placeholder="Give your post a title..."
                  value={title}
                  onChange={e => {
                    if (e.target.value.length <= 300) setTitle(e.target.value)
                  }}
                  className="w-full px-0 py-2 bg-transparent text-2xl font-bold text-brand-text placeholder:text-brand-text/30 focus:outline-none border-b border-brand-divider focus:border-brand-text/30 transition-all rounded-none"
                />
                <span className="absolute right-0 bottom-3 text-[10px] font-bold text-brand-text/30 px-2 py-1 bg-white/80 dark:bg-brand-bg/80 rounded-md">
                  {title.length}/300
                </span>
              </div>

              {/* Tags */}
              <div className="mb-6 flex flex-wrap items-center gap-2">
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-text/5 text-brand-text text-xs font-bold rounded-xl border border-brand-text/10 shadow-sm"
                      >
                        <span className="text-brand-text/40">#</span>
                        {tag}
                        <button onClick={() => removeTag(tag)} className="text-brand-text/40 hover:text-rose-500 transition-colors ml-1">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {showTagInput ? (
                  <div className="flex items-center gap-2 bg-white dark:bg-brand-bg border border-brand-divider rounded-xl p-1 shadow-sm">
                    <input
                      type="text"
                      placeholder="tag name"
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                      autoFocus
                      className="w-28 px-3 py-1 bg-transparent text-xs font-semibold text-brand-text placeholder:text-brand-text/30 focus:outline-none"
                    />
                    <button onClick={addTag} className="px-3 py-1 bg-brand-text text-brand-bg rounded-lg text-xs font-bold hover:bg-brand-text/90">Add</button>
                    <button onClick={() => { setShowTagInput(false); setTagInput('') }} className="px-2 py-1 text-xs text-brand-text/40 hover:text-brand-text">Cancel</button>
                  </div>
                ) : (
                  tags.length < 10 && (
                    <button
                      onClick={() => setShowTagInput(true)}
                      className="px-3 py-1.5 bg-white dark:bg-brand-bg border border-dashed border-brand-divider text-brand-text/50 hover:text-brand-text hover:border-brand-text/30 text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Add tag
                    </button>
                  )
                )}
              </div>

              {/* ── Text tab: body editor ── */}
              {activeTab === 'text' && (
                <div className="bg-transparent border border-brand-divider/60 rounded-[1.2rem] overflow-hidden focus-within:border-brand-text/30 transition-all mt-4 w-full">
                  {/* Toolbar */}
                  <div className="flex items-center gap-0.5 px-3 pt-3 pb-1 flex-wrap">
                    <button
                      type="button"
                      title="Bold"
                      onClick={(e) => { e.preventDefault(); editor?.chain().focus().toggleBold().run() }}
                      className={`p-1.5 rounded-lg transition-colors ${editor?.isActive('bold') ? 'bg-brand-text/10 text-brand-text' : 'text-brand-text/50 hover:bg-brand-text/10 hover:text-brand-text'}`}
                    >
                      <Bold className="w-[18px] h-[18px]" />
                    </button>
                    <button
                      type="button"
                      title="Italic"
                      onClick={(e) => { e.preventDefault(); editor?.chain().focus().toggleItalic().run() }}
                      className={`p-1.5 rounded-lg transition-colors ${editor?.isActive('italic') ? 'bg-brand-text/10 text-brand-text' : 'text-brand-text/50 hover:bg-brand-text/10 hover:text-brand-text'}`}
                    >
                      <Italic className="w-[18px] h-[18px]" />
                    </button>
                    <button
                      type="button"
                      title="Strikethrough"
                      onClick={(e) => { e.preventDefault(); editor?.chain().focus().toggleStrike().run() }}
                      className={`p-1.5 rounded-lg transition-colors ${editor?.isActive('strike') ? 'bg-brand-text/10 text-brand-text' : 'text-brand-text/50 hover:bg-brand-text/10 hover:text-brand-text'}`}
                    >
                      <Strikethrough className="w-[18px] h-[18px]" />
                    </button>
                    <button
                      type="button"
                      title="Superscript"
                      onClick={(e) => { e.preventDefault(); editor?.chain().focus().toggleSuperscript().run() }}
                      className={`p-1.5 rounded-lg transition-colors ${editor?.isActive('superscript') ? 'bg-brand-text/10 text-brand-text' : 'text-brand-text/50 hover:bg-brand-text/10 hover:text-brand-text'}`}
                    >
                      <Superscript className="w-[18px] h-[18px]" />
                    </button>
                    <button
                      type="button"
                      title="Heading"
                      onClick={(e) => { e.preventDefault(); editor?.chain().focus().toggleHeading({ level: 2 }).run() }}
                      className={`p-1.5 rounded-lg transition-colors ${editor?.isActive('heading', { level: 2 }) ? 'bg-brand-text/10 text-brand-text' : 'text-brand-text/50 hover:bg-brand-text/10 hover:text-brand-text'}`}
                    >
                      <Type className="w-[18px] h-[18px]" />
                    </button>

                    <div className="w-px h-[24px] bg-brand-divider mx-2" />

                    <button
                      type="button"
                      title="Link"
                      onClick={(e) => {
                        e.preventDefault();
                        const previousUrl = editor?.getAttributes('link').href
                        const url = window.prompt('URL', previousUrl)
                        if (url === null) return
                        if (url === '') {
                          editor?.chain().focus().extendMarkRange('link').unsetLink().run()
                          return
                        }
                        editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
                      }}
                      className={`p-1.5 rounded-lg transition-colors ${editor?.isActive('link') ? 'bg-brand-text/10 text-brand-text' : 'text-brand-text/50 hover:bg-brand-text/10 hover:text-brand-text'}`}
                    >
                      <Link2 className="w-[18px] h-[18px]" />
                    </button>
                    <button
                      type="button"
                      title="Upload Image"
                      onClick={(e) => { e.preventDefault(); setActiveTab('media') }}
                      className="p-1.5 rounded-lg transition-colors text-brand-text/50 hover:bg-brand-text/10 hover:text-brand-text"
                    >
                      <Image className="w-[18px] h-[18px]" />
                    </button>
                    <button
                      type="button"
                      title="Upload Video"
                      onClick={(e) => { e.preventDefault(); setActiveTab('media') }}
                      className="p-1.5 rounded-lg transition-colors text-brand-text/50 hover:bg-brand-text/10 hover:text-brand-text"
                    >
                      <Video className="w-[18px] h-[18px]" />
                    </button>

                    <div className="w-px h-[24px] bg-brand-divider mx-2" />
                    
                    <button
                      type="button"
                      title="Bullet List"
                      onClick={(e) => { e.preventDefault(); editor?.chain().focus().toggleBulletList().run() }}
                      className={`p-1.5 rounded-lg transition-colors ${editor?.isActive('bulletList') ? 'bg-brand-text/10 text-brand-text' : 'text-brand-text/50 hover:bg-brand-text/10 hover:text-brand-text'}`}
                    >
                      <List className="w-[18px] h-[18px]" />
                    </button>
                    <button
                      type="button"
                      title="Numbered List"
                      onClick={(e) => { e.preventDefault(); editor?.chain().focus().toggleOrderedList().run() }}
                      className={`p-1.5 rounded-lg transition-colors ${editor?.isActive('orderedList') ? 'bg-brand-text/10 text-brand-text' : 'text-brand-text/50 hover:bg-brand-text/10 hover:text-brand-text'}`}
                    >
                      <ListOrdered className="w-[18px] h-[18px]" />
                    </button>
                    
                    <div className="w-px h-[24px] bg-brand-divider mx-2" />

                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); window.alert('Alert blocks coming soon!') }}
                      className="p-1.5 rounded-lg transition-colors text-brand-text/50 hover:bg-brand-text/10 hover:text-brand-text"
                    >
                      <AlertCircle className="w-[18px] h-[18px]" />
                    </button>
                    
                    <button
                      type="button"
                      title="Quote"
                      onClick={(e) => { e.preventDefault(); editor?.chain().focus().toggleBlockquote().run() }}
                      className={`p-1.5 rounded-lg transition-colors ${editor?.isActive('blockquote') ? 'bg-brand-text/10 text-brand-text' : 'text-brand-text/50 hover:bg-brand-text/10 hover:text-brand-text'}`}
                    >
                      <Quote className="w-[18px] h-[18px]" />
                    </button>
                    <button
                      type="button"
                      title="Code"
                      onClick={(e) => { e.preventDefault(); editor?.chain().focus().toggleCode().run() }}
                      className={`p-1.5 rounded-lg transition-colors ${editor?.isActive('code') ? 'bg-brand-text/10 text-brand-text' : 'text-brand-text/50 hover:bg-brand-text/10 hover:text-brand-text'}`}
                    >
                      <Code className="w-[18px] h-[18px]" />
                    </button>
                    <button
                      type="button"
                      title="Code Block"
                      onClick={(e) => { e.preventDefault(); editor?.chain().focus().toggleCodeBlock().run() }}
                      className={`p-1.5 rounded-lg transition-colors ${editor?.isActive('codeBlock') ? 'bg-brand-text/10 text-brand-text' : 'text-brand-text/50 hover:bg-brand-text/10 hover:text-brand-text'}`}
                    >
                      <Terminal className="w-[18px] h-[18px]" />
                    </button>
                    <button
                      type="button"
                      title="Table"
                      onClick={(e) => { e.preventDefault(); editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() }}
                      className="p-1.5 rounded-lg transition-colors text-brand-text/50 hover:bg-brand-text/10 hover:text-brand-text"
                    >
                      <TableIcon className="w-[18px] h-[18px]" />
                    </button>

                    <button
                      type="button"
                      onClick={() => window.alert('Markdown switching coming soon!')}
                      className="ml-auto text-[13px] font-bold text-brand-text/60 hover:text-brand-text/90 transition-colors mr-2 cursor-pointer"
                    >
                       Switch to Markdown
                    </button>

                  </div>
                  <div className="min-h-[200px]" onClick={() => editor?.commands.focus()}>
                    <EditorContent editor={editor} />
                  </div>
                </div>
              )}

              {/* ── Media tab ── */}
              {activeTab === 'media' && (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*,video/*"
                    multiple
                    onChange={e => { handleFileSelect(e.target.files); e.target.value = '' }}
                  />

                  {mediaFiles.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {mediaFiles.map((mf, i) => (
                        <div key={i} className="relative group rounded-lg overflow-hidden bg-brand-bg aspect-square">
                          {mf.type === 'image' ? (
                            <img src={mf.preview} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <video src={mf.preview} className="w-full h-full object-cover" />
                          )}
                          <button
                            onClick={() => removeMediaFile(i)}
                            className="absolute top-1.5 right-1.5 p-1.5 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      {mediaFiles.length < 10 && (
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="aspect-square rounded-lg border-2 border-dashed border-brand-divider hover:border-brand-text/30 flex flex-col items-center justify-center transition-colors"
                        >
                          <Plus className="w-5 h-5 text-brand-text/30" />
                        </button>
                      )}
                    </div>
                  )}

                  {mediaFiles.length === 0 && (
                    <div
                      onDragOver={e => e.preventDefault()}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-brand-divider hover:border-brand-text/30 rounded-lg py-16 flex flex-col items-center justify-center cursor-pointer transition-colors"
                    >
                      <Upload className="w-10 h-10 text-brand-text/15 mb-3" />
                      <p className="text-sm font-semibold text-brand-text/40">Drag and drop or click to upload</p>
                      <p className="text-[11px] text-brand-text/25 mt-1">Images or videos · Up to 10 files</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Link tab ── */}
              {activeTab === 'link' && (
                <input
                  type="url"
                  placeholder="Paste URL here (e.g. https://...)"
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                  className="w-full px-4 py-3 bg-transparent border border-brand-divider/60 rounded-xl text-sm font-semibold text-brand-text placeholder:text-brand-text/30 focus:outline-none focus:border-brand-text/30 transition-all shadow-sm mt-4"
                />
              )}

              {/* ── Poll tab ── */}
              {activeTab === 'poll' && (
                <div>
                  <div className="space-y-2 mb-3">
                    {pollOptions.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder={`Option ${i + 1}`}
                          value={opt}
                          onChange={e => updatePollOption(i, e.target.value)}
                          className="flex-1 px-4 py-2.5 border border-brand-divider rounded-lg text-sm text-brand-text placeholder:text-brand-text/30 focus:outline-none focus:border-brand-text/30 transition-colors"
                        />
                        {pollOptions.length > 2 && (
                          <button
                            onClick={() => removePollOption(i)}
                            className="p-1.5 text-brand-text/30 hover:text-red-500 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {pollOptions.length < 6 && (
                    <button
                      onClick={addPollOption}
                      className="text-xs font-semibold text-blue-500 hover:text-blue-600 transition-colors"
                    >
                      + Add option
                    </button>
                  )}
                </div>
              )}

              {/* Divider + actions */}
              <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-brand-divider/40">
                <button
                  onClick={handlePublish}
                  disabled={!isValid || publishing}
                  className="px-8 py-3 bg-brand-text text-brand-bg text-sm font-black rounded-xl hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:hover:-translate-y-0 disabled:hover:shadow-none"
                >
                  {publishing ? 'Posting...' : 'Post'}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </AppShell>
  )
}
