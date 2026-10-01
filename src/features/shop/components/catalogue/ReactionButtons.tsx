import Link from "next/link"
import { ThumbsDown, ThumbsUp } from "lucide-react"
import { compactCount, dislikeLabel, likeLabel, type Reaction, type ReactionState } from "../../model/reactions"

/**
 * Like and dislike, beside the heart. The like shows the public count; the
 * dislike never shows one (it is private: only the viewer sees their own).
 * Signed out, both are links to sign in with a way back.
 */
export function ReactionButtons({ state, signInUrl, pending, onPress }: {
  state: ReactionState
  /** Set when nobody is signed in: the buttons become sign-in links. */
  signInUrl: string | null
  pending?: boolean
  onPress: (pressed: Reaction) => void
}) {
  const liked = state.viewerReaction === "like"
  const disliked = state.viewerReaction === "dislike"
  const count = <span className="shop-react__count">{compactCount(state.likeCount)}</span>

  if (signInUrl) {
    return (
      <div className="shop-react" role="group" aria-label="Rate this product">
        <Link href={signInUrl} className="shop-react__btn" aria-label={`Sign in to like this product, ${state.likeCount} ${state.likeCount === 1 ? "like" : "likes"}`}>
          <ThumbsUp size={18} aria-hidden="true" />
          {count}
        </Link>
        <Link href={signInUrl} className="shop-react__btn" aria-label="Sign in to dislike this product">
          <ThumbsDown size={18} aria-hidden="true" />
        </Link>
      </div>
    )
  }

  return (
    <div className="shop-react" role="group" aria-label="Rate this product" aria-busy={pending || undefined}>
      <button
        type="button"
        className={`shop-react__btn${liked ? " shop-react__btn--on" : ""}`}
        aria-pressed={liked}
        aria-label={likeLabel(state)}
        title={liked ? "Remove your like" : "Like"}
        disabled={pending}
        onClick={() => onPress("like")}
      >
        <ThumbsUp size={18} aria-hidden="true" fill={liked ? "currentColor" : "none"} />
        {count}
      </button>
      <button
        type="button"
        className={`shop-react__btn${disliked ? " shop-react__btn--on" : ""}`}
        aria-pressed={disliked}
        aria-label={dislikeLabel(state)}
        title={disliked ? "Remove your dislike" : "Dislike"}
        disabled={pending}
        onClick={() => onPress("dislike")}
      >
        <ThumbsDown size={18} aria-hidden="true" fill={disliked ? "currentColor" : "none"} />
      </button>
    </div>
  )
}
