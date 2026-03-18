export interface Community {
  id: string
  owner_id: string
  handle: string
  name: string
  description: string
  avatar_media_id?: string
  banner_media_id?: string
  community_type: 'public' | 'private' | 'invite' | 'education' | 'local' | 'professional' | 'fan' | 'brand'
  category: string
  join_mode: string
  member_count: number
  space_count: number
  online_count?: number
  is_verified: boolean
  status: string
  viewer_role?: string
  rules?: string[]
  created_at: string
  mutual_members?: { user_id: string; avatar_url?: string; display_name?: string }[]
}

export interface CommunityMember {
  community_id: string
  user_id: string
  display_name?: string
  username?: string
  avatar_url?: string
  role: string
  joined_at: string
}

export interface CommunitySpace {
  id: string
  community_id: string
  space_type: 'group' | 'channel' | 'discussion' | 'events' | 'resources'
  linked_group_id?: string
  linked_channel_id?: string
  name: string
  description: string
  member_count?: number
  post_count?: number
  is_quarantined: boolean
  created_at: string
}

export interface CommunityEvent {
  id: string
  community_id: string
  title: string
  description: string
  starts_at: string
  ends_at?: string
  location?: string
  is_online: boolean
  attendee_count: number
  cover_media_id?: string
  created_at: string
}

export interface CommunityAnnouncement {
  id: string
  community_id: string
  author_id: string
  author_name?: string
  author_avatar?: string
  content: string
  is_pinned: boolean
  created_at: string
}

export interface CommunityJoinRequest {
  id: string
  community_id: string
  user_id: string
  status: string
  created_at: string
}
