export interface BroadcastChannel {
  id: string
  owner_id: string
  handle: string
  name: string
  description: string
  avatar_media_id?: string
  banner_media_id?: string
  channel_type: 'public' | 'private' | 'creator' | 'brand' | 'education' | 'official' | 'topic' | 'paid'
  category: string
  language: string
  comment_mode: 'enabled' | 'moderated' | 'subscribers_only' | 'disabled'
  reaction_mode: 'enabled' | 'disabled'
  forward_allowed: boolean
  paid_access: boolean
  subscription_price_cents: number
  subscriber_count: number
  update_count: number
  is_verified: boolean
  status: string
  viewer_role?: string
  /**
   * Whether the signed-in viewer has muted this channel. Real server state
   * (channel-service sets it from the member row), so the toggle survives a
   * reload and agrees across tabs — it is not a local preference.
   */
  viewer_muted?: boolean
  created_at: string
  updated_at: string
}

export interface ChannelMember {
  channel_id: string
  user_id: string
  role: string
  notify_on: string
  subscribed_at: string
}

export interface ChannelUpdate {
  id: string
  channel_id: string
  author_id: string
  update_type: 'announcement' | 'image' | 'video' | 'audio' | 'poll' | 'event' | 'commerce' | 'alert' | 'digest'
  title?: string
  body: string
  media_ids: string[]
  metadata?: Record<string, unknown>
  is_pinned: boolean
  scheduled_at?: string
  published_at?: string
  status: string
  view_count: number
  reaction_count: number
  comment_count: number
  forward_count: number
  created_at: string
  /**
   * Per-emoji tallies for this update, highest first. Served by
   * `Service.decorateUpdates`; absent only on a server build older than
   * the field.
   */
  reactions?: ChannelReactionCount[]
  /**
   * The emoji the signed-in viewer reacted with, or absent if they have
   * not reacted. This is real server state, so the highlight survives a
   * reload and is right in a second tab.
   *
   * Channels have exactly one reaction per viewer: reacting again with a
   * different emoji replaces the first.
   */
  viewer_reaction?: string
}

export interface ChannelReactionCount {
  emoji: string
  count: number
}
