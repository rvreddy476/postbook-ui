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
  viewer_role?: 'owner' | 'admin' | 'moderator' | 'member' | 'pending' | 'outsider' | 'banned'
  is_mature?: boolean
  /**
   * Whether this group has opted in to anonymous posting.
   *
   * The composer offers its anonymous toggle ONLY when this is true: the
   * server refuses `is_anonymous` for a group that has not opted in, so
   * offering the switch anyway is offering a switch that returns an error.
   * Read it as `=== true` — Go marshals the unset case as `false` and an older
   * server build omits it entirely, and both mean "do not offer it".
   */
  allow_anonymous_posts?: boolean
  // Discover personalization (GET /v1/groups/discover)
  friends_in_group?: number
  reasons?: string[]
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

export interface GroupInviteDetail extends GroupInvite {
  group_name: string
  group_avatar_media_id?: string
  group_member_count: number
}

export interface GroupPost {
  group_id: string
  post_id: string
  author_id: string
  created_at: string
}

export type GroupReaction = 'like' | 'love' | 'smile' | 'wow' | 'sad' | 'angry'
export interface GroupReactionState {
  post_id: string
  reaction: GroupReaction | null
  spark_count: number
  reaction_counts: Partial<Record<GroupReaction, number>>
  viewer_sparked: boolean
}

export interface GroupPostV2 {
  id: string
  group_id: string
  channel_id?: string
  author_id: string
  content_type: string
  title?: string
  body?: string
  body_html?: string
  type_payload?: Record<string, unknown>
  attachments?: string[]
  needs_approval: boolean
  is_pinned: boolean
  is_announcement: boolean
  status: string
  spark_count: number
  comment_count: number
  echo_count: number
  view_count: number
  created_at: string
  updated_at: string
  /**
   * Whether the signed-in viewer has already sparked / echoed / stashed
   * this post. Absent for an anonymous viewer, and absent from a server
   * build older than this field, so read them as `=== true` and never
   * `?? true`: Go marshals a false bool as `false`, and a genuinely
   * missing field is `undefined`. Both must read as "not reacted".
   */
  viewer_sparked?: boolean
  viewer_reaction?: GroupReaction | null
  reaction_counts?: Partial<Record<GroupReaction, number>>
  viewer_echoed?: boolean
  viewer_stashed?: boolean
  /**
   * Posted without the author's name shown to other members.
   *
   * `author_id` on an anonymous post is NOT the author: the server substitutes
   * a per-post alias uuid while marshalling, so it is shape-compatible, points
   * at nobody, and links to no other post by the same person. So a card must
   * not try to resolve a name for it — say "Anonymous member" instead.
   */
  is_anonymous?: boolean
  /** Set when this post was one target of a cross-post. */
  cross_post_group_id?: string
  // Enriched by frontend
  author_name?: string
  author_avatar_url?: string
  channel_name?: string
}

export interface GroupPostComment {
  is_anonymous?: boolean
  id: string
  post_id: string
  user_id: string
  body: string
  parent_id?: string
  is_pinned: boolean
  spark_count: number
  created_at: string
  updated_at?: string
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

/**
 * What the event composer is allowed to send.
 *
 * `group_events.location_type` is `VARCHAR(20) DEFAULT 'online'` with no CHECK
 * constraint and the create handler binds the column straight from the body,
 * so the server would store any string at all. This union is the client's own
 * discipline, not the column's — which is why `GroupEvent.location_type` below
 * is typed as the `string` the wire can really carry.
 */
export type GroupEventLocationType = 'physical' | 'online'

/**
 * The three values `RSVPGroupEvent` accepts; anything else is rejected before
 * it reaches the store. Note that `not_going` adjusts NO counter server-side —
 * it only records the row — so there is no "not going" count to display.
 */
export type GroupEventRSVPStatus = 'going' | 'maybe' | 'not_going'

/**
 * A group event as `store.GroupEvent` marshals it. Field names are verbatim
 * from the Go struct's json tags.
 *
 * Three things this shape does NOT carry, each of which shapes the UI:
 *
 * 1. There is no `viewer_rsvp`. The list query never joins
 *    `group_event_rsvps` and no route reads your own RSVP back, so after a
 *    reload the app genuinely cannot say which option you picked. The counts
 *    are the only durable truth.
 * 2. There is no update route — no PUT, no PATCH. An event cannot be edited;
 *    delete (a soft cancel: `status = 'cancelled'`) and recreate is the only
 *    path, so no Edit affordance may be offered.
 * 3. `max_attendees` is stored but never enforced: nothing compares it to
 *    `going_count` before recording an RSVP. Show it as stated capacity, never
 *    as a closed door.
 */
export interface GroupEvent {
  id: string
  group_id: string
  /** Set when the event was announced as a group post. Nothing creates one today. */
  post_id?: string
  creator_id: string
  title: string
  description?: string
  cover_media_id?: string
  /** RFC3339. Served as an instant; render it in `timezone`, not the reader's offset. */
  start_at: string
  end_at?: string
  /** IANA zone name. Defaults to 'UTC' in the store when the client omits it. */
  timezone: string
  is_all_day: boolean
  /** See GroupEventLocationType: the column is an unconstrained VARCHAR(20). */
  location_type: string
  address?: string
  online_link?: string
  rsvp_enabled: boolean
  /** 0 means no stated limit. Never enforced server-side. */
  max_attendees: number
  going_count: number
  maybe_count: number
  /** 'upcoming' by default; 'cancelled' rows are filtered out of every read. */
  status: string
  created_at: string
}

/**
 * The body `POST /v1/groups/:groupId/events` accepts.
 *
 * The handler binds into `store.GroupEvent` directly and that struct carries no
 * `binding:` tags, so an empty body is a 201 for an event titled `""` starting
 * `0001-01-01`. Every field below is validated on this side or not at all —
 * see validateEventDraft in EventComposer.
 */
export interface GroupEventCreateInput {
  title: string
  description?: string
  cover_media_id?: string
  start_at: string
  end_at?: string
  timezone: string
  is_all_day: boolean
  location_type: GroupEventLocationType
  address?: string
  online_link?: string
  rsvp_enabled: boolean
  max_attendees: number
}

export type GroupTab = 'about' | 'discussion' | 'members' | 'events' | 'media'
