'use client'

import React, { useState } from 'react'
import AppShell from '@/components/AppShell'
import { useParams } from 'next/navigation'
import {
  useCommunity,
  useCommunitySpaces,
  useCommunityMembers,
  useCommunityEvents,
  useCommunityAnnouncements,
  useDeleteSpace,
  useJoinCommunity,
  useLeaveCommunity,
} from '@/hooks/useCommunities'
import CommunityHeader from '@/components/communities/CommunityHeader'
import CommunityEditModal from '@/components/communities/CommunityEditModal'
import SpaceCard from '@/components/communities/SpaceCard'
import {
  Home,
  Megaphone,
  LayoutGrid,
  Calendar,
  Users,
  Info,
  ArrowLeft,
  Search,
  Pin,
  MapPin,
  Video,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import type { CommunityEvent, CommunityAnnouncement } from '@/types/communities'

type NavSection = 'home' | 'announcements' | 'spaces' | 'events' | 'members' | 'about'

const navItems: { key: NavSection; label: string; icon: React.ReactNode }[] = [
  { key: 'home', label: 'Home Feed', icon: <Home className="w-4 h-4" /> },
  { key: 'announcements', label: 'Announcements', icon: <Megaphone className="w-4 h-4" /> },
  { key: 'spaces', label: 'Spaces', icon: <LayoutGrid className="w-4 h-4" /> },
  { key: 'events', label: 'Events', icon: <Calendar className="w-4 h-4" /> },
  { key: 'members', label: 'Members', icon: <Users className="w-4 h-4" /> },
  { key: 'about', label: 'About', icon: <Info className="w-4 h-4" /> },
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
  const [spacesExpanded, setSpacesExpanded] = useState(true)
  const [memberSearch, setMemberSearch] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)

  const { data: community, isLoading } = useCommunity(communityId)
  const { data: spaces } = useCommunitySpaces(communityId)
  const { data: members } = useCommunityMembers(communityId)
  const { data: events = [] } = useCommunityEvents(activeNav === 'events' ? communityId : undefined)
  const { data: announcements = [] } = useCommunityAnnouncements(
    activeNav === 'home' || activeNav === 'announcements' ? communityId : undefined
  )
  const deleteSpace = useDeleteSpace()
  const joinCommunity = useJoinCommunity()
  const leaveCommunity = useLeaveCommunity()

  const isAdmin =
    community?.viewer_role === 'admin' ||
    community?.viewer_role === 'owner' ||
    community?.viewer_role === 'moderator'
  const isMember = community?.viewer_role && community.viewer_role !== 'outsider'

  if (isLoading) {
    return (
      <AppShell>
        <div className="max-w-6xl mx-auto px-4 pt-8 pb-16">
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
        <div className="max-w-6xl mx-auto px-4 pt-8 pb-16 text-center">
          <p className="text-brand-text/60">Community not found</p>
        </div>
      </AppShell>
    )
  }

  const pinnedAnnouncement = announcements.find((announcement) => announcement.is_pinned)
  const filteredMembers = memberSearch
    ? members?.filter(
        (member) =>
          member.display_name?.toLowerCase().includes(memberSearch.toLowerCase()) ||
          member.username?.toLowerCase().includes(memberSearch.toLowerCase()) ||
          member.user_id.toLowerCase().includes(memberSearch.toLowerCase())
      )
    : members

  const upcomingEvents = events.filter((event) => new Date(event.starts_at) >= new Date())
  const pastEvents = events.filter((event) => new Date(event.starts_at) < new Date())

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-4 pt-8 pb-16">
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
          <div className="w-[220px] flex-shrink-0 hidden md:block">
            <div className="bg-white rounded-2xl border border-brand-divider p-4 sticky top-24">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
                  {community.avatar_media_id ? (
                    <img
                      src={`/v1/media/${community.avatar_media_id}/serve`}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-500 flex items-center justify-center text-white font-bold text-sm">
                      {community.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-brand-text truncate">{community.name}</p>
                  <p className="text-[11px] font-mono text-brand-text/50">@{community.handle}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 mb-3 text-xs font-mono text-brand-text/60">
                <span>{formatCount(community.member_count)} members</span>
                {community.online_count !== undefined && (
                  <>
                    <span className="text-brand-text/20">|</span>
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      {community.online_count} online
                    </span>
                  </>
                )}
              </div>

              {isAdmin ? (
                <div className="mb-4">
                  <button
                    onClick={() => setShowEditModal(true)}
                    className="block w-full text-center px-3 py-2 border border-brand-divider text-brand-text text-xs font-semibold rounded-xl hover:bg-brand-bg transition-colors"
                  >
                    Edit Community
                  </button>
                </div>
              ) : isMember ? (
                <div className="mb-4">
                  <button
                    onClick={() => leaveCommunity.mutate(community.id)}
                    disabled={leaveCommunity.isPending}
                    className="block w-full text-center px-3 py-2 border border-brand-divider text-brand-text text-xs font-semibold rounded-xl hover:bg-brand-bg transition-colors disabled:opacity-50"
                  >
                    Leave Community
                  </button>
                </div>
              ) : (
                <div className="mb-4">
                  <button
                    onClick={() => joinCommunity.mutate(community.id)}
                    disabled={joinCommunity.isPending}
                    className="block w-full text-center px-3 py-2 bg-brand-text text-brand-bg text-xs font-bold rounded-xl hover:bg-brand-text/90 transition-colors disabled:opacity-60"
                  >
                    Join Community
                  </button>
                </div>
              )}

              <nav className="space-y-0.5">
                {navItems.map((item) => {
                  const isSpaces = item.key === 'spaces'
                  return (
                    <div key={item.key}>
                      <button
                        onClick={() => {
                          setActiveNav(item.key)
                          if (isSpaces) setSpacesExpanded(!spacesExpanded)
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors ${
                          activeNav === item.key
                            ? 'bg-brand-bg text-brand-text font-semibold'
                            : 'text-brand-text/60 hover:bg-brand-bg hover:text-brand-text'
                        }`}
                      >
                        {item.icon}
                        <span className="flex-1 text-left">{item.label}</span>
                        {isSpaces && (
                          spacesExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-brand-text/40" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-brand-text/40" />
                          )
                        )}
                      </button>
                      {isSpaces && spacesExpanded && spaces && spaces.length > 0 && (
                        <div className="ml-7 mt-0.5 space-y-0.5">
                          {spaces.slice(0, 5).map((space) => (
                            <Link
                              key={space.id}
                              href={
                                space.linked_group_id
                                  ? `/groups/${space.linked_group_id}`
                                  : space.linked_channel_id
                                    ? `/channels/${space.linked_channel_id}`
                                    : '#'
                              }
                              className="block text-xs text-brand-text/50 hover:text-brand-text py-1 px-2 rounded truncate transition-colors"
                            >
                              # {space.name}
                            </Link>
                          ))}
                          {spaces.length > 5 && (
                            <button
                              onClick={() => setActiveNav('spaces')}
                              className="text-xs text-brand-text/40 hover:text-brand-text py-1 px-2 transition-colors"
                            >
                              +{spaces.length - 5} more
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </nav>
            </div>
          </div>

          <div className="md:hidden w-full mb-4">
            <div className="flex items-center gap-0 border-b border-brand-divider overflow-x-auto">
              {navItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setActiveNav(item.key)}
                  className={`relative flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                    activeNav === item.key
                      ? 'text-brand-text'
                      : 'text-brand-text/60 hover:text-brand-text'
                  }`}
                >
                  {item.icon}
                  {item.label}
                  {activeNav === item.key && (
                    <span className="absolute bottom-0 left-1 right-1 h-0.5 border-b-2 border-brand-text rounded-full" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            {activeNav === 'home' && (
              <div>
                <h2 className="text-lg font-bold text-brand-text mb-4">Home Feed</h2>

                {pinnedAnnouncement && (
                  <div className="bg-white rounded-2xl border border-brand-divider p-4 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Pin className="w-3.5 h-3.5 text-brand-text/50" />
                      <span className="text-[11px] font-semibold text-brand-text/50 uppercase tracking-wide">
                        Pinned Announcement
                      </span>
                    </div>
                    <p className="text-sm text-brand-text leading-relaxed">
                      {pinnedAnnouncement.content}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-brand-text/40">
                      {pinnedAnnouncement.author_name && (
                        <span className="font-semibold">{pinnedAnnouncement.author_name}</span>
                      )}
                      <span>
                        {new Date(pinnedAnnouncement.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-2xl border border-brand-divider p-8 text-center">
                  <Home className="w-8 h-8 text-brand-text/20 mx-auto mb-2" />
                  <p className="text-sm text-brand-text/50">
                    Community feed posts will appear here
                  </p>
                </div>
              </div>
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

            {activeNav === 'spaces' && (
              <div>
                <h2 className="text-lg font-bold text-brand-text mb-4">
                  Spaces ({spaces?.length ?? 0})
                </h2>
                {spaces && spaces.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {spaces.map((space) => (
                      <SpaceCard
                        key={space.id}
                        space={space}
                        isAdmin={isAdmin}
                        onRemove={(spaceId) => deleteSpace.mutate({ communityId, spaceId })}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-brand-divider p-8 text-center">
                    <LayoutGrid className="w-8 h-8 text-brand-text/20 mx-auto mb-2" />
                    <p className="text-sm text-brand-text/50">No spaces yet</p>
                  </div>
                )}
              </div>
            )}

            {activeNav === 'events' && (
              <div>
                <h2 className="text-lg font-bold text-brand-text mb-4">Events</h2>

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

                {upcomingEvents.length === 0 && pastEvents.length === 0 && (
                  <div className="bg-white rounded-2xl border border-brand-divider p-8 text-center">
                    <Calendar className="w-8 h-8 text-brand-text/20 mx-auto mb-2" />
                    <p className="text-sm text-brand-text/50">No events yet</p>
                  </div>
                )}
              </div>
            )}

            {activeNav === 'members' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-brand-text">
                    Members ({community.member_count})
                  </h2>
                </div>

                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text/30" />
                  <input
                    type="text"
                    placeholder="Search members..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-brand-divider rounded-xl text-sm placeholder:text-brand-text/30 focus:outline-none focus:ring-2 focus:ring-brand-text/20 text-brand-text"
                  />
                </div>

                <div className="space-y-2">
                  {filteredMembers && filteredMembers.length > 0 ? (
                    filteredMembers.map((member) => (
                      <div
                        key={member.user_id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-white border border-brand-divider"
                      >
                        <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                          {member.avatar_url ? (
                            <img
                              src={member.avatar_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-brand-bg flex items-center justify-center">
                              <Users className="w-5 h-5 text-brand-text/30" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-brand-text truncate">
                            {member.display_name || member.username || member.user_id}
                          </p>
                          {member.username && (
                            <p className="text-[11px] font-mono text-brand-text/50">
                              @{member.username}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {(member.role === 'admin' ||
                            member.role === 'owner' ||
                            member.role === 'moderator') && (
                            <span className="px-2 py-0.5 bg-brand-bg text-brand-text/60 text-[10px] font-bold rounded-full uppercase">
                              {member.role}
                            </span>
                          )}
                          <span className="text-[10px] font-mono text-brand-text/40">
                            {new Date(member.joined_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <Users className="w-8 h-8 text-brand-text/20 mx-auto mb-2" />
                      <p className="text-sm text-brand-text/50">
                        {memberSearch ? 'No members found' : 'No members to show'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
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
          </div>
        </div>

        <AnimatePresence>
          {showEditModal && (
            <CommunityEditModal community={community} onClose={() => setShowEditModal(false)} />
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  )
}

function AnnouncementCard({ announcement }: { announcement: CommunityAnnouncement }) {
  return (
    <div className="bg-white rounded-2xl border border-brand-divider p-4">
      <div className="flex items-center gap-2 mb-2">
        {announcement.is_pinned && <Pin className="w-3.5 h-3.5 text-brand-text/50" />}
        <div className="flex items-center gap-2">
          {announcement.author_avatar && (
            <img
              src={announcement.author_avatar}
              alt=""
              className="w-5 h-5 rounded-full object-cover"
            />
          )}
          {announcement.author_name && (
            <span className="text-xs font-semibold text-brand-text">
              {announcement.author_name}
            </span>
          )}
        </div>
        <span className="text-[11px] font-mono text-brand-text/40 ml-auto">
          {new Date(announcement.created_at).toLocaleDateString()}
        </span>
      </div>
      <p className="text-sm text-brand-text leading-relaxed">{announcement.content}</p>
    </div>
  )
}

function EventCard({ event, isPast }: { event: CommunityEvent; isPast?: boolean }) {
  const date = new Date(event.starts_at)

  return (
    <div
      className={`bg-white rounded-2xl border border-brand-divider p-4 ${isPast ? 'opacity-60' : ''}`}
    >
      <div className="flex gap-4">
        <div className="w-14 h-14 rounded-xl bg-brand-bg flex flex-col items-center justify-center flex-shrink-0">
          <span className="text-xs font-mono text-brand-text/50 uppercase">
            {date.toLocaleDateString('en-US', { month: 'short' })}
          </span>
          <span className="text-lg font-bold text-brand-text">{date.getDate()}</span>
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-brand-text truncate">{event.title}</h4>
          {event.description && (
            <p className="text-xs text-brand-text/60 mt-0.5 line-clamp-1">{event.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-[11px] font-mono text-brand-text/50">
            <span>
              {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
            {event.location && (
              <span className="flex items-center gap-0.5">
                <MapPin className="w-3 h-3" />
                {event.location}
              </span>
            )}
            {event.is_online && (
              <span className="flex items-center gap-0.5">
                <Video className="w-3 h-3" />
                Online
              </span>
            )}
            <span>{event.attendee_count} attending</span>
          </div>
        </div>
      </div>
    </div>
  )
}
