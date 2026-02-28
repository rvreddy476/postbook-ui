export interface UserProfile {
    id: string
    username: string
    display_name: string
    first_name?: string
    last_name?: string
    preferred_name?: string
    pronouns?: string
    bio: string
    avatar_media_id?: string
    cover_media_id?: string
    category?: string
    profession?: string
    website?: string
    location?: string
    gender?: string
    dob?: string
    badge_flags: number
    is_verified: boolean
    verification_level?: string
    status_text?: string
    status_emoji?: string
    status_expires_at?: string
    profile_theme_color?: string
    intro_media_url?: string
    intro_media_type?: string
    cta_label?: string
    cta_url?: string
    member_since_badge?: boolean
    timezone?: string
    follower_count: number
    following_count: number
    friend_count: number
    post_count: number
    created_at: string
    updated_at: string
}

export interface UserLink {
    platform: string
    url: string
    display_label?: string
    sort_order: number
}

export interface ProfileLink {
    id: string
    profile_id: string
    title: string
    url: string
    icon?: string
    category?: string
    sort_order: number
    click_count: number
    is_pinned: boolean
    visibility: string
    created_at: string
}

export interface Follow {
    id: string
    follower_id: string
    following_id: string
    status: string
    created_at: string
}

export interface Friendship {
    id: string
    requester_id: string
    addressee_id: string
    status: string
    created_at: string
    updated_at: string
}

export interface GraphCounts {
    follower_count: number
    following_count: number
    friend_count: number
}

export interface ContentCounts {
    post: number
    short: number
    video: number
    photo: number
    total: number
}

export interface ProfileData {
    profile: UserProfile
    links: UserLink[]
    stats: GraphCounts & ContentCounts
    relationship: Relationship | null
}

export interface Relationship {
    // Follow axis (asymmetric)
    following: boolean
    followed_by: boolean
    // Circle axis (mutual, requires acceptance)
    in_circle: boolean
    circle_request_sent: boolean
    circle_request_received: boolean
    circle_request_id?: string
    // Block
    blocked: boolean
    blocked_by: boolean
    // Derived permissions (gated by circle)
    can_dm: boolean
    can_see_online: boolean
    can_add_to_group: boolean
    // Mutual circle count
    mutual_circle_count: number
}

export interface FriendRequest {
    sender_id: string
    receiver_id: string
    status: string
    created_at: string
    updated_at: string
}

export type ContentType = "all" | "post" | "short" | "video" | "photo"
export type AppPlatform = "postboek" | "posttube" | "postgram"
export type ProfileTab = "creations" | "about" | "connections" | "pages" | "activity"

export interface PollOption {
    id: string
    label: string
    vote_count: number
    percentage: number
}

export interface PollData {
    question: string
    allows_multiple: boolean
    ends_at?: string | null
    options: PollOption[]
    total_votes: number
    viewer_votes?: string[]
    has_ended: boolean
}

export interface CommentItem {
    id: string
    post_id: string
    author_id: string
    body: string
    text?: string
    like_count: number
    dislike_count: number
    reply_count: number
    is_reply: boolean
    created_at: string
    updated_at: string
    reply?: CommentItem | null
}

export interface PostDetail {
    id: string
    author_id: string
    text: string
    visibility: string
    content_type: string
    is_pinned: boolean
    feeling?: string | null
    activity?: string | null
    activity_detail?: string | null
    no_comments?: boolean
    no_likes?: boolean
    created_at: string
    updated_at: string
    media?: { media_id: string; kind: string }[]
    counts?: { likes: number; comments: number; shares?: number }
    viewer_reaction?: string | null
    location?: string | null
    location_name?: string | null
    location_lat?: number | null
    location_lng?: number | null
    hashtags?: string[]
    mentions?: string[]
    post_type?: string
    app_origin?: string
    is_bookmarked?: boolean
    poll?: PollData | null
}

// --- Stories ---

export interface Story {
    id: string
    author_id: string
    media_url: string
    media_type: "image" | "video"
    caption: string
    visibility: "public" | "followers" | "close_friends"
    view_count: number
    expires_at: string
    is_highlight: boolean
    highlight_group?: string | null
    created_at: string
}

// --- Multi-Reactions ---

export type ReactionType = "like" | "love" | "haha" | "wow" | "sad" | "angry"

export interface ReactionCounts {
    like: number
    love: number
    haha: number
    wow: number
    sad: number
    angry: number
    total: number
}

export interface ReactionToggleResult {
    reaction_type: string
    is_set: boolean
    counts: ReactionCounts
}

// --- Saved Items ---

export interface SavedItem {
    id: string
    user_id: string
    target_type: string
    target_id: string
    collection_name: string
    created_at: string
}

export interface SavedCollection {
    name: string
    count: number
}

// --- About ---

export type AboutSection = "basic_info" | "contact" | "location" | "life_entry" | "interests" | "services"
export type AboutVisibility = "public" | "followers" | "friends" | "only_me"

export interface AboutItem {
    user_id: string
    section: AboutSection
    item_id: string
    data: Record<string, unknown>
    visibility: AboutVisibility
    sort_order: number
    created_at: string
    updated_at: string
}

export interface WorkData {
    company: string
    title: string
    start_year?: number
    end_year?: number | null
    is_current?: boolean
}

export interface EducationData {
    school: string
    degree?: string
    start_year?: number
    end_year?: number
}

export interface HobbyData {
    name: string
    description?: string
}

export type HobbyInterestType = "hobby" | "interest"

export interface HobbyInterestData {
    name: string
    type: HobbyInterestType
    category?: string
    description?: string
}

export interface HobbyInterestCategory {
    id: string
    label: string
    color: string
}

export interface FamilyData {
    relation: string
    name: string
    user_id?: string
}

export interface ContactData {
    type: string
    value: string
}

export interface LifeEventData {
    title: string
    description?: string
    date?: string
}

// --- Channels ---

export interface ChannelLink {
    id: string
    channel_id: string
    title: string
    url: string
    icon?: string
    sort_order: number
}

export interface ChannelMilestone {
    id: string
    channel_id: string
    title: string
    description?: string
    reached_at: string
    subscriber_count?: number
}

export interface Channel {
    id: string
    owner_id: string
    handle: string
    name: string
    description?: string
    avatar_media_id?: string
    banner_media_id?: string
    category?: string
    subscriber_count: number
    is_verified: boolean
    created_at: string
    updated_at: string
}

export interface ChannelDetail extends Channel {
    links: ChannelLink[]
    milestones: ChannelMilestone[]
}

// --- Business Pages ---

export interface BusinessPage {
    id: string
    owner_id: string
    handle: string
    name: string
    description?: string
    category?: string
    avatar_media_id?: string
    cover_media_id?: string
    phone?: string
    email?: string
    website?: string
    address?: string
    city?: string
    state?: string
    country?: string
    zip_code?: string
    latitude?: number
    longitude?: number
    hours?: Record<string, { open: string; close: string }>
    average_rating: number
    review_count: number
    is_verified: boolean
    created_at: string
    updated_at: string
}

export interface BusinessReview {
    id: string
    page_id: string
    author_id: string
    author_display_name?: string
    author_avatar_media_id?: string
    rating: number
    review_text: string
    created_at: string
    updated_at: string
}

// --- Reputation & Endorsements ---

export interface SkillEndorsementSummary {
    skill_tag: string
    count: number
    recent_endorsers: string[]
}

export interface UserReputation {
    user_id: string
    reputation: number
    endorsement_summary: SkillEndorsementSummary[]
}

export interface Endorsement {
    id: string
    endorser_id: string
    endorsee_id: string
    skill_tag: string
    message?: string
    endorser_display_name?: string
    endorser_avatar_media_id?: string
    created_at: string
}

// --- Status / Mood ---

export interface StatusMood {
    status_text: string
    status_emoji: string
    expires_at?: string | null
}

// --- Compatibility ---

export interface CompatibilityScore {
    user_id: string
    target_user_id: string
    compatibility_score: number
}

// --- Link Analytics ---

export interface LinkAnalytics {
    link_id: string
    platform: string
    total_clicks: number
    clicks_today: number
    clicks_this_week: number
    clicks_this_month: number
    top_referrers: { referrer: string; count: number }[]
}

// Badge flag constants (bitmask)
export const BADGE_VERIFIED = 1
export const BADGE_CREATOR = 2
export const BADGE_BUSINESS = 4

export function getBadges(flags: number): string[] {
    const badges: string[] = []
    if (flags & BADGE_VERIFIED) badges.push("verified")
    if (flags & BADGE_CREATOR) badges.push("creator")
    if (flags & BADGE_BUSINESS) badges.push("business")
    return badges
}
