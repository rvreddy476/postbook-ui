export interface Group {
  id: string
  name: string
  description: string
  avatar_media_id?: string
  cover_media_id?: string
  creator_id: string
  visibility: 'public' | 'private'
  is_archived: boolean
  chat_conversation_id?: string
  member_count: number
  post_count: number
  created_at: string
  updated_at: string
  // V2 fields
  handle?: string
  category?: string
  privacy_level?: 'public' | 'restricted' | 'private'
  join_mode?: 'open' | 'request' | 'invite_only'
  who_can_post?: 'all_members' | 'admins_mods' | 'admins_only'
  who_can_invite?: 'all_members' | 'admins_mods' | 'admins_only'
  location?: string
  language?: string
  status?: 'active' | 'archived' | 'deleted'
  pending_request_count?: number
  viewer_role?: 'owner' | 'admin' | 'moderator' | 'member' | 'outsider' | 'banned'
}

export interface GroupMember {
  group_id: string
  user_id: string
  role: 'owner' | 'admin' | 'moderator' | 'member'
  joined_at: string
  display_name?: string
  username?: string
  avatar_media_id?: string
  id?: string
  invited_by_user_id?: string
  status?: 'active' | 'left' | 'removed' | 'banned'
  removal_reason?: string
}

export interface GroupInvite {
  id: string
  group_id: string
  inviter_id: string
  invitee_id: string
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
  updated_at: string
  expires_at?: string
}

export interface GroupPost {
  group_id: string
  post_id: string
  author_id: string
  created_at: string
}

export interface GroupJoinRequest {
  id: string
  group_id: string
  user_id: string
  status: 'pending' | 'approved' | 'rejected'
  reviewed_by_user_id?: string
  created_at: string
  reviewed_at?: string
}

export interface GroupRule {
  id: string
  group_id: string
  rule_order: number
  title: string
  description: string
  created_at: string
}

export type GroupTab = 'feed' | 'members' | 'about' | 'media' | 'rules'
