"use client";

import { useSyncExternalStore } from "react";

/*
  Sound on the stage is one choice for the session: a feed video starts
  muted (browsers refuse unmuted autoplay), and once the viewer turns sound
  on, the next video they reach plays with sound too.
*/
let soundOn = false;
const listeners = new Set<() => void>();

export function setStageSound(on: boolean): void {
  if (soundOn === on) return;
  soundOn = on;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useStageSound(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, () => soundOn, () => false);
  return [on, setStageSound];
}
