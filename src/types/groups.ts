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
}

export interface GroupMember {
  group_id: string
  user_id: string
  role: 'admin' | 'moderator' | 'member'
  joined_at: string
  display_name?: string
  username?: string
  avatar_media_id?: string
}

export interface GroupInvite {
  id: string
  group_id: string
  inviter_id: string
  invitee_id: string
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
  updated_at: string
}

export interface GroupPost {
  group_id: string
  post_id: string
  author_id: string
  created_at: string
}

export type GroupTab = 'feed' | 'members' | 'about'
