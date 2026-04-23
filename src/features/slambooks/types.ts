export interface Slambook {
  id: string;
  owner_user_id: string;
  context_type: string;
  context_id?: string | null;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  category: string;
  theme_key: string;
  cover_media_id?: string | null;
  visibility: string;
  response_identity_mode: string;
  approval_required: boolean;
  allow_custom_cards: boolean;
  allow_reactions: boolean;
  allow_comments: boolean;
  allow_share_link: boolean;
  max_responses_per_user: number;
  opens_at: string;
  closes_at?: string | null;
  status: string;
  invited_count: number;
  response_count: number;
  approved_count: number;
  pinned_count: number;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  viewer_response_status?: string | null;
  viewer_session_id?: string | null;
  viewer_can_respond: boolean;
  viewer_can_moderate: boolean;
  share_token?: string | null;
}

export interface SlambookTemplatePack {
  id: string;
  key: string;
  title: string;
  description?: string | null;
  category: string;
  templates: SlambookTemplate[];
}

export interface SlambookTemplate {
  id: string;
  pack_id: string;
  title: string;
  prompt: string;
  response_type: string;
  placeholder_text?: string | null;
  help_text?: string | null;
  config: Record<string, unknown>;
  order_index: number;
}

export interface SlambookCardDraft {
  title: string;
  prompt: string;
  response_type: string;
  placeholder_text?: string;
  help_text?: string;
  is_required?: boolean;
}

export interface SlambookCard {
  id: string;
  slambook_id: string;
  source_type: string;
  template_id?: string | null;
  title: string;
  prompt: string;
  response_type: string;
  placeholder_text?: string | null;
  help_text?: string | null;
  config: Record<string, unknown>;
  is_required: boolean;
  is_active: boolean;
  locked_after_response: boolean;
  order_index: number;
  version_no: number;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  options: SlambookCardOption[];
}

export interface SlambookCardOption {
  id: string;
  card_id: string;
  label: string;
  value: string;
  order_index: number;
}

export interface SlambookInvite {
  id: string;
  slambook_id: string;
  inviter_user_id: string;
  invite_type: string;
  target_user_id?: string | null;
  target_email?: string | null;
  target_ref_id?: string | null;
  share_token?: string | null;
  message?: string | null;
  status: string;
  opened_at?: string | null;
  accepted_at?: string | null;
  declined_at?: string | null;
  expires_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SlambookResponseAnswerDraft {
  card_id: string;
  answer_text?: string;
  answer_json?: Record<string, unknown>;
}

export interface SlambookResponseItem {
  id: string;
  session_id: string;
  slambook_id: string;
  card_id: string;
  response_type: string;
  answer_text?: string | null;
  answer_json: Record<string, unknown>;
  media_asset_id?: string | null;
  card_title?: string | null;
  card_prompt?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SlambookResponseSession {
  id: string;
  slambook_id: string;
  invite_id?: string | null;
  responder_user_id?: string | null;
  display_name?: string | null;
  identity_mode: string;
  status: string;
  started_at: string;
  draft_last_saved_at?: string | null;
  submitted_at?: string | null;
  moderated_at?: string | null;
  moderated_by_user_id?: string | null;
  moderation_reason?: string | null;
  created_at: string;
  updated_at: string;
  items: SlambookResponseItem[];
}

export interface SlambookOpinionSpaceItem {
  id: string;
  slambook_id: string;
  session_id: string;
  response_item_id: string;
  status: string;
  is_pinned: boolean;
  board_section?: string | null;
  board_order: number;
  z_index: number;
  featured_badge?: string | null;
  owner_note?: string | null;
  approved_at?: string | null;
  hidden_reason?: string | null;
  created_at: string;
  updated_at: string;
  responder_display_name?: string | null;
  anonymous: boolean;
  card_title: string;
  card_prompt: string;
  response_type: string;
  answer_text?: string | null;
  answer_json: Record<string, unknown>;
}

export interface SlambookDetail {
  slambook: Slambook;
  cards: SlambookCard[];
  viewer_session?: SlambookResponseSession | null;
}

export interface CreateSlambookInput {
  title: string;
  subtitle?: string;
  description?: string;
  category?: string;
  theme_key?: string;
  visibility?: string;
  response_identity_mode?: string;
  approval_required?: boolean;
  template_pack_key?: string;
  closes_at?: string;
  custom_cards?: SlambookCardDraft[];
}

export interface SaveSlambookResponseInput {
  display_name?: string;
  anonymous?: boolean;
  share_token?: string;
  submit?: boolean;
  answers: SlambookResponseAnswerDraft[];
}
