import { Camera, MonitorUp } from "lucide-react"

import type { LiveSource } from "../encoder"

// "How will you go live?" on /live/new. This device is the default; the
// order is the contract's, not alphabetical, because the default leads.
const SOURCE_CHOICES: Array<{ value: LiveSource; label: string; sub: string; Icon: typeof Camera }> = [
  { value: "device", label: "This device", sub: "Camera and microphone", Icon: Camera },
  { value: "encoder", label: "Streaming software", sub: "OBS, an encoder or a camera", Icon: MonitorUp },
]

export function SourcePicker({ value, onChange }: { value: LiveSource; onChange: (next: LiveSource) => void }) {
  return (
    <div>
      <span className="live-label" id="live-source-label">How will you go live?</span>
      <div className="live-choices" role="radiogroup" aria-labelledby="live-source-label">
        {SOURCE_CHOICES.map(({ value: choice, label, sub, Icon }) => (
          <label key={choice} className="live-choice" data-active={value === choice}>
            <input
              type="radio"
              name="source"
              value={choice}
              checked={value === choice}
              onChange={() => onChange(choice)}
            />
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span className="flex flex-col">
              <span>{label}</span>
              <span className="text-xs text-muted-foreground">{sub}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}
