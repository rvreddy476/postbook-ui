"use client"

import { useRef, useState } from 'react'
import { partnerApi, uploadPartnerImage } from './api'
import { validateImage, type PartnerDocument } from './model'
import { Field, ReadPanel, SaveForm, usePartnerRead } from './ui'
import { BankLoader, DocumentForm } from './PartnerEditor'
import { waitForPartnerMedia } from '@/features/partners/IntroductionFields'

const identityKinds = ['passport', 'voter_id', 'driving_license']
/** Only the latest proof needs action. Rejected history must not reopen a saved replacement. */
export function latestIdentityDocument(items: PartnerDocument[]) {
  return items.filter(item => identityKinds.includes(item.kind)).sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
}

export function ApplicationCorrections({ documents }: { documents: PartnerDocument[] }) {
  const bank = usePartnerRead('bank-editor', partnerApi.bank, 30_000)
  const identity = latestIdentityDocument(documents)
  const selfieReady = documents.some(item => item.kind === 'selfie' && (item.status === 'pending' || item.status === 'approved'))
  return <div className="ds-stack">
    {identity?.status === 'rejected' && <section className="ds-card"><h2 className="ds-h2">Replace your identity proof</h2>{identity.reason && <p role="status" className="ds-alert">{identity.reason}</p>}<IdentityCorrection key={identity.id} kind={identity.kind} /></section>}
    {!selfieReady && <section className="ds-card"><h2 className="ds-h2">Update your selfie</h2><DocumentForm kind="selfie" documents={documents} /></section>}
    <ReadPanel query={bank}>{value => value?.status === 'failed' ? <section className="ds-card"><h2 className="ds-h2">Update your bank details</h2><BankLoader /></section> : null}</ReadPanel>
  </div>
}

function IdentityCorrection({ kind: initialKind }: { kind: string }) {
  const [kind, setKind] = useState(initialKind)
  const [file, setFile] = useState<File | null>(null)
  const uploaded = useRef<{ file: File; id: string } | null>(null)
  return <SaveForm label="Submit replacement for review" save={async () => {
    if (!file) throw new Error('Choose your replacement identity proof.')
    const invalid = validateImage(file)
    if (invalid) throw new Error(invalid)
    if (!uploaded.current || uploaded.current.file !== file) uploaded.current = { file, id: await uploadPartnerImage(file) }
    await waitForPartnerMedia(uploaded.current.id)
    return partnerApi.correctIdentity({ kind, media_id: uploaded.current.id })
  }}>
    <p className="ds-sub">Your other application details stay saved. The replacement will be reviewed.</p>
    <Field label="Identity document"><select className="ds-input" value={kind} onChange={e => { setKind(e.target.value); setFile(null); uploaded.current = null }}><option value="passport">Passport</option><option value="voter_id">Voter ID</option><option value="driving_license">Driving Licence</option></select></Field>
    <Field label="Replacement identity proof *" hint="JPG, PNG or WebP · up to 10 MB. No Aadhaar or PAN images."><input key={kind} className="ds-partner-file" type="file" required accept="image/jpeg,image/png,image/webp" onChange={e => { setFile(e.target.files?.[0] ?? null); uploaded.current = null }} /></Field>
  </SaveForm>
}
