'use client'

import React, { useState } from 'react'
import { Info, UserRoundX } from 'lucide-react'
import ComposerPopup from './ComposerPopup'
import { ANONYMOUS_EXPLAINER, ANONYMOUS_LABEL } from './groupComposer'

export default function AnonymousPostControl({ allowed, checked, disabled, onChange }: {
  allowed: boolean; checked: boolean; disabled: boolean; onChange: (value: boolean) => void
}) {
  const [info, setInfo] = useState(false)
  return <div className="composer-anonymous">
    <UserRoundX size={19} aria-hidden="true" />
    <div className="composer-option-copy">
      <label htmlFor="group-anonymous-post">{ANONYMOUS_LABEL}</label>
      <small>{allowed ? 'Use an anonymous identity' : 'Not enabled in this group'}</small>
    </div>
    <button className="composer-info" type="button" aria-label="About anonymous posting" aria-haspopup="dialog" onClick={() => setInfo(true)}><Info size={16} /></button>
    <input id="group-anonymous-post" className="composer-switch" type="checkbox" role="switch" checked={checked} disabled={disabled || (!allowed && !checked)} onChange={event => onChange(event.target.checked)} />
    {info && <ComposerPopup title="About anonymous posting" onClose={() => setInfo(false)}>
      <div className="composer-popup__content composer-privacy-info">
        <UserRoundX size={30} aria-hidden="true" />
        <p>{ANONYMOUS_EXPLAINER}</p>
        <p>This changes how your identity appears to group members; it does not make your activity untraceable. Avoid including identifying details in your words or attachments.</p>
        {!allowed && <p className="composer-popup__notice">This group has not enabled anonymous posts. You can still post using your profile.</p>}
      </div>
      <footer><button type="button" className="composer-popup__primary" onClick={() => setInfo(false)}>Understood</button></footer>
    </ComposerPopup>}
  </div>
}
