"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useGlobalToast } from "@/contexts/ToastContext";
import { channelAvatarUrl, channelBannerUrl, type ChannelInfo } from "@/features/posttube/data/posttubeApi";
import { mediaServeUrl } from "@/features/posttube/model";
import { useCreateChannel, useMyChannel, useMyChannels, useUpdateChannel } from "@/hooks/useChannels";
import { useMyProfile } from "@/hooks/useEditProfile";
import { uploadMedia } from "@/lib/mediaUpload";
import { useAuthUser } from "@/store/auth";

import { BrandingScreen } from "./BrandingScreen";
import { useActiveSection, useFeaturedPicker, useHandleAvailability } from "./hooks";
import { useCreateChannelForm } from "./useCreateChannelForm";
import {
  BrandingValidationError,
  brandingFromChannel,
  channelPatch,
  fieldErrorsFromApi,
  hasErrors,
  isDirty,
  moveLink,
  normalizeHandleInput,
  suggestHandle,
  validateBranding,
  type BrandingField,
  type ChannelBranding,
  type ChannelBrandingWire,
  type ChannelLink,
  type ChannelPatch,
  type FieldErrors,
} from "./model";
import { SECTIONS, type SectionId } from "./view";

/*
  Branding — the container. Reads the channel from GET /v1/channels/me,
  keeps one draft, and on Save sends only what changed to
  PATCH /v1/channels/me. Images go through the media upload (init → PUT →
  confirm) when picked; the id lands in the draft and is saved with the
  rest. "No channel yet" creates one with POST /v1/channels, prefilled from
  the profile (and the legacy user-service channel row when one exists).
*/

const SECTION_IDS: readonly SectionId[] = SECTIONS.map((s) => s.id);

function countErrors(e: FieldErrors): number {
  let n = Object.keys(e).filter((k) => k !== "linkRows").length;
  if (e.linkRows) n += Object.keys(e.linkRows).length;
  return n;
}

function mergeErrors(client: FieldErrors, server: FieldErrors, visible: (f: BrandingField) => boolean): FieldErrors {
  const out: FieldErrors = { ...server };
  for (const key of Object.keys(client) as (keyof FieldErrors)[]) {
    if (key === "linkRows") {
      if (visible("links")) out.linkRows = { ...(client.linkRows ?? {}), ...(server.linkRows ?? {}) };
      continue;
    }
    if (!(key in out) && visible(key)) out[key] = client[key];
  }
  return out;
}

export function BrandingSettings() {
  const toast = useGlobalToast();
  const user = useAuthUser();
  const channelQuery = useMyChannel();
  const profileQuery = useMyProfile({ enabled: !!user });
  const update = useUpdateChannel();
  const create = useCreateChannel();

  const channel = (channelQuery.data ?? null) as (ChannelInfo & ChannelBrandingWire) | null;
  const baseline = useMemo(() => brandingFromChannel(channel), [channel]);

  /* ── Draft ─────────────────────────────────────────────── */
  const [draft, setDraft] = useState<ChannelBranding | null>(null);
  const baselineRef = useRef(baseline);
  useEffect(() => {
    // Adopt a fresh baseline (first load, a save, a background refetch)
    // unless the user has unsaved edits on the old one.
    setDraft((cur) => (cur === null || !isDirty(baselineRef.current, cur) ? baseline : cur));
    baselineRef.current = baseline;
  }, [baseline]);

  const [touched, setTouched] = useState<Set<BrandingField>>(() => new Set());
  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [pageMessage, setPageMessage] = useState<string | undefined>();
  const [uploading, setUploading] = useState({ avatar: false, banner: false });
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");

  const patchDraft = useCallback((field: BrandingField, apply: (d: ChannelBranding) => ChannelBranding) => {
    setDraft((cur) => (cur ? apply(cur) : cur));
    setTouched((t) => (t.has(field) ? t : new Set(t).add(field)));
    setServerErrors((e) => {
      if (!(field in e) && !(field === "links" && e.linkRows)) return e;
      const next = { ...e };
      delete next[field];
      if (field === "links") delete next.linkRows;
      return next;
    });
    setPageMessage(undefined);
  }, []);

  const effective = draft ?? baseline;
  const availability = useHandleAvailability(effective.handle, baseline.handle);
  const featured = useFeaturedPicker(user?.id, effective.featured_post_id);
  const activeSection = useActiveSection(SECTION_IDS, "identity");

  /* ── Errors and dirtiness ──────────────────────────────── */
  const clientErrors = useMemo(() => validateBranding(effective), [effective]);
  const errors = useMemo(() => mergeErrors(clientErrors, serverErrors, (f) => attempted || touched.has(f)), [clientErrors, serverErrors, attempted, touched]);
  const dirty = draft !== null && isDirty(baseline, draft);
  const changeCount = useMemo(() => {
    if (!draft) return 0;
    try {
      return Object.keys(channelPatch(baseline, draft)).length;
    } catch {
      return 0;
    }
  }, [baseline, draft]);
  const blockingErrors = countErrors(errors) + (availability.state === "taken" && !errors.handle ? 1 : 0);

  /* ── Images ────────────────────────────────────────────── */
  const pick = useCallback(
    async (kind: "avatar" | "banner", file: File) => {
      if (!file.type.startsWith("image/")) {
        toast({ type: "error", title: "Choose an image file" });
        return;
      }
      setUploading((u) => ({ ...u, [kind]: true }));
      try {
        const mediaId = await uploadMedia(file, "image", kind === "avatar" ? "avatar" : "cover");
        const url = URL.createObjectURL(file);
        setPreviews((p) => ({ ...p, [mediaId]: url }));
        const field: BrandingField = kind === "avatar" ? "avatar_media_id" : "banner_media_id";
        patchDraft(field, (d) => ({ ...d, [field]: mediaId }));
      } catch {
        toast({ type: "error", title: kind === "avatar" ? "Could not upload the picture" : "Could not upload the banner" });
      } finally {
        setUploading((u) => ({ ...u, [kind]: false }));
      }
    },
    [patchDraft, toast],
  );
  // Object URLs live until the page unmounts; revoking on every change would
  // pull the image out from under the preview.
  const previewsRef = useRef(previews);
  previewsRef.current = previews;
  useEffect(() => () => Object.values(previewsRef.current).forEach((u) => URL.revokeObjectURL(u)), []);

  const urlFor = (id: string | null, kind: "avatar" | "banner"): string | undefined => {
    if (!id) return undefined;
    if (previews[id]) return previews[id];
    if (id === baseline[kind === "avatar" ? "avatar_media_id" : "banner_media_id"]) {
      return (kind === "avatar" ? channelAvatarUrl(channel) : channelBannerUrl(channel)) ?? mediaServeUrl(id);
    }
    return mediaServeUrl(id);
  };

  /* ── Save ──────────────────────────────────────────────── */
  const onSave = () => {
    if (!draft) return;
    setAttempted(true);
    let patch: ChannelPatch;
    try {
      patch = channelPatch(baseline, draft);
    } catch (e) {
      if (e instanceof BrandingValidationError) {
        toast({ type: "error", title: "Fix the highlighted fields" });
        return;
      }
      throw e;
    }
    if (availability.state === "taken") {
      setServerErrors((s) => ({ ...s, handle: "That handle is taken." }));
      return;
    }
    if (!Object.keys(patch).length) return;
    update.mutate(patch, {
      onSuccess: (data) => {
        setServerErrors({});
        setPageMessage(undefined);
        setTouched(new Set());
        setAttempted(false);
        setDraft(brandingFromChannel(data as ChannelBrandingWire));
        toast({ type: "success", title: "Branding saved" });
      },
      onError: (err) => {
        const { errors: fieldErrors, pageMessage: msg } = fieldErrorsFromApi(err);
        setServerErrors(fieldErrors);
        setPageMessage(msg);
        toast({ type: "error", title: msg ?? "Some fields need attention" });
      },
    });
  };

  const onReset = () => {
    setDraft(baseline);
    setTouched(new Set());
    setAttempted(false);
    setServerErrors({});
    setPageMessage(undefined);
  };

  /* ── No channel yet ────────────────────────────────────── */
  const noChannel = !channelQuery.isPending && !channelQuery.isError && channel === null;
  const createForm = useCreateChannelForm(noChannel);

  /* ── Render ────────────────────────────────────────────── */
  if (!user) return <BrandingScreen kind="signed-out" />;
  if (channelQuery.isPending) return <BrandingScreen kind="loading" />;
  if (channelQuery.isError) return <BrandingScreen kind="error" message="Could not load your channel." onRetry={() => void channelQuery.refetch()} />;

  if (channel === null) {
    if (!createForm) return <BrandingScreen kind="loading" />;
    return <BrandingScreen kind="no-channel" create={createForm} />;
  }

  const d = effective;
  return (
    <BrandingScreen
      kind="loaded"
      activeSection={activeSection}
      identity={{
        draft: d,
        errors,
        avatarUrl: urlFor(d.avatar_media_id, "avatar"),
        bannerUrl: urlFor(d.banner_media_id, "banner"),
        uploading,
        availability,
        onChange: (field, value) => patchDraft(field, (cur) => ({ ...cur, [field]: field === "handle" ? normalizeHandleInput(value) : value })),
        onPickAvatar: (file) => void pick("avatar", file),
        onRemoveAvatar: () => patchDraft("avatar_media_id", (cur) => ({ ...cur, avatar_media_id: null })),
        onPickBanner: (file) => void pick("banner", file),
        onRemoveBanner: () => patchDraft("banner_media_id", (cur) => ({ ...cur, banner_media_id: null })),
      }}
      links={{
        links: d.links,
        contactEmail: d.contact_email,
        errors,
        onLinkChange: (i, field, value) => patchDraft("links", (cur) => ({ ...cur, links: cur.links.map((l, j) => (j === i ? { ...l, [field]: value } : l)) })),
        onAddLink: () => patchDraft("links", (cur) => (cur.links.length >= 10 ? cur : { ...cur, links: [...cur.links, { title: "", url: "" } as ChannelLink] })),
        onRemoveLink: (i) => patchDraft("links", (cur) => ({ ...cur, links: cur.links.filter((_, j) => j !== i) })),
        onMoveLink: (i, dir) => patchDraft("links", (cur) => ({ ...cur, links: moveLink(cur.links, i, dir) })),
        onContactEmailChange: (value) => patchDraft("contact_email", (cur) => ({ ...cur, contact_email: value })),
      }}
      featured={{
        selectedId: d.featured_post_id,
        selected: featured.selected,
        videos: featured.videos,
        query,
        onQuery: setQuery,
        loading: featured.loading,
        hasMore: featured.hasMore,
        onMore: featured.loadMore,
        onSelect: (id) => patchDraft("featured_post_id", (cur) => ({ ...cur, featured_post_id: id })),
        error: featured.error,
      }}
      save={{
        dirty,
        saving: update.isPending,
        changeCount,
        errorCount: blockingErrors,
        pageMessage,
        onSave,
        onReset,
      }}
    />
  );
}
