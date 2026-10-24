'use client'

import { useState } from 'react'
import { followRequestErrorCopy, type FollowRequestDecision } from '@/lib/followRequests'
import { useRespondToFollowRequest } from './useFollowRequests'

export type InlineRequestState =
  | { kind: 'idle' }
  | { kind: 'pending'; decision: FollowRequestDecision }
  | { kind: 'done'; decision: FollowRequestDecision }
  | { kind: 'error'; message: string }

/** Accept / Decline on a follow-request notification row, or what became of it. */
export function FollowRequestInlineView({ state, actorName, onAnswer }: {
  state: InlineRequestState
  actorName?: string
  onAnswer: (decision: FollowRequestDecision) => void
}) {
  if (state.kind === 'done') {
    return (
      <span role="status" className="text-sm font-medium text-muted-foreground">
        {state.decision === 'accept' ? 'Request accepted' : 'Request declined'}
      </span>
    )
  }
  const busy = state.kind === 'pending'
  const who = actorName?.trim() ? ` from ${actorName.trim()}` : ''
  return (
    <>
      {state.kind === 'error' ? <span role="alert" className="basis-full text-xs text-danger">{state.message}</span> : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => onAnswer('accept')}
        aria-label={`Accept follow request${who}`}
        className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Accept
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => onAnswer('decline')}
        aria-label={`Decline follow request${who}`}
        className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Decline
      </button>
    </>
  )
}

/** The live version: answers through graph-service and remembers the outcome for this row. */
export function FollowRequestInlineActions({ requesterId, actorName }: { requesterId: string; actorName?: string }) {
  const respond = useRespondToFollowRequest()
  const [state, setState] = useState<InlineRequestState>({ kind: 'idle' })
  const answer = (decision: FollowRequestDecision) => {
    setState({ kind: 'pending', decision })
    respond.mutate(
      { requesterId, decision },
      {
        onSuccess: () => setState({ kind: 'done', decision }),
        onError: (err) => setState({ kind: 'error', message: followRequestErrorCopy(err) }),
      },
    )
  }
  return <FollowRequestInlineView state={state} actorName={actorName} onAnswer={answer} />
}
