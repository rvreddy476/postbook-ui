"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  BookHeart,
  CalendarClock,
  CheckCircle2,
  CircleHelp,
  ClipboardList,
  Copy,
  Eye,
  FilePenLine,
  Layers3,
  LayoutGrid,
  Link2,
  Loader2,
  Lock,
  MessageSquareQuote,
  NotebookPen,
  Pin,
  Plus,
  RefreshCw,
  Send,
  Shield,
  Sparkles,
  UserRoundPlus,
  Users,
  X,
} from "lucide-react";

import { Avatar } from "@/components/LetterAvatar";
import { EmptyTabState } from "@/components/profile/states/EmptyTabState";
import { ProfileSkeleton } from "@/components/profile/states/ProfileSkeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { useMyProfile } from "@/hooks/useEditProfile";
import { useBatchProfiles } from "@/hooks/useProfile";
import {
  archiveSlambook,
  createSlambook,
  createSlambookInvites,
  createSlambookShareLink,
  getSlambook,
  getSlambookByShareToken,
  listSlambookModerationQueue,
  listSlambookOpinionSpace,
  listSlambookTemplatePacks,
  listSlambooks,
  moderateSlambookSession,
  reorderSlambookOpinionItems,
  saveSlambookResponse,
  setSlambookOpinionPinned,
} from "@/features/slambooks/api";
import type {
  CreateSlambookInput,
  SaveSlambookResponseInput,
  SlambookCard,
  SlambookCardDraft,
  SlambookDetail,
  SlambookInvite,
  SlambookResponseAnswerDraft,
  SlambookTemplatePack,
} from "@/features/slambooks/types";
import {
  slambookAnswerPreview,
  slambookBoardPreview,
  slambookIdentityLabel,
  slambookRelativeDate,
  slambookVisibilityLabel,
} from "@/features/slambooks/utils";
import { searchUsers } from "@/services/userService";
import { getSession } from "@/services/authService";

const slambookKeys = {
  packs: ["slambooks", "packs"] as const,
  mine: (ownerId?: string) => ["slambooks", "mine", ownerId ?? "anonymous"] as const,
  detail: (slambookId: string) => ["slambooks", "detail", slambookId] as const,
  share: (token: string) => ["slambooks", "share", token] as const,
  opinion: (slambookId: string) => ["slambooks", "opinion", slambookId] as const,
  moderation: (slambookId: string) => ["slambooks", "moderation", slambookId] as const,
};

const visibilityOptions = [
  { value: "invited_only", label: "Invited Only" },
  { value: "private", label: "Private" },
  { value: "public", label: "Public" },
] as const;

const identityOptions = [
  { value: "named", label: "Named responses" },
  { value: "anonymous_allowed", label: "Anonymous allowed" },
  { value: "fully_anonymous", label: "Fully anonymous" },
] as const;

const responseTypeOptions = [
  { value: "text", label: "Text" },
  { value: "long_text", label: "Long text" },
] as const;

function formatDateTime(value?: string | null) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateOnly(value?: string | null) {
  if (!value) return "Open now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Open now";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function messageFromError(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { data?: { error?: { message?: string } } } }).response?.data
      ?.error?.message === "string"
  ) {
    return (error as { response: { data: { error: { message: string } } } }).response.data.error.message;
  }

  return "Something went wrong. Please try again.";
}

function getShareResponderId(token?: string) {
  if (typeof window === "undefined" || !token) {
    return undefined;
  }

  const sessionUserId = getSession()?.id;
  if (sessionUserId) {
    return sessionUserId;
  }

  const storageKey = `postbook_slambook_guest:${token}`;
  try {
    const existing = localStorage.getItem(storageKey);
    if (existing) {
      return existing;
    }

    const created =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `guest_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    localStorage.setItem(storageKey, created);
    return created;
  } catch {
    return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `guest_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}




function makeBlankCardDraft(): SlambookCardDraft {
  return {
    title: "",
    prompt: "",
    response_type: "text",
    placeholder_text: "",
    help_text: "",
    is_required: false,
  };
}

function hydrateResponseDrafts(detail: SlambookDetail) {
  const drafts: Record<string, string> = {};
  const sessionMap = new Map(
    (detail.viewer_session?.items ?? []).map((item) => [item.card_id, item]),
  );

  detail.cards.forEach((card) => {
    const item = sessionMap.get(card.id);
    const text = item?.answer_text?.trim();
    const values = item?.answer_json ? Object.values(item.answer_json) : [];
    drafts[card.id] = text || (values.length > 0 ? String(values[0]) : "");
  });

  return drafts;
}

function serializeAnswer(card: SlambookCard, value: string): SlambookResponseAnswerDraft {
  const trimmed = value.trim();

  if (card.response_type === "rating") {
    return {
      card_id: card.id,
      answer_text: trimmed,
      answer_json: trimmed ? { rating: Number(trimmed) || trimmed } : {},
    };
  }

  if (card.response_type === "yes_no" || card.options.length > 0 || card.response_type === "one_word") {
    return {
      card_id: card.id,
      answer_text: trimmed,
      answer_json: trimmed ? { value: trimmed } : {},
    };
  }

  return {
    card_id: card.id,
    answer_text: trimmed,
    answer_json: trimmed ? { value: trimmed } : {},
  };
}

function statusTone(status?: string | null) {
  switch (status) {
    case "approved":
    case "visible":
    case "active":
    case "submitted":
      return "bg-emerald-100 text-emerald-700";
    case "pending":
    case "draft":
      return "bg-amber-100 text-amber-700";
    case "archived":
    case "closed":
      return "bg-slate-100 text-slate-600";
    case "rejected":
    case "hidden":
      return "bg-rose-100 text-rose-600";
    default:
      return "bg-brand-secondary text-brand-highlight";
  }
}

function SlamMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-brand-divider bg-[#FAFAF8] px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-brand-text/50">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-[22px] font-bold text-brand-text">{value}</div>
    </div>
  );
}

function SlamSectionTitle({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-text/5 text-brand-text">
        {icon}
      </div>
      <div>
        <h2 className="text-[18px] font-bold text-brand-text">{title}</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-brand-text/60">{description}</p>
      </div>
    </div>
  );
}

function ResponseInputCard({
  card,
  value,
  disabled,
  onChange,
}: {
  card: SlambookCard;
  value: string;
  disabled: boolean;
  onChange: (next: string) => void;
}) {
  const helper = card.help_text?.trim();
  const placeholder = card.placeholder_text?.trim() || "Share your answer";

  return (
    <div className="rounded-2xl border border-brand-divider bg-[#FCFCFB] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[14px] font-semibold text-brand-text">{card.title}</h3>
        {card.is_required ? (
          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-600">
            Required
          </span>
        ) : null}
        <span className="rounded-full bg-brand-secondary px-2 py-0.5 text-[10px] font-bold uppercase text-brand-highlight">
          {card.response_type.replaceAll("_", " ")}
        </span>
      </div>

      <p className="mt-2 text-[13px] text-brand-text/75">{card.prompt}</p>
      {helper ? <p className="mt-1 text-[12px] text-brand-text/50">{helper}</p> : null}

      <div className="mt-4">
        {card.options.length > 0 ? (
          <select
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled}
            className="h-11 w-full rounded-xl border border-brand-divider bg-brand-card px-3 text-[13px] text-brand-text outline-none focus:border-brand-text/30 disabled:opacity-60"
          >
            <option value="">Choose an answer</option>
            {card.options.map((option) => (
              <option key={option.id} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : card.response_type === "yes_no" ? (
          <div className="flex gap-2">
            {["Yes", "No"].map((choice) => (
              <button
                key={choice}
                type="button"
                onClick={() => onChange(choice)}
                disabled={disabled}
                className={`rounded-xl border px-4 py-2 text-[13px] font-semibold transition-colors ${
                  value === choice
                    ? "border-brand-text bg-brand-text text-white"
                    : "border-brand-divider bg-brand-card text-brand-text hover:bg-brand-secondary"
                }`}
              >
                {choice}
              </button>
            ))}
          </div>
        ) : card.response_type === "rating" ? (
          <div className="grid grid-cols-5 gap-2 sm:flex sm:flex-wrap">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                type="button"
                onClick={() => onChange(String(rating))}
                disabled={disabled}
                className={`rounded-xl border px-4 py-2 text-[13px] font-semibold transition-colors ${
                  value === String(rating)
                    ? "border-brand-text bg-brand-text text-white"
                    : "border-brand-divider bg-brand-card text-brand-text hover:bg-brand-secondary"
                }`}
              >
                {rating}
              </button>
            ))}
          </div>
        ) : card.response_type === "one_word" ? (
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled}
            maxLength={32}
            placeholder={placeholder}
            className="h-11 w-full rounded-xl border border-brand-divider bg-brand-card px-3 text-[13px] text-brand-text outline-none focus:border-brand-text/30 disabled:opacity-60"
          />
        ) : (
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled}
            rows={4}
            placeholder={placeholder}
            className="w-full rounded-2xl border border-brand-divider bg-brand-card px-4 py-3 text-[13px] text-brand-text outline-none focus:border-brand-text/30 disabled:opacity-60"
          />
        )}
      </div>
    </div>
  );
}

export function SlamBookMemoriesHub() {
  const { data: myProfile, isLoading: profileLoading } = useMyProfile();

  const slambooksQuery = useQuery({
    queryKey: slambookKeys.mine(myProfile?.id),
    queryFn: () => listSlambooks(myProfile!.id),
    enabled: !!myProfile?.id,
    staleTime: 20_000,
  });

  const templateQuery = useQuery({
    queryKey: slambookKeys.packs,
    queryFn: listSlambookTemplatePacks,
    staleTime: 60_000,
  });

  const recentSlambooks = slambooksQuery.data?.slice(0, 3) ?? [];

  if (profileLoading) {
    return <ProfileSkeleton />;
  }

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-8">
      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="overflow-hidden border-brand-divider/70 bg-gradient-to-br from-[#fff6e8] via-brand-card to-[#fffdf7]">
          <CardContent className="px-8 py-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#E9C98C] bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#8a5d08]">
              <BookHeart className="h-3.5 w-3.5" />
              Memories Hub
            </div>
            <h1 className="mt-5 max-w-2xl text-[32px] font-bold leading-tight text-brand-text">
              SlamBooks turn profile memories into a living opinion board.
            </h1>
            <p className="mt-4 max-w-2xl text-[14px] leading-7 text-brand-text/70">
              Create a themed question set, invite people directly or by share link, collect
              thoughtful answers, and curate the best responses into a visible board.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/memories/slambooks">
                <Button size="lg" className="rounded-2xl">
                  <NotebookPen className="h-4 w-4" />
                  Open SlamBooks
                </Button>
              </Link>
              <Link href="/memories/slambooks">
                <Button size="lg" variant="outline" className="rounded-2xl">
                  <Sparkles className="h-4 w-4" />
                  Start a new one
                </Button>
              </Link>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <SlamMetric
                label="SlamBooks"
                value={slambooksQuery.data?.length ?? 0}
                icon={<Layers3 className="h-3.5 w-3.5" />}
              />
              <SlamMetric
                label="Template Packs"
                value={templateQuery.data?.length ?? 0}
                icon={<ClipboardList className="h-3.5 w-3.5" />}
              />
              <SlamMetric
                label="Approved Replies"
                value={(slambooksQuery.data ?? []).reduce((sum, item) => sum + item.approved_count, 0)}
                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[16px]">
              <LayoutGrid className="h-4 w-4 text-brand-text/60" />
              Your recent SlamBooks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {slambooksQuery.isLoading ? (
              <div className="flex items-center gap-2 text-[13px] text-brand-text/60">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading your SlamBooks...
              </div>
            ) : recentSlambooks.length > 0 ? (
              recentSlambooks.map((item) => (
                <Link
                  key={item.id}
                  href={`/memories/slambooks/${item.id}`}
                  className="block rounded-2xl border border-brand-divider bg-[#FAFAF8] p-4 transition-colors hover:bg-brand-secondary"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusTone(item.status)}`}>
                          {item.status}
                        </span>
                        <span className="text-[10px] uppercase tracking-[0.14em] text-brand-text/50">
                          {slambookVisibilityLabel(item.visibility)}
                        </span>
                      </div>
                      <p className="mt-2 truncate text-[15px] font-semibold text-brand-text">{item.title}</p>
                      <p className="mt-1 line-clamp-2 text-[12px] text-brand-text/60">
                        {item.description || "No description yet."}
                      </p>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-brand-text/35" />
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-brand-text/50">
                    <span>{item.response_count} responses</span>
                    <span>{item.approved_count} approved</span>
                    <span>Updated {slambookRelativeDate(item.last_activity_at)}</span>
                  </div>
                </Link>
              ))
            ) : (
              <EmptyTabState
                icon={<BookHeart />}
                title="No SlamBooks yet"
                description="Open the SlamBooks space to create your first profile memory board."
                actionLabel="Go to SlamBooks"
                onAction={() => {
                  window.location.href = "/memories/slambooks";
                }}
                className="py-8"
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardContent className="px-6 py-6">
            <SlamSectionTitle
              title="Compose"
              description="Pick a template pack, add custom prompts, and decide whether replies stay named or anonymous."
              icon={<FilePenLine className="h-5 w-5" />}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-6 py-6">
            <SlamSectionTitle
              title="Invite"
              description="Share a secure token link or send direct invites to specific user IDs without leaving the workspace."
              icon={<UserRoundPlus className="h-5 w-5" />}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-6 py-6">
            <SlamSectionTitle
              title="Curate"
              description="Approve or reject incoming responses, then pin and reorder your opinion board to shape the final story."
              icon={<Shield className="h-5 w-5" />}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function SlamBookIndexRouteView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast, ToastContainer } = useToast();
  const { data: myProfile, isLoading: profileLoading } = useMyProfile();

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("personal");
  const [themeKey, setThemeKey] = useState("classic");
  const [visibility, setVisibility] = useState("invited_only");
  const [identityMode, setIdentityMode] = useState("named");
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [templatePackKey, setTemplatePackKey] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [customCards, setCustomCards] = useState<SlambookCardDraft[]>([]);

  const packsQuery = useQuery({
    queryKey: slambookKeys.packs,
    queryFn: listSlambookTemplatePacks,
    staleTime: 60_000,
  });

  const mySlambooksQuery = useQuery({
    queryKey: slambookKeys.mine(myProfile?.id),
    queryFn: () => listSlambooks(myProfile!.id),
    enabled: !!myProfile?.id,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (identityMode === "anonymous") {
      setApprovalRequired(true);
    }
  }, [identityMode]);

  const createMutation = useMutation({
    mutationFn: (input: CreateSlambookInput) => createSlambook(input),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: slambookKeys.mine(myProfile?.id) });
      toast({
        type: "success",
        title: "SlamBook created",
        description: "Your new SlamBook is ready for invites and responses.",
      });
      router.push(`/memories/slambooks/${created.id}`);
    },
  });

  const selectedPack = packsQuery.data?.find((pack) => pack.key === templatePackKey) ?? null;

  const handleCreate = () => {
    createMutation.mutate({
      title: title.trim(),
      subtitle: subtitle.trim(),
      description: description.trim(),
      category: category.trim() || "personal",
      theme_key: themeKey.trim() || "classic",
      visibility,
      response_identity_mode: identityMode,
      approval_required: approvalRequired,
      template_pack_key: templatePackKey,
      closes_at: closesAt ? new Date(closesAt).toISOString() : undefined,
      custom_cards: customCards.filter((card) => card.title?.trim() || card.prompt?.trim()),
    });
  };

  if (profileLoading) {
    return <ProfileSkeleton />;
  }

  return (
    <div className="mx-auto max-w-[1260px] px-6 py-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-text/45">
            SlamBook Studio
          </p>
          <h1 className="mt-2 text-[28px] font-bold text-brand-text">Create and manage SlamBooks</h1>
          <p className="mt-2 max-w-3xl text-[14px] text-brand-text/65">
            Build a v1 SlamBook from template packs and custom prompts, then open invites, collect
            responses, moderate submissions, and shape the opinion board.
          </p>
        </div>
        <Link href="/memories">
          <Button variant="outline" className="rounded-2xl">
            <ArrowLeft className="h-4 w-4" />
            Back to memories
          </Button>
        </Link>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[16px]">
                <FilePenLine className="h-4 w-4 text-brand-text/60" />
                New SlamBook
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-[12px] font-semibold text-brand-highlight">
                    Title
                  </label>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={140}
                    className="h-11 w-full rounded-xl border border-brand-divider bg-brand-card px-3 text-[13px] text-brand-text outline-none focus:border-brand-text/30"
                    placeholder="My classmates, roommates, travel crew..."
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold text-brand-highlight">
                    Subtitle
                  </label>
                  <input
                    value={subtitle}
                    onChange={(event) => setSubtitle(event.target.value)}
                    maxLength={140}
                    className="h-11 w-full rounded-xl border border-brand-divider bg-brand-card px-3 text-[13px] text-brand-text outline-none focus:border-brand-text/30"
                    placeholder="Optional vibe line"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold text-brand-highlight">
                    Category
                  </label>
                  <input
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    maxLength={40}
                    className="h-11 w-full rounded-xl border border-brand-divider bg-brand-card px-3 text-[13px] text-brand-text outline-none focus:border-brand-text/30"
                    placeholder="personal"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-[12px] font-semibold text-brand-highlight">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={4}
                    className="w-full rounded-2xl border border-brand-divider bg-brand-card px-4 py-3 text-[13px] text-brand-text outline-none focus:border-brand-text/30"
                    placeholder="Tell people what kind of memory space this is and what tone you want in answers."
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold text-brand-highlight">
                    Theme key
                  </label>
                  <input
                    value={themeKey}
                    onChange={(event) => setThemeKey(event.target.value)}
                    maxLength={40}
                    className="h-11 w-full rounded-xl border border-brand-divider bg-brand-card px-3 text-[13px] text-brand-text outline-none focus:border-brand-text/30"
                    placeholder="classic"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold text-brand-highlight">
                    Closes at
                  </label>
                  <input
                    type="datetime-local"
                    value={closesAt}
                    onChange={(event) => setClosesAt(event.target.value)}
                    className="h-11 w-full rounded-xl border border-brand-divider bg-brand-card px-3 text-[13px] text-brand-text outline-none focus:border-brand-text/30"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold text-brand-highlight">
                    Visibility
                  </label>
                  <select
                    value={visibility}
                    onChange={(event) => setVisibility(event.target.value)}
                    className="h-11 w-full rounded-xl border border-brand-divider bg-brand-card px-3 text-[13px] text-brand-text outline-none focus:border-brand-text/30"
                  >
                    {visibilityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold text-brand-highlight">
                    Response identity
                  </label>
                  <select
                    value={identityMode}
                    onChange={(event) => setIdentityMode(event.target.value)}
                    className="h-11 w-full rounded-xl border border-brand-divider bg-brand-card px-3 text-[13px] text-brand-text outline-none focus:border-brand-text/30"
                  >
                    {identityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-brand-divider bg-[#FAFAF8] px-4 py-3 text-[13px] text-brand-text">
                <input
                  type="checkbox"
                  checked={approvalRequired}
                  onChange={(event) => setApprovalRequired(event.target.checked)}
                  className="h-4 w-4 rounded border-brand-divider"
                />
                Require approval before responses appear on the opinion board
              </label>

              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-semibold text-brand-text">Template packs</p>
                    <p className="text-[12px] text-brand-text/55">
                      Start from a pack or combine it with custom cards.
                    </p>
                  </div>
                  {templatePackKey ? (
                    <button
                      type="button"
                      onClick={() => setTemplatePackKey("")}
                      className="text-[12px] font-semibold text-brand-text/55 transition-colors hover:text-brand-text"
                    >
                      Clear selection
                    </button>
                  ) : null}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {(packsQuery.data ?? []).map((pack) => {
                    const active = pack.key === templatePackKey;

                    return (
                      <button
                        key={pack.id}
                        type="button"
                        onClick={() => setTemplatePackKey(active ? "" : pack.key)}
                        className={`rounded-2xl border p-4 text-left transition-colors ${
                          active
                            ? "border-brand-text bg-brand-text/5"
                            : "border-brand-divider bg-[#FAFAF8] hover:bg-brand-secondary"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[14px] font-semibold text-brand-text">{pack.title}</p>
                            <p className="mt-1 text-[12px] uppercase tracking-[0.14em] text-brand-text/45">
                              {pack.category}
                            </p>
                          </div>
                          {active ? (
                            <span className="rounded-full bg-brand-text px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                              Selected
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-3 text-[12px] leading-relaxed text-brand-text/60">
                          {pack.description || `${pack.templates.length} starter prompts`}
                        </p>
                        <ul className="mt-3 space-y-1 text-[12px] text-brand-text/55">
                          {pack.templates.slice(0, 3).map((template) => (
                            <li key={template.id}>• {template.prompt}</li>
                          ))}
                        </ul>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-brand-divider bg-[#FCFCFB] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-semibold text-brand-text">Custom cards</p>
                    <p className="text-[12px] text-brand-text/55">
                      Add extra prompts that are unique to this SlamBook.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setCustomCards((current) => [...current, makeBlankCardDraft()])}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add card
                  </Button>
                </div>

                {customCards.length > 0 ? (
                  <div className="space-y-3">
                    {customCards.map((card, index) => (
                      <div key={`custom-card-${index}`} className="rounded-2xl border border-brand-divider bg-white p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-text/50">
                            Custom card {index + 1}
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              setCustomCards((current) => current.filter((_, cardIndex) => cardIndex !== index))
                            }
                            className="rounded-lg p-1 text-brand-text/40 transition-colors hover:bg-brand-secondary hover:text-brand-text"
                            aria-label={`Remove custom card ${index + 1}`}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <input
                            value={card.title ?? ""}
                            onChange={(event) =>
                              setCustomCards((current) =>
                                current.map((entry, cardIndex) =>
                                  cardIndex === index ? { ...entry, title: event.target.value } : entry,
                                ),
                              )
                            }
                            className="h-10 rounded-xl border border-brand-divider bg-brand-card px-3 text-[13px] text-brand-text outline-none focus:border-brand-text/30"
                            placeholder="Card title"
                          />
                          <select
                            value={card.response_type}
                            onChange={(event) =>
                              setCustomCards((current) =>
                                current.map((entry, cardIndex) =>
                                  cardIndex === index
                                    ? { ...entry, response_type: event.target.value }
                                    : entry,
                                ),
                              )
                            }
                            className="h-10 rounded-xl border border-brand-divider bg-brand-card px-3 text-[13px] text-brand-text outline-none focus:border-brand-text/30"
                          >
                            {responseTypeOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <textarea
                            value={card.prompt ?? ""}
                            onChange={(event) =>
                              setCustomCards((current) =>
                                current.map((entry, cardIndex) =>
                                  cardIndex === index ? { ...entry, prompt: event.target.value } : entry,
                                ),
                              )
                            }
                            rows={3}
                            className="md:col-span-2 rounded-2xl border border-brand-divider bg-brand-card px-4 py-3 text-[13px] text-brand-text outline-none focus:border-brand-text/30"
                            placeholder="Question prompt"
                          />
                          <input
                            value={card.placeholder_text ?? ""}
                            onChange={(event) =>
                              setCustomCards((current) =>
                                current.map((entry, cardIndex) =>
                                  cardIndex === index
                                    ? { ...entry, placeholder_text: event.target.value }
                                    : entry,
                                ),
                              )
                            }
                            className="h-10 rounded-xl border border-brand-divider bg-brand-card px-3 text-[13px] text-brand-text outline-none focus:border-brand-text/30"
                            placeholder="Placeholder text"
                          />
                          <input
                            value={card.help_text ?? ""}
                            onChange={(event) =>
                              setCustomCards((current) =>
                                current.map((entry, cardIndex) =>
                                  cardIndex === index ? { ...entry, help_text: event.target.value } : entry,
                                ),
                              )
                            }
                            className="h-10 rounded-xl border border-brand-divider bg-brand-card px-3 text-[13px] text-brand-text outline-none focus:border-brand-text/30"
                            placeholder="Helper text"
                          />
                          <label className="md:col-span-2 flex items-center gap-3 rounded-xl border border-brand-divider bg-[#FAFAF8] px-3 py-2 text-[12px] text-brand-text">
                            <input
                              type="checkbox"
                              checked={!!card.is_required}
                              onChange={(event) =>
                                setCustomCards((current) =>
                                  current.map((entry, cardIndex) =>
                                    cardIndex === index ? { ...entry, is_required: event.target.checked } : entry,
                                  ),
                                )
                              }
                              className="h-4 w-4 rounded border-brand-divider"
                            />
                            Required answer
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px] text-brand-text/55">
                    No custom cards yet. Add one if you want prompts beyond the template pack.
                  </p>
                )}
              </div>

              {createMutation.error ? (
                <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-600">
                  {messageFromError(createMutation.error)}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  size="lg"
                  className="rounded-2xl"
                  onClick={handleCreate}
                  disabled={!title.trim() || createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Create SlamBook
                </Button>
                <p className="text-[12px] text-brand-text/50">
                  {selectedPack
                    ? `${selectedPack.templates.length} pack prompts selected`
                    : "Create from scratch or start from a pack"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[16px]">
                <Layers3 className="h-4 w-4 text-brand-text/60" />
                Your SlamBooks
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {mySlambooksQuery.isLoading ? (
                <div className="flex items-center gap-2 text-[13px] text-brand-text/60">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading your list...
                </div>
              ) : (mySlambooksQuery.data ?? []).length > 0 ? (
                (mySlambooksQuery.data ?? []).map((item) => (
                  <Link
                    key={item.id}
                    href={`/memories/slambooks/${item.id}`}
                    className="block rounded-2xl border border-brand-divider bg-[#FAFAF8] p-4 transition-colors hover:bg-brand-secondary"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusTone(item.status)}`}>
                            {item.status}
                          </span>
                          <span className="text-[10px] uppercase tracking-[0.14em] text-brand-text/50">
                            {slambookIdentityLabel(item.response_identity_mode)}
                          </span>
                        </div>
                        <p className="mt-2 truncate text-[15px] font-semibold text-brand-text">{item.title}</p>
                        <p className="mt-1 text-[12px] text-brand-text/60">
                          {item.subtitle || item.description || "No subtitle"}
                        </p>
                      </div>
                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-brand-text/35" />
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-brand-text/50">
                      <span>{item.invited_count} invited</span>
                      <span>{item.response_count} responses</span>
                      <span>{item.approved_count} approved</span>
                      <span>{item.pinned_count} pinned</span>
                    </div>
                  </Link>
                ))
              ) : (
                <EmptyTabState
                  icon={<NotebookPen />}
                  title="Nothing created yet"
                  description="Fill out the form on the left to publish your first SlamBook."
                  className="py-8"
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[16px]">
                <ClipboardList className="h-4 w-4 text-brand-text/60" />
                Pack preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedPack ? (
                <div className="space-y-3">
                  <p className="text-[14px] font-semibold text-brand-text">{selectedPack.title}</p>
                  <p className="text-[12px] text-brand-text/60">
                    {selectedPack.description || "This pack supplies the starting question set."}
                  </p>
                  <div className="space-y-2">
                    {selectedPack.templates.map((template) => (
                      <div key={template.id} className="rounded-xl border border-brand-divider bg-[#FAFAF8] px-3 py-3">
                        <p className="text-[12px] font-semibold text-brand-text">{template.title}</p>
                        <p className="mt-1 text-[12px] text-brand-text/60">{template.prompt}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyTabState
                  icon={<CircleHelp />}
                  title="No pack selected"
                  description="Pick a template pack to preview the starter prompts before you create."
                  className="py-8"
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ToastContainer />
    </div>
  );
}

function SlamBookWorkspace({
  slambookId,
  shareToken,
  openedFromShare,
}: {
  slambookId?: string;
  shareToken?: string;
  openedFromShare: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast, ToastContainer } = useToast();
  const sessionUserId = getSession()?.id;
  const shareResponderId = useMemo(
    () => (openedFromShare ? getShareResponderId(shareToken) : sessionUserId),
    [openedFromShare, sessionUserId, shareToken],
  );
  const { data: myProfile, isLoading: profileLoading } = useMyProfile({
    enabled: !openedFromShare || !!sessionUserId,
  });

  const [displayName, setDisplayName] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [responseDrafts, setResponseDrafts] = useState<Record<string, string>>({});
  const [shareInvite, setShareInvite] = useState<SlambookInvite | null>(null);
  const [inviteSearchQuery, setInviteSearchQuery] = useState("");
  const [selectedInviteUserIds, setSelectedInviteUserIds] = useState<string[]>([]);
  const [inviteMessage, setInviteMessage] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [moderationReasons, setModerationReasons] = useState<Record<string, string>>({});

  const hydratedKeyRef = useRef("");

  const detailQuery = useQuery({
    queryKey: shareToken
      ? [...slambookKeys.share(shareToken), shareResponderId ?? "public"]
      : slambookKeys.detail(slambookId ?? ""),
    queryFn: () =>
      shareToken
        ? getSlambookByShareToken(shareToken, shareResponderId)
        : getSlambook(slambookId!),
    enabled: !!shareToken || !!slambookId,
    staleTime: 10_000,
  });

  const slambook = detailQuery.data?.slambook;
  const workspaceId = slambook?.id ?? slambookId ?? "";
  const isOwner = !!myProfile?.id && !!slambook?.owner_user_id && myProfile.id === slambook.owner_user_id;
  const canModerate = !!slambook && (slambook.viewer_can_moderate || isOwner);
  const viewerSession = detailQuery.data?.viewer_session ?? null;

  const opinionQuery = useQuery({
    queryKey: slambook?.id ? slambookKeys.opinion(slambook.id) : ["slambooks", "opinion", "idle"],
    queryFn: () => listSlambookOpinionSpace(slambook!.id, shareResponderId),
    enabled: !!slambook?.id && (!openedFromShare || slambook.visibility === "public"),
    staleTime: 5_000,
  });

  const moderationQuery = useQuery({
    queryKey: slambook?.id ? slambookKeys.moderation(slambook.id) : ["slambooks", "moderation", "idle"],
    queryFn: () => listSlambookModerationQueue(slambook!.id),
    enabled: !!slambook?.id && canModerate,
    staleTime: 5_000,
  });

  const hydrateKey = `${detailQuery.data?.slambook.id ?? "none"}:${viewerSession?.id ?? "viewer"}`;

  useEffect(() => {
    if (!detailQuery.data || hydratedKeyRef.current === hydrateKey) {
      return;
    }

    hydratedKeyRef.current = hydrateKey;
    setResponseDrafts(hydrateResponseDrafts(detailQuery.data));
    setDisplayName(
      viewerSession?.display_name?.trim() ||
        myProfile?.display_name ||
        myProfile?.username ||
        "",
    );
    setAnonymous(viewerSession?.identity_mode === "anonymous");
  }, [detailQuery.data, hydrateKey, myProfile?.display_name, myProfile?.username, viewerSession?.display_name, viewerSession?.identity_mode]);

  const pendingSessions = moderationQuery.data ?? [];
  const opinionItems = useMemo(
    () => [...(opinionQuery.data ?? [])].sort((left, right) => left.board_order - right.board_order),
    [opinionQuery.data],
  );

  const resolvedProfileIds = useMemo(
    () =>
      Array.from(
        new Set(
          [
            slambook?.owner_user_id,
            ...pendingSessions.map((session) => session.responder_user_id),
          ].filter((value): value is string => !!value),
        ),
      ),
    [pendingSessions, slambook?.owner_user_id],
  );
  const profilesQuery = useBatchProfiles(resolvedProfileIds);

  const inviteProfilesQuery = useBatchProfiles(selectedInviteUserIds);
  const inviteSearchResultsQuery = useQuery({
    queryKey: ["slambooks", "invite-search", inviteSearchQuery],
    queryFn: () => searchUsers(inviteSearchQuery.trim(), 8),
    enabled: canModerate && inviteSearchQuery.trim().length >= 2,
    staleTime: 15_000,
  });
  const inviteSearchResults = useMemo(
    () =>
      (inviteSearchResultsQuery.data ?? []).filter(
        (user) =>
          !!user.id &&
          !selectedInviteUserIds.includes(user.id) &&
          user.id !== myProfile?.id,
      ),
    [inviteSearchResultsQuery.data, myProfile?.id, selectedInviteUserIds],
  );

  const responseEditable = !!slambook && !isOwner && (slambook.viewer_can_respond || viewerSession?.status === "draft" || !!shareToken);
  const cards = detailQuery.data?.cards ?? [];
  const missingRequired = cards.filter((card) => card.is_required && !responseDrafts[card.id]?.trim());

  const refreshWorkspace = async () => {
    const tasks: Promise<unknown>[] = [];

    if (shareToken) {
      tasks.push(queryClient.invalidateQueries({ queryKey: slambookKeys.share(shareToken) }));
    }
    if (slambookId) {
      tasks.push(queryClient.invalidateQueries({ queryKey: slambookKeys.detail(slambookId) }));
    }
    if (slambook?.id) {
      tasks.push(queryClient.invalidateQueries({ queryKey: slambookKeys.detail(slambook.id) }));
      tasks.push(queryClient.invalidateQueries({ queryKey: slambookKeys.opinion(slambook.id) }));
      tasks.push(queryClient.invalidateQueries({ queryKey: slambookKeys.moderation(slambook.id) }));
    }
    if (myProfile?.id) {
      tasks.push(queryClient.invalidateQueries({ queryKey: slambookKeys.mine(myProfile.id) }));
    }

    await Promise.all(tasks);
  };

  const responseMutation = useMutation({
    mutationFn: (input: SaveSlambookResponseInput) => saveSlambookResponse(workspaceId, input, shareResponderId),
    onSuccess: async (_session, input) => {
      await refreshWorkspace();
      toast({
        type: "success",
        title: input.submit ? "Response submitted" : "Draft saved",
        description: input.submit
          ? "Your answers are now in moderation or on the board, depending on the SlamBook rules."
          : "Your draft is saved for later.",
      });
    },
  });

  const shareLinkMutation = useMutation({
    mutationFn: () => createSlambookShareLink(workspaceId),
    onSuccess: (invite) => {
      setShareInvite(invite);
      toast({
        type: "success",
        title: "Share link ready",
        description: "Copy the link and send it to people you want answering this SlamBook.",
      });
    },
  });

  const directInviteMutation = useMutation({
    mutationFn: () =>
      createSlambookInvites(
        workspaceId,
        selectedInviteUserIds,
        inviteMessage.trim() || undefined,
      ),
    onSuccess: async (items) => {
      setInviteSearchQuery("");
      setSelectedInviteUserIds([]);
      setInviteMessage("");
      await refreshWorkspace();
      toast({
        type: "success",
        title: "Invites sent",
        description: `${items.length} direct invite${items.length === 1 ? "" : "s"} created.`,
      });
    },
  });

  const moderationMutation = useMutation({
    mutationFn: (input: { sessionId: string; action: string; reason?: string }) =>
      moderateSlambookSession(workspaceId, input.sessionId, input.action, input.reason),
    onSuccess: async (_result, input) => {
      await refreshWorkspace();
      toast({
        type: "success",
        title: `Response ${input.action}`,
      });
    },
  });

  const pinMutation = useMutation({
    mutationFn: (input: { itemId: string; pinned: boolean }) =>
      setSlambookOpinionPinned(workspaceId, input.itemId, input.pinned),
    onSuccess: async (_result, input) => {
      await refreshWorkspace();
      toast({
        type: "success",
        title: input.pinned ? "Pinned on board" : "Removed pin",
      });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (itemIds: string[]) => reorderSlambookOpinionItems(workspaceId, itemIds),
    onSuccess: async () => {
      await refreshWorkspace();
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => archiveSlambook(workspaceId),
    onSuccess: async () => {
      await refreshWorkspace();
      toast({
        type: "success",
        title: "SlamBook archived",
      });
      router.push("/memories/slambooks");
    },
  });

  const shareUrl = shareInvite?.share_token
    ? `/memories/slambooks/share/${shareInvite.share_token}`
    : slambook?.share_token
      ? `/memories/slambooks/share/${slambook.share_token}`
      : null;

  const ownerProfile = slambook?.owner_user_id ? profilesQuery.data?.get(slambook.owner_user_id) : undefined;
  const ownerLabel = ownerProfile?.display_name || ownerProfile?.username || slambook?.owner_user_id || "Owner";

  const handleCopyShareLink = async () => {
    if (!shareUrl) {
      shareLinkMutation.mutate();
      return;
    }

    const url =
      typeof window === "undefined"
        ? shareUrl
        : `${window.location.origin}${shareUrl}`;
    await navigator.clipboard.writeText(url);
    toast({ type: "success", title: "Share link copied" });
  };

  const handleAddInviteUser = (userId: string) => {
    if (!userId || selectedInviteUserIds.includes(userId)) {
      return;
    }
    setSelectedInviteUserIds((current) => [...current, userId]);
    setInviteSearchQuery("");
  };

  const handleRemoveInviteUser = (userId: string) => {
    setSelectedInviteUserIds((current) => current.filter((value) => value !== userId));
  };

  const handleMoveOpinionItem = (itemId: string, direction: -1 | 1) => {
    const currentIndex = opinionItems.findIndex((item) => item.id === itemId);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= opinionItems.length) {
      return;
    }

    const next = [...opinionItems];
    const [removed] = next.splice(currentIndex, 1);
    next.splice(targetIndex, 0, removed);
    reorderMutation.mutate(next.map((item) => item.id));
  };

  if (profileLoading || detailQuery.isLoading) {
    return <ProfileSkeleton />;
  }

  if (detailQuery.error || !slambook) {
    return (
      <div className="mx-auto max-w-[900px] px-6 py-10">
        <EmptyTabState
          icon={<CircleHelp />}
          title="SlamBook unavailable"
          description={detailQuery.error ? messageFromError(detailQuery.error) : "This SlamBook could not be loaded."}
          actionLabel="Back to SlamBooks"
          onAction={() => {
            window.location.href = "/memories/slambooks";
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/memories/slambooks"
              className="inline-flex items-center gap-2 rounded-full border border-brand-divider bg-brand-card px-3 py-1.5 text-[11px] font-semibold text-brand-highlight transition-colors hover:bg-brand-secondary"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to list
            </Link>
            <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase ${statusTone(slambook.status)}`}>
              {slambook.status}
            </span>
            {openedFromShare ? (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold uppercase text-amber-700">
                Opened via share link
              </span>
            ) : null}
          </div>
          <h1 className="mt-4 text-[30px] font-bold text-brand-text">{slambook.title}</h1>
          <p className="mt-2 max-w-3xl text-[14px] leading-7 text-brand-text/65">
            {slambook.description || slambook.subtitle || "This SlamBook is ready for responses and board curation."}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-[12px] text-brand-text/50">
            <span>Hosted by {ownerLabel}</span>
            <span>{slambookVisibilityLabel(slambook.visibility)}</span>
            <span>{slambookIdentityLabel(slambook.response_identity_mode)}</span>
            <span>Opened {formatDateOnly(slambook.opens_at)}</span>
            {slambook.closes_at ? <span>Closes {formatDateOnly(slambook.closes_at)}</span> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {shareUrl ? (
            <Button variant="outline" className="rounded-2xl" onClick={handleCopyShareLink}>
              <Copy className="h-4 w-4" />
              Copy share link
            </Button>
          ) : null}
          {isOwner ? (
            <Button variant="outline" className="rounded-2xl" onClick={() => setArchiveOpen(true)}>
              <Archive className="h-4 w-4" />
              Archive
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-4">
            <SlamMetric label="Invited" value={slambook.invited_count} icon={<Users className="h-3.5 w-3.5" />} />
            <SlamMetric label="Responses" value={slambook.response_count} icon={<MessageSquareQuote className="h-3.5 w-3.5" />} />
            <SlamMetric label="Approved" value={slambook.approved_count} icon={<Eye className="h-3.5 w-3.5" />} />
            <SlamMetric label="Pinned" value={slambook.pinned_count} icon={<Pin className="h-3.5 w-3.5" />} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[16px]">
                <ClipboardList className="h-4 w-4 text-brand-text/60" />
                Prompt deck
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {cards.map((card) => (
                  <div key={card.id} className="rounded-2xl border border-brand-divider bg-[#FAFAF8] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[14px] font-semibold text-brand-text">{card.title}</p>
                      {card.is_required ? (
                        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-600">
                          Required
                        </span>
                      ) : null}
                      <span className="rounded-full bg-brand-secondary px-2 py-0.5 text-[10px] font-bold uppercase text-brand-highlight">
                        {card.response_type.replaceAll("_", " ")}
                      </span>
                    </div>
                    <p className="mt-2 text-[13px] leading-relaxed text-brand-text/70">{card.prompt}</p>
                    {card.help_text ? <p className="mt-1 text-[12px] text-brand-text/50">{card.help_text}</p> : null}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[16px]">
                <NotebookPen className="h-4 w-4 text-brand-text/60" />
                Your response
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {responseEditable ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-[12px] font-semibold text-brand-highlight">
                        Display name
                      </label>
                      <input
                        value={displayName}
                        onChange={(event) => setDisplayName(event.target.value)}
                        disabled={anonymous}
                        placeholder="How should this response be credited?"
                        className="h-11 w-full rounded-xl border border-brand-divider bg-brand-card px-3 text-[13px] text-brand-text outline-none focus:border-brand-text/30 disabled:opacity-60"
                      />
                    </div>
                    <label className="flex items-center gap-3 rounded-2xl border border-brand-divider bg-[#FAFAF8] px-4 py-3 text-[13px] text-brand-text">
                      <input
                        type="checkbox"
                        checked={anonymous}
                        onChange={(event) => setAnonymous(event.target.checked)}
                        className="h-4 w-4 rounded border-brand-divider"
                      />
                      Submit this response anonymously
                    </label>
                  </div>

                  {cards.map((card) => (
                    <ResponseInputCard
                      key={card.id}
                      card={card}
                      value={responseDrafts[card.id] ?? ""}
                      disabled={responseMutation.isPending}
                      onChange={(next) =>
                        setResponseDrafts((current) => ({
                          ...current,
                          [card.id]: next,
                        }))
                      }
                    />
                  ))}

                  {responseMutation.error ? (
                    <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-600">
                      {messageFromError(responseMutation.error)}
                    </p>
                  ) : null}

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[12px] text-brand-text/55">
                      {missingRequired.length > 0
                        ? `${missingRequired.length} required answer${missingRequired.length === 1 ? "" : "s"} still missing`
                        : "All required answers are filled"}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-2xl"
                        disabled={responseMutation.isPending}
                        onClick={() =>
                          responseMutation.mutate({
                            display_name: displayName.trim(),
                            anonymous,
                            share_token: shareToken,
                            submit: false,
                            answers: cards.map((card) => serializeAnswer(card, responseDrafts[card.id] ?? "")),
                          })
                        }
                      >
                        {responseMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        Save draft
                      </Button>
                      <Button
                        type="button"
                        className="rounded-2xl"
                        disabled={responseMutation.isPending || missingRequired.length > 0}
                        onClick={() =>
                          responseMutation.mutate({
                            display_name: displayName.trim(),
                            anonymous,
                            share_token: shareToken,
                            submit: true,
                            answers: cards.map((card) => serializeAnswer(card, responseDrafts[card.id] ?? "")),
                          })
                        }
                      >
                        {responseMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        Submit response
                      </Button>
                    </div>
                  </div>
                </>
              ) : viewerSession ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-brand-divider bg-[#FAFAF8] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusTone(viewerSession.status)}`}>
                        {viewerSession.status}
                      </span>
                      <span className="text-[12px] text-brand-text/55">
                        Submitted {formatDateTime(viewerSession.submitted_at || viewerSession.updated_at)}
                      </span>
                    </div>
                    <p className="mt-3 text-[13px] text-brand-text/70">
                      {viewerSession.status === "pending"
                        ? "Your response is waiting for moderation."
                        : "Your response is stored. Editing is currently locked for this SlamBook."}
                    </p>
                  </div>

                  {viewerSession.items.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-brand-divider bg-[#FCFCFB] p-4">
                      <p className="text-[13px] font-semibold text-brand-text">{item.card_title || "Prompt"}</p>
                      <p className="mt-1 text-[12px] text-brand-text/50">{item.card_prompt}</p>
                      <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-brand-text/75">
                        {slambookAnswerPreview(item)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyTabState
                  icon={<Lock />}
                  title="Responses are closed for you"
                  description="This SlamBook is not open for a new response from your account right now."
                  className="py-8"
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[16px]">
                <LayoutGrid className="h-4 w-4 text-brand-text/60" />
                Opinion board
              </CardTitle>
            </CardHeader>
            <CardContent>
              {opinionQuery.isLoading ? (
                <div className="flex items-center gap-2 text-[13px] text-brand-text/60">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading board...
                </div>
              ) : opinionItems.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {opinionItems.map((item, index) => (
                    <div
                      key={item.id}
                      className="rounded-[24px] border border-brand-divider bg-gradient-to-br from-white to-[#f9f3e7] p-5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            {item.is_pinned ? (
                              <span className="rounded-full bg-[#E5A93D]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[#A46D12]">
                                Pinned
                              </span>
                            ) : null}
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusTone(item.status)}`}>
                              {item.status}
                            </span>
                          </div>
                          <p className="mt-3 text-[13px] font-semibold text-brand-text">
                            {item.anonymous ? "Anonymous" : item.responder_display_name || "Guest"}
                          </p>
                          <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-brand-text/45">
                            {item.card_title}
                          </p>
                        </div>
                        {canModerate ? (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => pinMutation.mutate({ itemId: item.id, pinned: !item.is_pinned })}
                              disabled={pinMutation.isPending}
                              className="rounded-xl border border-brand-divider bg-brand-card px-2.5 py-1.5 text-[11px] font-semibold text-brand-highlight transition-colors hover:bg-brand-secondary disabled:opacity-40"
                            >
                              {item.is_pinned ? "Unpin" : "Pin"}
                            </button>
                          </div>
                        ) : null}
                      </div>

                      <p className="mt-4 whitespace-pre-wrap text-[14px] leading-7 text-brand-text/80">
                        {slambookBoardPreview(item)}
                      </p>
                      <p className="mt-3 text-[11px] text-brand-text/45">{item.card_prompt}</p>

                      {canModerate ? (
                        <div className="mt-4 flex items-center justify-between gap-2">
                          <div className="text-[11px] text-brand-text/45">Board slot {index + 1}</div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleMoveOpinionItem(item.id, -1)}
                              disabled={reorderMutation.isPending || index === 0}
                              className="rounded-xl border border-brand-divider bg-brand-card px-2.5 py-1.5 text-[11px] font-semibold text-brand-highlight transition-colors hover:bg-brand-secondary disabled:opacity-40"
                            >
                              Up
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveOpinionItem(item.id, 1)}
                              disabled={reorderMutation.isPending || index === opinionItems.length - 1}
                              className="rounded-xl border border-brand-divider bg-brand-card px-2.5 py-1.5 text-[11px] font-semibold text-brand-highlight transition-colors hover:bg-brand-secondary disabled:opacity-40"
                            >
                              Down
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyTabState
                  icon={<MessageSquareQuote />}
                  title="No board items yet"
                  description="Approved answers will appear here once responses move past moderation."
                  className="py-8"
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[16px]">
                <Link2 className="h-4 w-4 text-brand-text/60" />
                Share and invite
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-brand-divider bg-[#FAFAF8] p-4">
                <p className="text-[13px] font-semibold text-brand-text">Share link</p>
                <p className="mt-1 text-[12px] text-brand-text/55">
                  Generate a token link for friends, classmates, or teammates to answer this SlamBook.
                </p>
                {shareUrl ? (
                  <div className="mt-3 rounded-xl border border-brand-divider bg-white px-3 py-3 font-mono text-[12px] text-brand-text/70">
                    {typeof window === "undefined" ? shareUrl : `${window.location.origin}${shareUrl}`}
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-2xl"
                    disabled={shareLinkMutation.isPending}
                    onClick={() => (shareUrl ? handleCopyShareLink() : shareLinkMutation.mutate())}
                  >
                    {shareLinkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : shareUrl ? <Copy className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                    {shareUrl ? "Copy share link" : "Create share link"}
                  </Button>
                  {shareUrl ? (
                    <Link href={shareUrl}>
                      <Button variant="ghost" className="rounded-2xl">
                        <Eye className="h-4 w-4" />
                        Open share route
                      </Button>
                    </Link>
                  ) : null}
                </div>
              </div>

              {canModerate ? (
                <div className="rounded-2xl border border-brand-divider bg-[#FAFAF8] p-4">
                  <p className="text-[13px] font-semibold text-brand-text">Direct invite</p>
                  <p className="mt-1 text-[12px] text-brand-text/55">
                    Search for people, add them to the invite list, and send the request without copying UUIDs.
                  </p>
                  <div className="relative mt-3">
                    <input
                      value={inviteSearchQuery}
                      onChange={(event) => setInviteSearchQuery(event.target.value)}
                      className="w-full rounded-2xl border border-brand-divider bg-white px-4 py-3 text-[13px] text-brand-text outline-none focus:border-brand-text/30"
                      placeholder="Search by name or username"
                    />
                    {inviteSearchQuery.trim().length >= 2 ? (
                      <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-2xl border border-brand-divider bg-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)]">
                        {inviteSearchResultsQuery.isLoading ? (
                          <div className="flex items-center gap-2 px-4 py-4 text-[12px] text-brand-text/55">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Searching people...
                          </div>
                        ) : inviteSearchResults.length > 0 ? (
                          <div className="max-h-[280px] overflow-y-auto py-2">
                            {inviteSearchResults.map((user) => (
                              <button
                                key={user.id}
                                type="button"
                                onClick={() => handleAddInviteUser(user.id)}
                                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-brand-secondary"
                              >
                                <Avatar src={user.avatar} name={user.name} seed={user.id} size="sm" />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[13px] font-semibold text-brand-text">{user.name}</p>
                                  <p className="truncate text-[11px] text-brand-text/55">
                                    {user.username ? `@${user.username}` : user.id}
                                  </p>
                                </div>
                                <span className="text-[11px] font-semibold text-brand-highlight">Add</span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="px-4 py-4 text-[12px] text-brand-text/55">
                            No people matched that search.
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                  <textarea
                    value={inviteMessage}
                    onChange={(event) => setInviteMessage(event.target.value)}
                    rows={3}
                    className="mt-3 w-full rounded-2xl border border-brand-divider bg-white px-4 py-3 text-[13px] text-brand-text outline-none focus:border-brand-text/30"
                    placeholder="Optional invite message"
                  />

                  <div className="mt-3 space-y-2 text-[12px] text-brand-text/55">
                    <p>{selectedInviteUserIds.length} selected invitee(s)</p>
                    {selectedInviteUserIds.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedInviteUserIds.map((targetId) => {
                          const profile = inviteProfilesQuery.data?.get(targetId);
                          const label = profile?.display_name || profile?.username || targetId;

                          return (
                            <button
                              key={targetId}
                              type="button"
                              onClick={() => handleRemoveInviteUser(targetId)}
                              className="rounded-full border border-brand-divider bg-white px-3 py-1 text-[11px] text-brand-text"
                            >
                              {label} <span className="ml-1 text-brand-text/40">×</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : inviteSearchQuery.trim().length < 2 ? (
                      <p>Type at least 2 characters to search for someone to invite.</p>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="rounded-2xl"
                      disabled={
                        directInviteMutation.isPending ||
                        selectedInviteUserIds.length === 0
                      }
                      onClick={() => directInviteMutation.mutate()}
                    >
                      {directInviteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRoundPlus className="h-4 w-4" />}
                      Send direct invites
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-brand-divider bg-[#FAFAF8] p-4 text-[12px] text-brand-text/55">
                  Invite controls stay with the SlamBook owner or moderator.
                </div>
              )}

              {shareLinkMutation.error || directInviteMutation.error ? (
                <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-600">
                  {messageFromError(shareLinkMutation.error ?? directInviteMutation.error)}
                </p>
              ) : null}
            </CardContent>
          </Card>

          {canModerate ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[16px]">
                  <Shield className="h-4 w-4 text-brand-text/60" />
                  Moderation queue
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {moderationQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-[13px] text-brand-text/60">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading queue...
                  </div>
                ) : pendingSessions.length > 0 ? (
                  pendingSessions.map((session) => {
                    const responder = session.responder_user_id
                      ? profilesQuery.data?.get(session.responder_user_id)
                      : undefined;
                    const responderLabel =
                      session.display_name ||
                      responder?.display_name ||
                      responder?.username ||
                      "Anonymous response";

                    return (
                      <div key={session.id} className="rounded-2xl border border-brand-divider bg-[#FAFAF8] p-4">
                        <div className="flex items-start gap-3">
                          <Avatar
                            src={null}
                            name={responderLabel}
                            seed={session.responder_user_id || session.id}
                            size="sm"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-[13px] font-semibold text-brand-text">{responderLabel}</p>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusTone(session.status)}`}>
                                {session.status}
                              </span>
                            </div>
                            <p className="mt-1 text-[11px] text-brand-text/50">
                              Updated {slambookRelativeDate(session.updated_at)}
                            </p>
                            <div className="mt-3 space-y-2">
                              {session.items.slice(0, 2).map((item) => (
                                <div key={item.id} className="rounded-xl border border-brand-divider bg-white px-3 py-2">
                                  <p className="text-[12px] font-semibold text-brand-text">{item.card_title}</p>
                                  <p className="mt-1 text-[12px] text-brand-text/60">{slambookAnswerPreview(item)}</p>
                                </div>
                              ))}
                            </div>
                            <textarea
                              value={moderationReasons[session.id] ?? ""}
                              onChange={(event) =>
                                setModerationReasons((current) => ({
                                  ...current,
                                  [session.id]: event.target.value,
                                }))
                              }
                              rows={2}
                              className="mt-3 w-full rounded-xl border border-brand-divider bg-white px-3 py-2 text-[12px] text-brand-text outline-none focus:border-brand-text/30"
                              placeholder="Optional moderation reason"
                            />
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                className="rounded-xl"
                                disabled={moderationMutation.isPending}
                                onClick={() =>
                                  moderationMutation.mutate({
                                    sessionId: session.id,
                                    action: "approve",
                                    reason: moderationReasons[session.id],
                                  })
                                }
                              >
                                Approve
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                className="rounded-xl"
                                disabled={moderationMutation.isPending}
                                onClick={() =>
                                  moderationMutation.mutate({
                                    sessionId: session.id,
                                    action: "reject",
                                    reason: moderationReasons[session.id],
                                  })
                                }
                              >
                                Reject
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <EmptyTabState
                    icon={<Shield />}
                    title="Queue is clear"
                    description="There are no pending response sessions waiting for moderation."
                    className="py-8"
                  />
                )}

                {moderationMutation.error ? (
                  <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-600">
                    {messageFromError(moderationMutation.error)}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[16px]">
                <CalendarClock className="h-4 w-4 text-brand-text/60" />
                Session summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-[13px] text-brand-text/65">
              <div className="rounded-2xl border border-brand-divider bg-[#FAFAF8] p-4">
                <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-text/45">
                  Last activity
                </p>
                <p className="mt-1 text-[14px] font-semibold text-brand-text">
                  {formatDateTime(slambook.last_activity_at)}
                </p>
              </div>
              <div className="rounded-2xl border border-brand-divider bg-[#FAFAF8] p-4">
                <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-text/45">
                  Approval policy
                </p>
                <p className="mt-1 text-[14px] font-semibold text-brand-text">
                  {slambook.approval_required ? "Approval required" : "Auto-publish after submit"}
                </p>
              </div>
              <div className="rounded-2xl border border-brand-divider bg-[#FAFAF8] p-4">
                <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-text/45">
                  Response identity
                </p>
                <p className="mt-1 text-[14px] font-semibold text-brand-text">
                  {slambookIdentityLabel(slambook.response_identity_mode)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        onConfirm={() => archiveMutation.mutate()}
        title="Archive this SlamBook?"
        description="Archiving removes it from active circulation but preserves the existing record."
        confirmLabel="Archive"
        destructive
        loading={archiveMutation.isPending}
      />

      <ToastContainer />
    </div>
  );
}

export function SlamBookDetailRouteView({ slambookId }: { slambookId: string }) {
  return <SlamBookWorkspace slambookId={slambookId} openedFromShare={false} />;
}

export function SlamBookShareRouteView({ token }: { token: string }) {
  return <SlamBookWorkspace shareToken={token} openedFromShare />;
}
