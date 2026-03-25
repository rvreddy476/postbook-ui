'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import AppShell from '@/components/AppShell'
import { useParams } from 'next/navigation'
import {
  useCommunity,
  useCommunityEvents,
  useCommunityAnnouncements,
  useCreateCommunityEvent,
  useJoinCommunity,
  useLeaveCommunity,
} from '@/hooks/useCommunities'
import CommunityHeader from '@/components/communities/CommunityHeader'
import CommunityEditModal from '@/components/communities/CommunityEditModal'
import CommunityFeedTab from '@/components/communities/tabs/CommunityFeedTab'
import CommunityMembersTab from '@/components/communities/tabs/CommunityMembersTab'
import CommunityAdminTab from '@/components/communities/tabs/CommunityAdminTab'
import CommunityWikiTab from '@/components/communities/tabs/CommunityWikiTab'
import CommunityRightRail from '@/components/communities/CommunityRightRail'
import { isAtLeast } from '@/lib/communityRoles'
import {
  Home,
  Megaphone,
  Calendar,
  Users,
  Info,
  ArrowLeft,
  Pin,
  MapPin,
  Video,
  BookOpen,
  Shield,
  Plus,
  X,
  Globe,
  Clock,
  PenLine,
  CalendarPlus,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import type { CommunityEvent, CommunityAnnouncement } from '@/types/communities'

type NavSection = 'home' | 'announcements' | 'events' | 'members' | 'wiki' | 'about' | 'admin'

const allNavItems: { key: NavSection; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
  { key: 'home', label: 'Home Feed', icon: <Home className="w-4 h-4" /> },
  { key: 'announcements', label: 'Announcements', icon: <Megaphone className="w-4 h-4" /> },
  { key: 'events', label: 'Events', icon: <Calendar className="w-4 h-4" /> },
  { key: 'members', label: 'Members', icon: <Users className="w-4 h-4" /> },
  { key: 'wiki', label: 'Wiki', icon: <BookOpen className="w-4 h-4" /> },
  { key: 'about', label: 'About', icon: <Info className="w-4 h-4" /> },
  { key: 'admin', label: 'Admin Tools', icon: <Shield className="w-4 h-4" />, adminOnly: true },
]

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export default function CommunityDetailPage() {
  const params = useParams()
  const communityId = params.communityId as string
  const [activeNav, setActiveNav] = useState<NavSection>('home')
  const [showEditModal, setShowEditModal] = useState(false)
  const [showCreateEvent, setShowCreateEvent] = useState(false)
  const [eventTitle, setEventTitle] = useState('')
  const [eventDesc, setEventDesc] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventStartTime, setEventStartTime] = useState('')
  const [eventEndTime, setEventEndTime] = useState('')
  const [eventLocation, setEventLocation] = useState('')
  const [eventIsOnline, setEventIsOnline] = useState(false)
  const [showCreateMenu, setShowCreateMenu] = useState(false)
  const createMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (createMenuRef.current && !createMenuRef.current.contains(event.target as Node)) {
        setShowCreateMenu(false)
      }
    }
    if (showCreateMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showCreateMenu])

  const { data: community, isLoading } = useCommunity(communityId)
  const { data: events = [] } = useCommunityEvents(activeNav === 'events' ? communityId : undefined)
  const { data: announcements = [] } = useCommunityAnnouncements(
    activeNav === 'home' || activeNav === 'announcements' ? communityId : undefined
  )
  const joinCommunity = useJoinCommunity()
  const leaveCommunity = useLeaveCommunity()
  const createEvent = useCreateCommunityEvent(communityId)

  const isAdmin = isAtLeast(community?.viewer_role, 'moderator')
  const isMember = community?.viewer_role && community.viewer_role !== 'outsider'

  const navItems = useMemo(
    () => allNavItems.filter(item => !item.adminOnly || isAtLeast(community?.viewer_role, 'moderator')),
    [community?.viewer_role]
  )

  const eventsList = events ?? []
  const upcomingEvents = eventsList.filter((event) => new Date(event.starts_at) >= new Date())
  const pastEvents = eventsList.filter((event) => new Date(event.starts_at) < new Date())

  if (isLoading) {
    return (
      <AppShell>
        <div className="max-w-7xl mx-auto px-4 pt-8 pb-16">
          <div className="bg-white rounded-2xl border border-brand-divider overflow-hidden animate-pulse">
            <div className="h-[120px] bg-brand-bg" />
            <div className="px-6 pb-6 -mt-10">
              <div className="w-20 h-20 rounded-2xl bg-brand-bg mb-3" />
              <div className="h-6 w-48 bg-brand-bg rounded mb-2" />
              <div className="h-4 w-32 bg-brand-bg rounded" />
            </div>
          </div>
        </div>
      </AppShell>
    )
  }

  if (!community) {
    return (
      <AppShell>
        <div className="max-w-7xl mx-auto px-4 pt-8 pb-16 text-center">
          <p className="text-brand-text/60">Community not found</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 pt-8 pb-16">
        <Link
          href="/communities"
          className="inline-flex items-center gap-1.5 text-sm text-brand-text/60 hover:text-brand-text mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Communities
        </Link>

        <CommunityHeader
          community={community}
          canEdit={isAdmin}
          onEdit={() => setShowEditModal(true)}
        />

        <div className="flex gap-6 mt-6">
          {/* ─── Left Sidebar ─── */}
          <div className="w-[240px] flex-shrink-0 hidden md:block">
            <div className="bg-white/60 dark:bg-brand-bg/60 backdrop-blur-xl rounded-3xl border border-brand-divider/60 p-5 sticky top-24 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl overflow-hidden flex-shrink-0 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
                  {community.avatar_media_id ? (
                    <img
                      src={`/v1/media/${community.avatar_media_id}/serve`}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-500 flex items-center justify-center text-white font-black text-lg">
                      {community.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-brand-text truncate tracking-tight">{community.name}</p>
                  <p className="text-[11px] font-medium text-brand-text/50">@{community.handle}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 mb-5 text-[11px] font-bold text-brand-text/60 tracking-wide uppercase">
                <span>{formatCount(community.member_count)} members</span>
                {community.online_count !== undefined && (
                  <>
                    <span className="text-brand-text/20">|</span>
                    <span className="flex items-center gap-1.5 text-green-600 dark:text-green-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      {community.online_count} online
                    </span>
                  </>
                )}
              </div>

              {isAdmin ? (
                <div className="mb-5">
                  <button
                    onClick={() => setShowEditModal(true)}
                    className="block w-full text-center px-4 py-2.5 border border-brand-divider text-brand-text text-sm font-bold rounded-xl hover:bg-brand-bg hover:shadow-sm transition-all duration-300"
                  >
                    Edit Community
                  </button>
                </div>
              ) : isMember ? (
                <div className="mb-5">
                  <button
                    onClick={() => leaveCommunity.mutate(community.id)}
                    disabled={leaveCommunity.isPending}
                    className="block w-full text-center px-4 py-2.5 border border-brand-divider/60 bg-white/50 dark:bg-brand-bg/50 text-brand-text text-sm font-bold rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 hover:border-red-200 transition-all duration-300 disabled:opacity-50"
                  >
                    Leave Community
                  </button>
                </div>
              ) : (
                <div className="mb-5">
                  <button
                    onClick={() => joinCommunity.mutate(community.id)}
                    disabled={joinCommunity.isPending}
                    className="block w-full text-center px-4 py-2.5 bg-brand-text text-brand-bg text-sm font-bold rounded-xl hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-60 disabled:hover:translate-y-0"
                  >
                    Join Community
                  </button>
                </div>
              )}

              {/* Replaced old New Post button with FAB logic below */}

              <nav className="space-y-1.5">
                {navItems.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setActiveNav(item.key)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm rounded-xl font-bold transition-all duration-300 ${
                      activeNav === item.key
                        ? 'bg-brand-text text-brand-bg shadow-md scale-100'
                        : 'text-brand-text/70 hover:bg-brand-bg hover:text-brand-text hover:scale-[1.02]'
                    }`}
                  >
                    {item.icon}
                    <span className="flex-1 text-left">{item.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* ─── Mobile Tab Bar ─── */}
          <div className="md:hidden w-full mb-6 relative">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2 px-1">
              {navItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setActiveNav(item.key)}
                  className={`relative flex items-center gap-2 px-5 py-3 text-xs font-bold rounded-2xl whitespace-nowrap transition-all duration-300 ${
                    activeNav === item.key
                      ? 'bg-brand-text text-brand-bg shadow-lg scale-100'
                      : 'bg-white/50 dark:bg-brand-bg/50 backdrop-blur-sm text-brand-text/70 hover:bg-white dark:hover:bg-brand-bg hover:text-brand-text border border-transparent hover:border-brand-divider scale-95 hover:scale-100'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* ─── Main Content ─── */}
          <div className="flex-1 min-w-0 bg-white/40 dark:bg-brand-bg/40 backdrop-blur-3xl rounded-[2.5rem] border border-brand-divider/50 p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] relative overflow-hidden">
            {activeNav === 'home' && (
              <CommunityFeedTab
                communityId={communityId}
                isMember={!!isMember}
                viewerRole={community.viewer_role}
              />
            )}

            {activeNav === 'announcements' && (
              <div>
                <h2 className="text-lg font-bold text-brand-text mb-4">Announcements</h2>
                {announcements.length > 0 ? (
                  <div className="space-y-3">
                    {announcements.map((announcement) => (
                      <AnnouncementCard key={announcement.id} announcement={announcement} />
                    ))}
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-brand-divider p-8 text-center">
                    <Megaphone className="w-8 h-8 text-brand-text/20 mx-auto mb-2" />
                    <p className="text-sm text-brand-text/50">No announcements yet</p>
                  </div>
                )}
              </div>
            )}

            {activeNav === 'events' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-brand-text">Events</h2>
                  {isMember && (
                    <button
                      onClick={() => setShowCreateEvent(!showCreateEvent)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-brand-text text-brand-bg text-xs font-bold rounded-xl hover:bg-brand-text/90 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Create Event
                    </button>
                  )}
                </div>

                {/* Create Event form */}
                {showCreateEvent && (
                  <div className="bg-white border border-brand-divider rounded-2xl p-5 mb-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-brand-text">New Event</h3>
                      <button onClick={() => setShowCreateEvent(false)} className="p-1 text-brand-text/40 hover:text-brand-text">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <input
                      type="text"
                      placeholder="Event title *"
                      value={eventTitle}
                      onChange={e => setEventTitle(e.target.value)}
                      className="w-full px-3 py-2.5 border border-brand-divider rounded-xl text-sm text-brand-text placeholder:text-brand-text/30 focus:outline-none focus:ring-2 focus:ring-brand-text/10 mb-3"
                    />

                    <textarea
                      placeholder="Description (optional)"
                      value={eventDesc}
                      onChange={e => setEventDesc(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2.5 border border-brand-divider rounded-xl text-sm text-brand-text placeholder:text-brand-text/30 focus:outline-none focus:ring-2 focus:ring-brand-text/10 mb-3 resize-none"
                    />

                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div>
                        <label className="text-[11px] text-brand-text/40 mb-1 block">Date *</label>
                        <input
                          type="date"
                          value={eventDate}
                          onChange={e => setEventDate(e.target.value)}
                          className="w-full px-3 py-2.5 border border-brand-divider rounded-xl text-sm text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-text/10"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-brand-text/40 mb-1 block">Start time</label>
                        <input
                          type="time"
                          value={eventStartTime}
                          onChange={e => setEventStartTime(e.target.value)}
                          className="w-full px-3 py-2.5 border border-brand-divider rounded-xl text-sm text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-text/10"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-brand-text/40 mb-1 block">End time</label>
                        <input
                          type="time"
                          value={eventEndTime}
                          onChange={e => setEventEndTime(e.target.value)}
                          className="w-full px-3 py-2.5 border border-brand-divider rounded-xl text-sm text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-text/10"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mb-3">
                      <button
                        onClick={() => setEventIsOnline(false)}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                          !eventIsOnline
                            ? 'bg-brand-text text-brand-bg'
                            : 'border border-brand-divider text-brand-text/50 hover:bg-brand-bg'
                        }`}
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        In-Person
                      </button>
                      <button
                        onClick={() => setEventIsOnline(true)}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                          eventIsOnline
                            ? 'bg-brand-text text-brand-bg'
                            : 'border border-brand-divider text-brand-text/50 hover:bg-brand-bg'
                        }`}
                      >
                        <Globe className="w-3.5 h-3.5" />
                        Online
                      </button>
                    </div>

                    <input
                      type="text"
                      placeholder={eventIsOnline ? 'Meeting link (optional)' : 'Venue address (optional)'}
                      value={eventLocation}
                      onChange={e => setEventLocation(e.target.value)}
                      className="w-full px-3 py-2.5 border border-brand-divider rounded-xl text-sm text-brand-text placeholder:text-brand-text/30 focus:outline-none focus:ring-2 focus:ring-brand-text/10 mb-4"
                    />

                    <button
                      onClick={() => {
                        if (!eventTitle.trim() || !eventDate) return
                        const startsAt = eventStartTime
                          ? `${eventDate}T${eventStartTime}:00`
                          : `${eventDate}T00:00:00`
                        const endsAt = eventEndTime
                          ? `${eventDate}T${eventEndTime}:00`
                          : undefined
                        createEvent.mutate(
                          {
                            title: eventTitle.trim(),
                            description: eventDesc.trim() || undefined,
                            location: eventLocation.trim() || undefined,
                            starts_at: new Date(startsAt).toISOString(),
                            ends_at: endsAt ? new Date(endsAt).toISOString() : undefined,
                          },
                          {
                            onSuccess: () => {
                              setEventTitle('')
                              setEventDesc('')
                              setEventDate('')
                              setEventStartTime('')
                              setEventEndTime('')
                              setEventLocation('')
                              setEventIsOnline(false)
                              setShowCreateEvent(false)
                            },
                          }
                        )
                      }}
                      disabled={!eventTitle.trim() || !eventDate || createEvent.isPending}
                      className="w-full py-2.5 bg-brand-text text-brand-bg text-xs font-bold rounded-xl hover:bg-brand-text/90 transition-colors disabled:opacity-40"
                    >
                      {createEvent.isPending ? 'Creating...' : 'Create Event'}
                    </button>
                  </div>
                )}

                {upcomingEvents.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-brand-text/70 mb-3 uppercase tracking-wide">
                      Upcoming
                    </h3>
                    <div className="space-y-3">
                      {upcomingEvents.map((event) => (
                        <EventCard key={event.id} event={event} />
                      ))}
                    </div>
                  </div>
                )}

                {pastEvents.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-brand-text/70 mb-3 uppercase tracking-wide">
                      Past
                    </h3>
                    <div className="space-y-3">
                      {pastEvents.map((event) => (
                        <EventCard key={event.id} event={event} isPast />
                      ))}
                    </div>
                  </div>
                )}

                {upcomingEvents.length === 0 && pastEvents.length === 0 && !showCreateEvent && (
                  <div className="bg-white rounded-2xl border border-brand-divider p-8 text-center">
                    <Calendar className="w-8 h-8 text-brand-text/20 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-brand-text/50">No events yet</p>
                    {isMember && (
                      <button
                        onClick={() => setShowCreateEvent(true)}
                        className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-brand-text text-brand-bg text-xs font-bold rounded-xl hover:bg-brand-text/90 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Create First Event
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeNav === 'members' && (
              <CommunityMembersTab
                communityId={communityId}
                viewerRole={community.viewer_role}
              />
            )}

            {activeNav === 'wiki' && (
              <CommunityWikiTab
                communityId={communityId}
                viewerRole={community.viewer_role}
              />
            )}

            {activeNav === 'about' && (
              <div>
                <h2 className="text-lg font-bold text-brand-text mb-4">About</h2>

                <div className="bg-white rounded-2xl border border-brand-divider p-5 space-y-5">
                  {community.description && (
                    <div>
                      <h4 className="text-xs font-semibold text-brand-text/50 uppercase tracking-wide mb-1">
                        Description
                      </h4>
                      <p className="text-sm text-brand-text leading-relaxed">
                        {community.description}
                      </p>
                    </div>
                  )}

                  {community.rules && community.rules.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-brand-text/50 uppercase tracking-wide mb-2">
                        Rules
                      </h4>
                      <ol className="space-y-1.5">
                        {community.rules.map((rule, i) => (
                          <li key={i} className="flex gap-2 text-sm text-brand-text">
                            <span className="font-mono text-brand-text/40 text-xs mt-0.5">
                              {i + 1}.
                            </span>
                            {rule}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {community.category && (
                    <div>
                      <h4 className="text-xs font-semibold text-brand-text/50 uppercase tracking-wide mb-1">
                        Category
                      </h4>
                      <span className="px-3 py-1 bg-brand-bg text-brand-text text-sm font-semibold rounded-full">
                        {community.category}
                      </span>
                    </div>
                  )}

                  <div>
                    <h4 className="text-xs font-semibold text-brand-text/50 uppercase tracking-wide mb-1">
                      Created
                    </h4>
                    <p className="text-sm font-mono text-brand-text/70">
                      {new Date(community.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-brand-text/50 uppercase tracking-wide mb-1">
                      Type
                    </h4>
                    <p className="text-sm text-brand-text capitalize">{community.community_type}</p>
                  </div>
                </div>
              </div>
            )}

            {activeNav === 'admin' && (
              <CommunityAdminTab communityId={communityId} />
            )}
          </div>

          {/* ─── Right Rail ─── */}
          <div className="w-[260px] flex-shrink-0 hidden lg:block">
            <CommunityRightRail communityId={communityId} viewerRole={community.viewer_role} />
          </div>
        </div>

        <AnimatePresence>
          {showEditModal && (
            <CommunityEditModal community={community} onClose={() => setShowEditModal(false)} />
          )}
        </AnimatePresence>

        {/* ─── Floating Action Button (FAB) ─── */}
        {isMember && (
          <div className="fixed bottom-8 right-8 z-[100] flex flex-col items-end" ref={createMenuRef}>
            <AnimatePresence>
              {showCreateMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="mb-4 flex flex-col gap-3"
                >
                  <Link
                    href={`/communities/${communityId}/new-post`}
                    className="flex items-center gap-3 px-5 py-3 bg-white/90 dark:bg-brand-bg/90 backdrop-blur-xl border border-brand-divider/80 rounded-2xl shadow-xl hover:bg-brand-bg hover:scale-105 transition-all duration-300 group justify-end"
                  >
                    <span className="text-sm font-bold text-brand-text/80 group-hover:text-brand-text mr-1">Create Post</span>
                    <div className="w-10 h-10 rounded-full bg-brand-text/5 text-brand-text flex items-center justify-center group-hover:bg-brand-text group-hover:text-brand-bg transition-colors shadow-sm">
                      <PenLine className="w-4 h-4" />
                    </div>
                  </Link>
                  <button
                    onClick={() => {
                      setShowCreateEvent(true)
                      setShowCreateMenu(false)
                      setActiveNav('events')
                    }}
                    className="flex items-center gap-3 px-5 py-3 bg-white/90 dark:bg-brand-bg/90 backdrop-blur-xl border border-brand-divider/80 rounded-2xl shadow-xl hover:bg-brand-bg hover:scale-105 transition-all duration-300 group justify-end"
                  >
                    <span className="text-sm font-bold text-brand-text/80 group-hover:text-brand-text mr-1">Create Event</span>
                    <div className="w-10 h-10 rounded-full bg-brand-text/5 text-brand-text flex items-center justify-center group-hover:bg-brand-text group-hover:text-brand-bg transition-colors shadow-sm">
                      <CalendarPlus className="w-4 h-4" />
                    </div>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            <button
              onClick={() => setShowCreateMenu(!showCreateMenu)}
              className={`w-14 h-14 rounded-full bg-rose-600 text-white shadow-[0_8px_30px_rgb(225,29,72,0.3)] flex items-center justify-center hover:scale-110 hover:shadow-[0_8px_40px_rgb(225,29,72,0.4)] transition-all duration-300 active:scale-95 ${
                showCreateMenu ? 'rotate-45 bg-rose-700' : ''
              }`}
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>
        )}
      </div>
    </AppShell>
  )
}

function AnnouncementCard({ announcement }: { announcement: CommunityAnnouncement }) {
  return (
    <div className="bg-gradient-to-br from-brand-text/5 to-transparent rounded-3xl border border-brand-divider/60 p-5 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-brand-text/40 rounded-l-3xl" />
      <div className="flex items-center gap-3 mb-3">
        {announcement.is_pinned && (
          <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-brand-text bg-brand-text/10 px-2 py-1 rounded-md">
            <Pin className="w-3 h-3" /> Pinned
          </div>
        )}
        <div className="flex items-center gap-2">
          {announcement.author_avatar ? (
            <img
              src={announcement.author_avatar}
              alt=""
              className="w-6 h-6 rounded-full object-cover ring-1 ring-black/5"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-brand-bg flex items-center justify-center text-[10px] font-bold">
              {announcement.author_name?.charAt(0) || '?'}
            </div>
          )}
          {announcement.author_name && (
            <span className="text-sm font-bold text-brand-text">
              {announcement.author_name}
            </span>
          )}
        </div>
        <span className="text-[11px] font-bold text-brand-text/40 ml-auto uppercase tracking-wide">
          {new Date(announcement.created_at).toLocaleDateString()}
        </span>
      </div>
      <p className="text-sm text-brand-text/80 leading-relaxed font-medium">{announcement.content}</p>
    </div>
  )
}

function EventCard({ event, isPast }: { event: CommunityEvent; isPast?: boolean }) {
  const date = new Date(event.starts_at)

  return (
    <div
      className={`group relative overflow-hidden bg-white/70 dark:bg-brand-bg/70 backdrop-blur-md rounded-3xl border border-brand-divider/60 p-5 hover:shadow-xl hover:-translate-y-1 hover:bg-white dark:hover:bg-brand-bg hover:border-brand-text/30 transition-all duration-300 ${isPast ? 'opacity-60 grayscale-[0.3]' : ''}`}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-brand-text/[0.03] rounded-bl-full pointer-events-none -z-10 group-hover:scale-110 transition-transform duration-500" />
      <div className="flex gap-5">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-text/10 to-transparent flex flex-col items-center justify-center flex-shrink-0 border border-brand-divider/50 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 w-full h-1.5 bg-brand-text opacity-80" />
          <span className="text-[11px] font-bold text-brand-text/70 uppercase tracking-widest mt-1">
            {date.toLocaleDateString('en-US', { month: 'short' })}
          </span>
          <span className="text-xl font-black text-brand-text leading-none mt-0.5">{date.getDate()}</span>
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-base font-bold text-brand-text truncate tracking-tight">{event.title}</h4>
          {event.description && (
            <p className="text-sm text-brand-text/60 mt-1 line-clamp-2 leading-relaxed">{event.description}</p>
          )}
          <div className="flex items-center gap-4 mt-3 text-xs font-semibold text-brand-text/60 flex-wrap">
            <span className="flex items-center gap-1.5 text-brand-text/80 bg-brand-text/5 px-2 py-1 rounded-lg">
              <Clock className="w-3.5 h-3.5" />
              {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
            {event.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                {event.location}
              </span>
            )}
            {event.is_online && (
              <span className="flex items-center gap-1.5 text-brand-text">
                <Video className="w-3.5 h-3.5" />
                Online
              </span>
            )}
            <span className="flex items-center gap-1.5 ml-auto text-brand-text/50">
              <Users className="w-3.5 h-3.5" />
              {event.attendee_count} attending
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
