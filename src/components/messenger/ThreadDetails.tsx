'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Pin, X } from 'lucide-react';

import Avatar from '@/components/ui/Avatar';
import { useUserProfile } from '@/hooks/useEditProfile';
import { useBatchRelationships } from '@/hooks/useConnections';
import { getSession } from '@/services/authService';
import {
  fetchMessages,
  getPinnedMessage,
  type Message,
} from '@/services/messageService';

interface ThreadDetailsProps {
  /** The other person in a direct conversation. */
  peerId: string;
  conversationId: string | null;
  onClose: () => void;
}

const MEDIA_TYPES = new Set(['media', 'image', 'video']);

/**
 * The third column of the messenger: who you are talking to, and what is in
 * the thread.
 *
 * Everything here is real. Nothing is shown from an empty source:
 *
 *  - Identity, role, location and verification come from the profile.
 *  - "Mutual" is the relationship's own mutual count, not a guess.
 *  - Shared media is the media ACTUALLY sent in this conversation, read from
 *    the same message history the thread already loads.
 *  - The pinned card appears only when a message is pinned.
 *
 * Deliberately absent: "mutual spaces". Group membership for another person
 * is not exposed, and working it out would mean one request per group of
 * mine, so the panel would be paying a lot to print a number it cannot trust.
 */
export default function ThreadDetails({ peerId, conversationId, onClose }: ThreadDetailsProps) {
  const router = useRouter();
  const myId = getSession()?.id ?? '';

  const { data: profile } = useUserProfile(peerId);
  // The hook returns a Map, not a plain object.
  const { data: relationships } = useBatchRelationships(myId, peerId ? [peerId] : []);
  const relationship = relationships?.get(peerId);

  const { data: media } = useQuery({
    queryKey: ['thread-media', conversationId],
    queryFn: async () => {
      const res: any = await fetchMessages(conversationId!, 50);
      const list: Message[] = Array.isArray(res?.data) ? res.data : [];
      return list.filter((m) => m.media_id && MEDIA_TYPES.has(m.type));
    },
    enabled: !!conversationId,
    staleTime: 60_000,
  });

  const { data: pinned } = useQuery({
    queryKey: ['thread-pinned', conversationId],
    queryFn: () => getPinnedMessage(conversationId!),
    enabled: !!conversationId,
    staleTime: 60_000,
  });

  const name = profile?.display_name || profile?.username || 'Someone';
  const role = profile?.profession?.trim();
  const shared = media ?? [];

  return (
    <aside className="flex h-full w-[300px] shrink-0 flex-col overflow-y-auto border-l border-brand-divider bg-brand-bg">
      <div className="flex items-center justify-between px-4 py-3.5">
        <h2 className="text-sm font-semibold -tracking-[0.014em] text-brand-text">Thread details</h2>
        <button
          onClick={onClose}
          aria-label="Close thread details"
          className="flex h-7 w-7 items-center justify-center rounded-full text-brand-text/50 transition-colors hover:bg-brand-secondary hover:text-brand-text"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-4 pb-5">
        {/* Who */}
        <div className="rounded-2xl border border-brand-divider bg-brand-card p-4 text-center">
          <button
            onClick={() => router.push(`/u/${profile?.username || peerId}`)}
            className="mx-auto block"
            aria-label={`Open ${name}'s profile`}
          >
            <Avatar
              src={profile?.avatar_media_id ? `/v1/media/${profile.avatar_media_id}/serve` : undefined}
              name={name}
              className="mx-auto h-16 w-16"
            />
          </button>
          <p className="mt-3 text-sm font-semibold text-brand-text">{name}</p>
          {role && <p className="mt-0.5 text-xs text-muted-foreground">{role}</p>}

          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {profile?.location && (
              <span className="rounded-full bg-brand-secondary px-2.5 py-1 text-[11px] text-muted-foreground">
                {profile.location}
              </span>
            )}
            {!!relationship?.mutual_circle_count && (
              <span className="rounded-full bg-primary-tint px-2.5 py-1 text-[11px] font-medium text-primary-ink">
                {relationship.mutual_circle_count} mutual
              </span>
            )}
          </div>
        </div>

        {/* What has been shared here */}
        {shared.length > 0 && (
          <section className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-brand-text">Shared media</h3>
              <span className="text-[11px] text-muted-foreground">{shared.length}</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {shared.slice(0, 6).map((m) => (
                <div key={m.id} className="aspect-square overflow-hidden rounded-lg bg-brand-secondary">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/v1/media/${m.media_id}/serve`}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Pinned */}
        {pinned?.message && (
          <section className="mt-5">
            <h3 className="mb-2 text-xs font-semibold text-brand-text">Pinned</h3>
            <div className="flex gap-2 rounded-xl border border-brand-divider bg-brand-card p-3">
              <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 rotate-45 text-brand-text/40" />
              <p className="line-clamp-3 text-xs leading-relaxed text-brand-text/80">
                {pinned.message.text || 'Attachment'}
              </p>
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}
