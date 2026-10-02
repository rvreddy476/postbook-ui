"use client"

/*
  /dating — the gate. Closed for accounts outside the pilot; otherwise the
  server's profile status decides: a setup step, a waiting state, or home.
*/

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Hourglass, PauseCircle, ShieldAlert } from "lucide-react"

import { useGlobalToast } from "@/contexts/ToastContext"

import { ClosedState, ErrorState } from "../components/Guard"
import { Button, LinkButton, Loading, StatePanel } from "../components/kit"
import { useGate, useSetPaused } from "../hooks/profile"
import { datingErrorCopy } from "../model/errors"
import { DATING_BASE, stepHref, type OnboardingStep } from "../model/profile"
import { HomeScreen } from "./HomeScreen"

/** The three statuses that are a place to wait rather than a step to take. */
export function WaitingState({ step, onResume, resuming = false }: { step: OnboardingStep; onResume?: () => void; resuming?: boolean }) {
  if (step === "review") {
    return (
      <StatePanel icon={Hourglass} tone="info" title="Your profile is being reviewed" body="A moderator is taking a look. You'll be able to use Pulse as soon as that's done.">
        <LinkButton href={`${DATING_BASE}/settings`}>Settings</LinkButton>
      </StatePanel>
    )
  }
  if (step === "paused") {
    return (
      <StatePanel icon={PauseCircle} title="Your profile is paused" body="Nobody sees you in their deck while you're paused. Your matches stay.">
        <Button variant="primary" onClick={onResume} busy={resuming}>
          Resume
        </Button>
        <LinkButton href={`${DATING_BASE}/settings`}>Settings</LinkButton>
      </StatePanel>
    )
  }
  return (
    <StatePanel icon={ShieldAlert} tone="warning" title="Pulse is on hold for your account" body="Your profile can't be used right now. If you think this is a mistake, contact support.">
      <LinkButton href={`${DATING_BASE}/settings`}>Settings</LinkButton>
    </StatePanel>
  )
}

export function RootScreen() {
  const gate = useGate()
  const router = useRouter()
  const toast = useGlobalToast()
  const resume = useSetPaused()
  const href = gate.kind === "open" ? stepHref(gate.step) : ""

  useEffect(() => {
    if (href) router.replace(href)
  }, [href, router])

  if (gate.kind === "loading" || href) return <Loading />
  if (gate.kind === "closed") {
    return (
      <div className="pulse-page pulse-page--narrow">
        <ClosedState />
      </div>
    )
  }
  if (gate.kind === "error") {
    return (
      <div className="pulse-page pulse-page--narrow">
        <ErrorState error={gate.error} onRetry={gate.retry} />
      </div>
    )
  }
  if (gate.step === "ready") return <HomeScreen section="deck" />
  return (
    <div className="pulse-page pulse-page--narrow">
      <WaitingState
        step={gate.step}
        resuming={resume.isPending}
        onResume={() => resume.mutate(false, { onError: (e) => toast({ type: "error", title: datingErrorCopy(e) }) })}
      />
    </div>
  )
}
