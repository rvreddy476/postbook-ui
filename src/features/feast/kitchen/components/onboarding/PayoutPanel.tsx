"use client"

/*
  Bank account. The full account number is typed once, sent once, and then
  dropped from memory: after a save — and on every later visit — only the
  server's mask (****6789) is shown. Replacing the account means typing it
  again. The confirm field guards against a typo nobody can see later.
*/

import { Landmark } from "lucide-react"
import { useEffect, useState } from "react"

import { fetchPayout, putPayout } from "../../api/client"
import { toFailure, type ApiFailure } from "../../model/errors"
import { validateBankAccount, validateIFSC } from "../../model/kyc"
import type { PayoutAccount } from "../../model/wire"
import { FailureNotice, Field, Notice, Pill, useAction } from "../ui"

export function PayoutPanel({ restaurantId, onSaved }: { restaurantId: string; onSaved: () => void }) {
  const [account, setAccount] = useState<PayoutAccount | null>(null)
  const [editing, setEditing] = useState(false)
  const [holder, setHolder] = useState("")
  const [number, setNumber] = useState("")
  const [confirm, setConfirm] = useState("")
  const [ifsc, setIfsc] = useState("")
  const [local, setLocal] = useState<string | null>(null)
  const [loadFailure, setLoadFailure] = useState<ApiFailure | null>(null)
  const [done, setDone] = useState(false)
  const action = useAction()

  useEffect(() => {
    let live = true
    fetchPayout(restaurantId)
      .then((a) => live && setAccount(a))
      .catch((e) => {
        const f = toFailure(e)
        if (!live) return
        if (f.code === "FOOD_NOT_FOUND") setEditing(true)
        else setLoadFailure(f)
      })
    return () => {
      live = false
    }
  }, [restaurantId])

  const clearSecrets = () => {
    setNumber("")
    setConfirm("")
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setDone(false)
    if (!holder.trim()) return setLocal("Enter the account holder's name.")
    const n = validateBankAccount(number)
    if (!n.ok) return setLocal(n.message)
    if (number.trim() !== confirm.trim()) return setLocal("The two account numbers don't match.")
    const i = validateIFSC(ifsc)
    if (!i.ok) return setLocal(i.message)
    setLocal(null)
    const a = await action.run(() => putPayout(restaurantId, { holder_name: holder.trim(), account_number: n.value, ifsc: i.value }))
    // Success or not, the number leaves the form: a failed save is re-typed.
    clearSecrets()
    if (a) {
      setAccount(a)
      setEditing(false)
      setDone(true)
      onSaved()
    }
  }

  const verified = account?.verificationStatus === "VERIFIED"
  const failed = account?.verificationStatus === "FAILED" || account?.verificationStatus === "REJECTED"

  return (
    <div className="kit-form">
      <FailureNotice failure={loadFailure} />
      {done ? <Notice tone="success">Bank account saved. Only the last four digits are kept on screen.</Notice> : null}
      {account && !editing ? (
        <div className="kit-card" style={{ margin: 0 }}>
          <div className="kit-row kit-row--between">
            <div className="kit-row">
              <Landmark size={16} aria-hidden />
              <div>
                <div style={{ fontWeight: 600 }}>
                  {account.holderName} · {account.accountNumberMasked}
                </div>
                <div className="kit-meta">IFSC {account.ifsc}</div>
              </div>
            </div>
            <Pill tone={verified ? "positive" : failed ? "danger" : "warning"}>{verified ? "Verified" : failed ? "Verification failed" : "Verification pending"}</Pill>
          </div>
          <div className="kit-row kit-row--end" style={{ marginTop: 10 }}>
            <button
              type="button"
              className="kit-btn kit-btn--outline kit-btn--sm"
              onClick={() => {
                setHolder(account.holderName)
                setIfsc(account.ifsc)
                setEditing(true)
              }}
            >
              Replace account
            </button>
          </div>
        </div>
      ) : null}
      {editing ? (
        <form className="kit-form kit-form--2" onSubmit={save} noValidate autoComplete="off">
          <Field label="Account holder name" span>
            <input className="kit-input" value={holder} onChange={(e) => setHolder(e.target.value)} maxLength={200} />
          </Field>
          <Field label="Account number" error={action.failure?.field === "account_number" ? action.failure.message : null}>
            <input className="kit-input" inputMode="numeric" value={number} onChange={(e) => setNumber(e.target.value.replace(/\D/g, ""))} maxLength={18} autoComplete="off" spellCheck={false} />
          </Field>
          <Field label="Confirm account number">
            <input className="kit-input" inputMode="numeric" value={confirm} onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ""))} maxLength={18} autoComplete="off" spellCheck={false} onPaste={(e) => e.preventDefault()} />
          </Field>
          <Field label="IFSC" error={action.failure?.field === "ifsc" ? action.failure.message : null}>
            <input className="kit-input" value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} maxLength={11} autoComplete="off" spellCheck={false} />
          </Field>
          <div className="kit-span kit-form">
            {local ? <Notice tone="danger">{local}</Notice> : null}
            <FailureNotice failure={action.failure} />
            <div className="kit-row kit-row--end">
              {account ? (
                <button
                  type="button"
                  className="kit-btn kit-btn--ghost"
                  onClick={() => {
                    clearSecrets()
                    setEditing(false)
                  }}
                >
                  Cancel
                </button>
              ) : null}
              <button type="submit" className="kit-btn kit-btn--primary" disabled={action.busy}>
                {action.busy ? "Saving…" : "Save bank account"}
              </button>
            </div>
          </div>
        </form>
      ) : null}
    </div>
  )
}
