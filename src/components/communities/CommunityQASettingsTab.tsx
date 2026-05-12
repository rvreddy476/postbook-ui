'use client'

import { useEffect, useState } from 'react'
import { Save, Shield } from 'lucide-react'
import {
  useCommunityQASettings,
  useUpdateCommunityQASettings,
} from '@/hooks/useQA'
import type { CommunityQAPermission, CommunityQASettings } from '@/types/qa'

interface Props {
  communityId: string
}

const PERMISSIONS: { key: CommunityQAPermission; label: string }[] = [
  { key: 'everyone', label: 'Everyone' },
  { key: 'members', label: 'Members' },
  { key: 'moderators', label: 'Moderators' },
]

const DEFAULT_SETTINGS: CommunityQASettings = {
  community_id: '',
  qa_enabled: true,
  ask_permission: 'members',
  answer_permission: 'members',
  auto_suggest_topics: true,
  require_approval: false,
  anonymity_enabled: false,
  welcome_message: '',
}

export default function CommunityQASettingsTab({ communityId }: Props) {
  const { data: server, isLoading } = useCommunityQASettings(communityId)
  const update = useUpdateCommunityQASettings(communityId)
  const [form, setForm] = useState<CommunityQASettings>({ ...DEFAULT_SETTINGS, community_id: communityId })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (server) {
      setForm({ ...DEFAULT_SETTINGS, ...server, community_id: communityId })
    }
  }, [server, communityId])

  const set = <K extends keyof CommunityQASettings>(key: K, value: CommunityQASettings[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await update.mutateAsync({
        qa_enabled: form.qa_enabled,
        ask_permission: form.ask_permission,
        answer_permission: form.answer_permission,
        auto_suggest_topics: form.auto_suggest_topics,
        require_approval: form.require_approval,
        anonymity_enabled: form.anonymity_enabled,
        welcome_message: form.welcome_message,
      })
      setSaved(true)
    } catch {
      setSaved(false)
    }
  }

  if (isLoading) {
    return <div className="py-10 text-center text-sm text-brand-text/50">Loading…</div>
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-brand-text/60" />
        <h3 className="text-sm font-bold text-brand-text">Q&A Settings</h3>
      </div>

      <ToggleRow
        label="Enable Q&A in this community"
        description="When off, members can&apos;t post questions to this community."
        checked={form.qa_enabled}
        onChange={v => set('qa_enabled', v)}
      />

      <SelectRow
        label="Who can ask questions"
        value={form.ask_permission}
        options={PERMISSIONS}
        onChange={v => set('ask_permission', v)}
      />

      <SelectRow
        label="Who can answer"
        value={form.answer_permission}
        options={PERMISSIONS}
        onChange={v => set('answer_permission', v)}
      />

      <ToggleRow
        label="Auto-suggest topics"
        description="Show popular community topics on the Ask page."
        checked={form.auto_suggest_topics}
        onChange={v => set('auto_suggest_topics', v)}
      />

      <ToggleRow
        label="Require approval"
        description="Questions need a moderator&apos;s approval before being visible."
        checked={form.require_approval}
        onChange={v => set('require_approval', v)}
      />

      <ToggleRow
        label="Allow anonymous questions"
        description="Members can choose to ask without showing their name."
        checked={form.anonymity_enabled}
        onChange={v => set('anonymity_enabled', v)}
      />

      <div>
        <label className="block text-sm font-medium text-brand-text mb-1.5">
          Welcome message
        </label>
        <textarea
          value={form.welcome_message ?? ''}
          onChange={e => set('welcome_message', e.target.value)}
          rows={3}
          placeholder="A short note that appears on the Ask page for this community."
          className="w-full px-3 py-2 rounded-xl border border-brand-divider bg-white dark:bg-brand-bg text-sm text-brand-text focus:outline-none focus:border-brand-text/40"
        />
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={update.isPending}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-text text-brand-bg text-xs font-bold hover:bg-brand-text/90 transition-colors disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          {update.isPending ? 'Saving…' : 'Save settings'}
        </button>
        {saved && <span className="text-xs text-emerald-600">Saved.</span>}
        {update.error ? <span className="text-xs text-red-600">Failed to save.</span> : null}
      </div>
    </form>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-brand-divider px-4 py-3 bg-white dark:bg-brand-bg/40">
      <div>
        <div className="text-sm font-semibold text-brand-text">{label}</div>
        {description && (
          <div
            className="text-xs text-brand-text/60 mt-0.5"
            dangerouslySetInnerHTML={{ __html: description }}
          />
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? 'bg-brand-text' : 'bg-neutral-300 dark:bg-neutral-700'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}

function SelectRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { key: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="rounded-xl border border-brand-divider px-4 py-3 bg-white dark:bg-brand-bg/40">
      <div className="text-sm font-semibold text-brand-text mb-2">{label}</div>
      <div className="flex gap-2">
        {options.map(opt => (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              value === opt.key
                ? 'bg-brand-text text-brand-bg'
                : 'bg-brand-bg text-brand-text/60 hover:text-brand-text'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
