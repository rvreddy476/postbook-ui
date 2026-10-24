'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Loader2, Plus } from 'lucide-react';
import { getSession } from '@/services/authService';
import { useHashtagFollowState, useToggleHashtagFollow } from '@/hooks/useHashtagFollow';
import { followSignInHref, hashtagFollowErrorText } from './hashtagFollow';

const base =
  'shrink-0 inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-bold transition-colors disabled:opacity-60';

/**
 * Follow / Following on a hashtag page. Posts with a followed tag show in
 * the home feed's Hashtags tab. A visitor gets a sign-in link instead; the
 * page itself stays public.
 */
export function FollowHashtagButton({ tag }: { tag: string }) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setSignedIn(!!getSession());
    sync();
    window.addEventListener('postbook:session-changed', sync);
    return () => window.removeEventListener('postbook:session-changed', sync);
  }, []);

  const state = useHashtagFollowState(tag, signedIn === true);
  const toggle = useToggleHashtagFollow(tag);

  if (signedIn === null) return null;

  if (!signedIn) {
    return (
      <Link href={followSignInHref(tag)} className={`${base} bg-primary text-primary-foreground hover:bg-primary-hover`}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Follow
      </Link>
    );
  }

  // The server's answer once it is in; until then nothing is claimed.
  const following = toggle.isPending ? !!toggle.variables : !!state.data?.following;
  const unavailable = state.isError;

  const press = () => {
    setError(null);
    toggle.mutate(!following, {
      onError: (err) => setError(hashtagFollowErrorText(err, following ? 'unfollow' : 'follow')),
    });
  };

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        onClick={press}
        disabled={state.isLoading || toggle.isPending || unavailable}
        aria-pressed={following}
        title={unavailable ? hashtagFollowErrorText(state.error, 'load') : undefined}
        className={
          following
            ? `${base} border border-brand-divider bg-brand-card text-brand-text hover:bg-brand-secondary`
            : `${base} bg-primary text-primary-foreground hover:bg-primary-hover`
        }
      >
        {toggle.isPending || state.isLoading ? (
          <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
        ) : following ? (
          <Check className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Plus className="h-4 w-4" aria-hidden="true" />
        )}
        {following ? 'Following' : 'Follow'}
      </button>
      {error && (
        <p role="alert" className="max-w-[16rem] text-right text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
