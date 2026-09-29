import type { ChannelBranding, ChannelLink, FieldErrors } from "./model";

/* The props contract between the container (BrandingSettings) and the
   presentational screen (BrandingScreen + sections). Everything here is
   plain data and callbacks so the screen renders without providers. */

export type SectionId = "identity" | "links" | "featured" | "feed";

export const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "identity", label: "Identity" },
  { id: "links", label: "Links" },
  { id: "featured", label: "Featured" },
  { id: "feed", label: "RSS feed" },
];

export interface VideoRow {
  id: string;
  title: string;
  thumbnail_url: string;
  duration_seconds: number;
  published_at: string;
  view_count: number;
}

export type HandleAvailability =
  | { state: "idle" }
  | { state: "invalid" }
  | { state: "checking" }
  | { state: "available" }
  | { state: "taken"; suggestion?: string };

export interface IdentityProps {
  draft: ChannelBranding;
  errors: FieldErrors;
  avatarUrl?: string;
  bannerUrl?: string;
  uploading: { avatar: boolean; banner: boolean };
  availability: HandleAvailability;
  onChange: (field: "name" | "handle" | "about", value: string) => void;
  onPickAvatar: (file: File) => void;
  onRemoveAvatar: () => void;
  onPickBanner: (file: File) => void;
  onRemoveBanner: () => void;
}

export interface LinksProps {
  links: ChannelLink[];
  contactEmail: string;
  errors: FieldErrors;
  onLinkChange: (index: number, field: "title" | "url", value: string) => void;
  onAddLink: () => void;
  onRemoveLink: (index: number) => void;
  onMoveLink: (index: number, direction: "up" | "down") => void;
  onContactEmailChange: (value: string) => void;
}

export interface FeaturedProps {
  selectedId: string | null;
  /** The selected video when it is known; null while it loads or when none is set. */
  selected: VideoRow | null;
  videos: VideoRow[];
  query: string;
  onQuery: (value: string) => void;
  loading: boolean;
  hasMore: boolean;
  onMore: () => void;
  onSelect: (id: string | null) => void;
  error?: string;
}

export type FeedCopyTarget = "feed" | "podcasts";

/** The channel's RSS feed: read-only addresses, built from the saved handle (the user id until one is set). */
export interface FeedProps {
  feedUrl: string;
  /** The same feed narrowed to the Podcasts topic (`?category=podcasts`). */
  podcastsUrl: string;
  hasHandle: boolean;
  /** Which address was just copied; null when neither. */
  copied: FeedCopyTarget | null;
  onCopy: (target: FeedCopyTarget) => void;
}

export interface SaveBarProps {
  dirty: boolean;
  saving: boolean;
  changeCount: number;
  errorCount: number;
  pageMessage?: string;
  onSave: () => void;
  onReset: () => void;
}

export interface NoChannelProps {
  name: string;
  handle: string;
  availability: HandleAvailability;
  errors: FieldErrors;
  creating: boolean;
  pageMessage?: string;
  onChange: (field: "name" | "handle", value: string) => void;
  onCreate: () => void;
}

export type BrandingScreenProps =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "error"; message: string; onRetry: () => void }
  | { kind: "no-channel"; create: NoChannelProps }
  | {
      kind: "loaded";
      activeSection: SectionId;
      identity: IdentityProps;
      links: LinksProps;
      featured: FeaturedProps;
      feed: FeedProps;
      save: SaveBarProps;
    };
