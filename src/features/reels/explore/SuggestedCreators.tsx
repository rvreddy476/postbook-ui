"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, Clock, RefreshCw, UserPlus } from "lucide-react";

import { useGlobalToast } from "@/contexts/ToastContext";
import { useBatchRelationships, useFollowSuggestions, type SuggestionUser } from "@/hooks/useConnections";
import { useFollowUser, useUnfollowUser } from "@/hooks/useEditProfile";
import { mediaHref } from "@/features/reels/model";
import "./explore.css";

/*
  Suggested creators with a Follow button (TikTok parity T-19, and the
  Explore page's "People to follow" row). Suggestions come from
  suggestion-service (`GET /v1/suggestions?type=follow`, useFollowSuggestions);
  Follow and Unfollow are graph-service's own routes through
  useFollowUser / useUnfollowUser (lib/graphApi.ts). Avatar cards, never a
  playing preview: nothing on these surfaces plays sound unasked, and a
  preview per creator would cost one feed request each.
*/

export type FollowState = "none" | "following" | "requested";

export interface CreatorCardModel {
  userId: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  reason: string;
  href: string;
}

export function creatorCard(s: SuggestionUser): CreatorCardModel {
  const handle = (s.username || "").trim();
  const name = (s.display_name || "").trim() || handle || "Someone";
  const mutuals = s.mutual_friend_count ?? 0;
  return {
    userId: s.user_id,
    name,
    handle,
    avatarUrl: s.avatar_media_id ? mediaHref(`/v1/media/${s.avatar_media_id}/serve`) : null,
    // Go zero values: an empty explanation falls through to the next best line.
    reason: (s.explain_text || "").trim() || (mutuals > 0 ? `${mutuals} mutual${mutuals === 1 ? "" : "s"}` : handle ? `@${handle}` : ""),
    href: `/u/${encodeURIComponent(handle || s.user_id)}`,
  };
}

export function followLabel(state: FollowState): string {
  if (state === "following") return "Following";
  if (state === "requested") return "Requested";
  return "Follow";
}

export interface SuggestedCreatorsViewProps {
  creators: readonly CreatorCardModel[];
  stateOf: (userId: string) => FollowState;
  pendingIds?: ReadonlySet<string>;
  onToggle: (creator: CreatorCardModel) => void;
  /** "row" scrolls sideways (Explore); "grid" wraps 2 / 3 / 4 across (empty Following). */
  variant?: "row" | "grid";
  label: string;
}

/** Pure: the cards and their Follow buttons. */
export function SuggestedCreatorsView({ creators, stateOf, pendingIds, onToggle, variant = "grid", label }: SuggestedCreatorsViewProps) {
  return (
    <ul className="explore-creators" data-variant={variant} aria-label={label}>
      {creators.map((c) => {
        const state = stateOf(c.userId);
        const pending = pendingIds?.has(c.userId) ?? false;
        return (
          <li key={c.userId} className="explore-creator" data-creator={c.userId}>
            <Link href={c.href} className="explore-creator__link" aria-label={`View ${c.name}'s profile`}>
              <span className="explore-creator__avatar" aria-hidden>
                {c.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.avatarUrl} alt="" loading="lazy" decoding="async" />
                ) : (
                  <span>{c.name.charAt(0).toUpperCase()}</span>
                )}
              </span>
              <span className="explore-creator__name">{c.name}</span>
              <span className="explore-creator__reason">{c.reason || " "}</span>
            </Link>
            <button
              type="button"
              className="explore-creator__follow"
              data-state={state}
              aria-pressed={state !== "none"}
              aria-label={`${followLabel(state)} ${c.name}`}
              disabled={pending}
              onClick={() => onToggle(c)}
            >
              {state === "following" ? <Check size={14} aria-hidden /> : state === "requested" ? <Clock size={14} aria-hidden /> : <UserPlus size={14} aria-hidden />}
              {followLabel(state)}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function SuggestedCreatorsSkeleton({ variant = "grid", count = 6 }: { variant?: "row" | "grid"; count?: number }) {
  return (
    <ul className="explore-creators" data-variant={variant} aria-busy="true" aria-label="Loading suggestions">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="explore-creator is-skeleton" aria-hidden>
          <span className="explore-creator__avatar" />
          <span className="explore-creator__bar" />
          <span className="explore-creator__bar is-short" />
        </li>
      ))}
    </ul>
  );
}

export interface SuggestedCreatorsProps {
  viewerId: string;
  variant?: "row" | "grid";
  limit?: number;
  label?: string;
  /** After a follow lands (refresh a feed). */
  onFollowChange?: () => void;
  /** What shows when there is nobody to suggest. */
  empty?: ReactNode;
}

/** Connected: suggestions, relationships and the graph-service follow. */
export function SuggestedCreators({ viewerId, variant = "grid", limit = 12, label = "Suggested creators", onFollowChange, empty = null }: SuggestedCreatorsProps) {
  const toast = useGlobalToast();
  const suggestions = useFollowSuggestions(viewerId || undefined, limit);
  const pool = (suggestions.data ?? []).filter((s) => s.user_id && s.user_id !== viewerId);
  const relationships = useBatchRelationships(viewerId, pool.map((s) => s.user_id));
  const follow = useFollowUser();
  const unfollow = useUnfollowUser();
  // What the viewer did here wins over the cached relationship.
  const [local, setLocal] = useState<Record<string, FollowState>>({});
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());

  if (!viewerId) return <>{empty}</>;
  if (suggestions.isPending) return <SuggestedCreatorsSkeleton variant={variant} count={variant === "row" ? 5 : 6} />;
  if (suggestions.isError) {
    return (
      <div className="explore-state" role="alert">
        <p>Couldn&apos;t load suggestions.</p>
        <button type="button" className="explore-state__action" onClick={() => void suggestions.refetch()}>
          <RefreshCw size={14} aria-hidden /> Retry
        </button>
      </div>
    );
  }

  // Someone already followed before this visit is not a suggestion.
  const creators = pool
    .filter((s) => local[s.user_id] !== undefined || !relationships.data?.get(s.user_id)?.following)
    .map(creatorCard);
  if (creators.length === 0) return <>{empty}</>;

  const stateOf = (id: string): FollowState => local[id] ?? (relationships.data?.get(id)?.following ? "following" : "none");

  const onToggle = async (c: CreatorCardModel) => {
    const was = stateOf(c.userId);
    setPending((p) => new Set(p).add(c.userId));
    try {
      if (was === "none") {
        const result = await follow.mutateAsync(c.userId);
        setLocal((m) => ({ ...m, [c.userId]: result?.status === "requested" ? "requested" : "following" }));
      } else {
        await unfollow.mutateAsync(c.userId);
        setLocal((m) => ({ ...m, [c.userId]: "none" }));
      }
      onFollowChange?.();
    } catch {
      toast({ type: "error", title: was === "none" ? "Could not follow" : "Could not unfollow" });
    } finally {
      setPending((p) => {
        const next = new Set(p);
        next.delete(c.userId);
        return next;
      });
    }
  };

  return (
    <SuggestedCreatorsView
      creators={creators}
      stateOf={stateOf}
      pendingIds={pending}
      onToggle={(c) => void onToggle(c)}
      variant={variant}
      label={label}
    />
  );
}
