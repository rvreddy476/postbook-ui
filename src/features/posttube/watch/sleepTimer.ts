/*
  The sleep timer (settings menu → Sleep timer): Off / 15 / 30 / 60 min /
  End of video. A minutes choice fires at a wall-clock moment; "End of
  video" fires when the video ends (the player pauses on `ended` instead
  of autoplaying the next). Pure scheduling; the hook keeps the timeout.
*/

export type SleepChoice = "off" | "15" | "30" | "60" | "end";

export const SLEEP_CHOICES: readonly { value: SleepChoice; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "15", label: "15 minutes" },
  { value: "30", label: "30 minutes" },
  { value: "60", label: "1 hour" },
  { value: "end", label: "End of video" },
];

export type SleepSchedule = { kind: "at"; fireAt: number } | { kind: "end" } | null;

/** When the choice fires: a moment for the minutes choices, "end" for the last one, null for Off. */
export function scheduleSleep(choice: SleepChoice, now: number): SleepSchedule {
  switch (choice) {
    case "15":
    case "30":
    case "60":
      return { kind: "at", fireAt: now + Number(choice) * 60_000 };
    case "end":
      return { kind: "end" };
    default:
      return null;
  }
}

/** ms until a scheduled moment fires (never negative); null when nothing is scheduled by the clock. */
export function sleepRemainingMs(schedule: SleepSchedule, now: number): number | null {
  if (!schedule || schedule.kind !== "at") return null;
  return Math.max(0, schedule.fireAt - now);
}

/** Whether the schedule has fired at `now` (an "end" schedule fires only through the ended event). */
export function sleepDue(schedule: SleepSchedule, now: number): boolean {
  return !!schedule && schedule.kind === "at" && schedule.fireAt <= now;
}

/** The value shown beside "Sleep timer": "Off", "12 min left", "End of video". */
export function sleepValueLabel(choice: SleepChoice, schedule: SleepSchedule, now: number): string {
  if (choice === "off" || !schedule) return "Off";
  if (schedule.kind === "end") return "End of video";
  const left = Math.max(0, Math.ceil((schedule.fireAt - now) / 60_000));
  return left <= 1 ? "1 min left" : `${left} min left`;
}
