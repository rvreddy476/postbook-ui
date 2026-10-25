"use client";

import { useEffect, useMemo, useReducer } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Clapperboard, Film } from "lucide-react";

import { Avatar } from "@/components/LetterAvatar";
import { postTimeLabel, postTimeTitle } from "@/lib/postTime";
import { acceptCredit, declineCredit } from "../creditsApi";
import { INITIAL_REQUESTS_STATE, requestsReducer, type CreditAnswer, type CreditRequest } from "../creditsModel";
import { CREDITS_KEYS, useCreditRequests } from "../useCredits";
import "../credits.css";

/*
  Credit requests (/credits/requests, the credit_request notification's
  link): the videos that credit me and wait for my answer. Accept shows
  the video on my profile ("Appears in"); Decline keeps my name on it as
  plain text. Both answer at once on screen and put the row back if the
  server refuses (requestsReducer).
*/

export interface CreditRequestsListProps {
  items: readonly CreditRequest[];
  onAnswer: (request: CreditRequest, answer: CreditAnswer) => void;
}

export function CreditRequestsList({ items, onAnswer }: CreditRequestsListProps) {
  return (
    <ul className="credit-requests" aria-label="Credit requests">
      {items.map((r) => {
        const who = r.from.displayName || r.from.username || "Someone";
        return (
          <li key={r.id} className="credit-request" data-credit-request={r.id}>
            <Link href={`/posttube/watch/${encodeURIComponent(r.post.id)}`} className="credit-request__cover" aria-label={`Watch ${r.post.title}`}>
              {r.post.coverUrl ? (
                <img src={r.post.coverUrl} alt="" loading="lazy" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-muted-foreground" aria-hidden="true">
                  <Film className="h-5 w-5" />
                </span>
              )}
            </Link>
            <div className="credit-request__body">
              <p className="flex items-center gap-1.5 text-sm text-foreground">
                <span aria-hidden="true">
                  <Avatar src={r.from.avatarUrl} name={who} seed={r.from.id || r.id} size="xs" />
                </span>
                <span className="min-w-0 truncate">
                  <strong className="font-semibold">{who}</strong> credited you in a video
                </span>
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
                <Link href={`/posttube/watch/${encodeURIComponent(r.post.id)}`} className="hover:underline">
                  {r.post.title}
                </Link>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {[r.role, r.name && r.name !== who ? `as ${r.name}` : "", r.post.channelName].filter(Boolean).join(" · ")}
                {r.createdAt ? (
                  <>
                    {" · "}
                    <time dateTime={r.createdAt} title={postTimeTitle(r.createdAt)}>
                      {postTimeLabel(r.createdAt)}
                    </time>
                  </>
                ) : null}
              </p>
            </div>
            <div className="credit-request__actions">
              <button
                type="button"
                onClick={() => onAnswer(r, "accept")}
                aria-label={`Accept the ${r.role} credit on ${r.post.title}`}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Accept
              </button>
              <button
                type="button"
                onClick={() => onAnswer(r, "decline")}
                aria-label={`Decline the ${r.role} credit on ${r.post.title}`}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Decline
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function CreditRequestsScreen() {
  const query = useCreditRequests();
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(requestsReducer, INITIAL_REQUESTS_STATE);
  const loaded = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  useEffect(() => dispatch({ type: "loaded", items: loaded }), [loaded]);

  const answer = (request: CreditRequest, choice: CreditAnswer) => {
    dispatch({ type: "answer", id: request.id, answer: choice });
    const call = choice === "accept" ? acceptCredit : declineCredit;
    call(request.id)
      .then(() => {
        dispatch({ type: "settled", id: request.id });
        void queryClient.invalidateQueries({ queryKey: CREDITS_KEYS.requests });
        void queryClient.invalidateQueries({ queryKey: ["posttube", "credits", "appearances"] });
      })
      .catch(() => {
        dispatch({
          type: "failed",
          id: request.id,
          message: choice === "accept" ? "That credit could not be accepted. Please try again." : "That credit could not be declined. Please try again.",
        });
      });
  };

  return (
    <div className="mx-auto max-w-3xl p-4">
      <div className="mb-1 flex items-center gap-2">
        <Clapperboard className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-2xl font-semibold text-foreground">Credit requests</h1>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">Creators who credited you in their videos. Accepted videos show on your profile under Appears in.</p>

      {state.error ? (
        <p role="alert" className="mb-3 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      {query.isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>
      ) : query.isError && state.items.length === 0 ? (
        <div role="alert" className="py-12 text-center text-sm text-foreground">
          Credit requests couldn’t be loaded.{" "}
          <button type="button" onClick={() => void query.refetch()} className="font-semibold text-primary-ink underline">
            Try again
          </button>
        </div>
      ) : state.items.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground" role="status">
          No credit requests. When someone credits you in a video, you can accept or decline it here.
        </p>
      ) : (
        <CreditRequestsList items={state.items} onAnswer={answer} />
      )}

      {query.hasNextPage ? (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={() => void query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {query.isFetchingNextPage ? "Loading more…" : "Load more"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
