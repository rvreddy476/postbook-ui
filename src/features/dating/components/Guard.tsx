"use client"

import { useRouter } from "next/navigation"
import { useEffect, type ReactNode } from "react"
import { CloudOff, DoorClosed } from "lucide-react"

import { useGate } from "../hooks/profile"
import { CLOSED_BODY, CLOSED_TITLE, datingErrorCopy } from "../model/errors"
import { DATING_BASE } from "../model/profile"
import { Button, LinkButton, Loading, StatePanel } from "./kit"

/** Outside the pilot: a friendly closed door, not an error. */
export function ClosedState() {
  return (
    <StatePanel icon={DoorClosed} title={CLOSED_TITLE} body={CLOSED_BODY}>
      <LinkButton href="/" variant="secondary">
        Back to Momentum
      </LinkButton>
    </StatePanel>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <StatePanel icon={CloudOff} tone="danger" title="That didn't load" body={datingErrorCopy(error)}>
      {onRetry ? (
        <Button variant="primary" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </StatePanel>
  )
}

/**
  Wraps a screen.
    need="access": anyone in the pilot (the setup screens).
    need="ready":  only an active profile; anyone else goes back through the
                   root, which routes them to the step they are on. Discovery
                   and messaging stay closed until the selfie check has passed.
*/
export function Guard({ need, children }: { need: "access" | "ready"; children: ReactNode }) {
  const gate = useGate()
  const router = useRouter()
  const mustLeave = gate.kind === "open" && need === "ready" && gate.step !== "ready"

  useEffect(() => {
    if (mustLeave) router.replace(DATING_BASE)
  }, [mustLeave, router])

  if (gate.kind === "loading" || mustLeave) return <Loading />
  if (gate.kind === "closed") return <ClosedState />
  if (gate.kind === "error") return <ErrorState error={gate.error} onRetry={gate.retry} />
  return <>{children}</>
}
