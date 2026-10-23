import Link from "next/link";

import { Avatar } from "@/components/LetterAvatar";
import {
  CREDIT_STATUS_LABEL,
  creditHref,
  creditsMetaLine,
  groupCredits,
  hasCreditsInfo,
  type Genre,
  type VideoCredit,
  type VideoCreditsInfo,
} from "../creditsModel";
import "../credits.css";

/*
  The watch page's Credits, under the description: genres, year and
  production house on one line, then "Cast: A, B, C · Director: D". A name
  searches PostTube for it; an accepted linked credit shows the person's
  small avatar and opens their channel. The person themself can take the
  link off ("Remove me"); the owner sees which tags are still pending.
*/

export interface CreditsBlockProps {
  info: VideoCreditsInfo;
  genres?: readonly Genre[] | null;
  /** The signed-in viewer: an accepted credit of theirs gets "Remove me". */
  viewerId?: string | null;
  /** The owner sees a pending or declined tag's status beside the name. */
  isOwner?: boolean;
  onRemoveMe?: (credit: VideoCredit) => void;
  /** The credit being removed (its button reads "Removing…"). */
  removingId?: string | null;
}

export function CreditsBlock({ info, genres, viewerId = null, isOwner = false, onRemoveMe, removingId = null }: CreditsBlockProps) {
  if (!hasCreditsInfo(info)) return null;
  const meta = creditsMetaLine(info, genres);
  const groups = groupCredits(info.credits);
  return (
    <section className="tube-credits" aria-label="Credits" data-credits>
      {meta ? <p className="tube-credits__meta">{meta}</p> : null}
      {groups.length > 0 ? (
        <p className="tube-credits__groups">
          {groups.map((g) => (
            <span key={g.label} className="tube-credits__group">
              <span className="tube-credits__role">{g.label}:</span>{" "}
              {g.credits.map((c, i) => (
                <span key={c.id || `${g.label}-${i}`}>
                  {i > 0 ? ", " : null}
                  <CreditName credit={c} />
                  {isOwner && c.status && c.status !== "accepted" && c.status !== "unlinked" ? (
                    <span className="tube-credits__status">({CREDIT_STATUS_LABEL[c.status].toLowerCase()})</span>
                  ) : null}
                  {onRemoveMe && viewerId && c.user?.id === viewerId && c.id ? (
                    <button
                      type="button"
                      className="tube-credits__remove"
                      onClick={() => onRemoveMe(c)}
                      disabled={removingId === c.id}
                      aria-label={`Remove me from this video (${c.role})`}
                    >
                      {removingId === c.id ? "Removing…" : "Remove me"}
                    </button>
                  ) : null}
                </span>
              ))}
            </span>
          ))}
        </p>
      ) : null}
    </section>
  );
}

function CreditName({ credit }: { credit: VideoCredit }) {
  const href = creditHref(credit);
  if (credit.user) {
    return (
      <Link href={href} className="tube-credits__person" data-linked>
        <span className="tube-credits__avatar" aria-hidden="true">
          <Avatar src={credit.user.avatarUrl} name={credit.user.displayName || credit.name} seed={credit.user.id} size="xs" />
        </span>
        {credit.name}
      </Link>
    );
  }
  return <Link href={href}>{credit.name}</Link>;
}
