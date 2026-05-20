'use client'

import { useState } from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { useMyOrganizations, useCreateOrganization } from '@/hooks/useCommerce'

export default function OrganizationsListPage() {
  const { data, isLoading } = useMyOrganizations()
  const create = useCreateOrganization()
  const orgs = data?.organizations ?? []

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [legalName, setLegalName] = useState('')
  const [gstin, setGstin] = useState('')
  const [billingEmail, setBillingEmail] = useState('')
  const [approvalThreshold, setApprovalThreshold] = useState('')
  const [creditDays, setCreditDays] = useState('0')

  const handleCreate = async () => {
    if (!name.trim()) return
    await create.mutateAsync({
      name: name.trim(),
      legal_name: legalName.trim() || undefined,
      gstin: gstin.trim() || undefined,
      billing_email: billingEmail.trim() || undefined,
      approval_threshold: approvalThreshold ? parseFloat(approvalThreshold) : undefined,
      credit_terms_days: parseInt(creditDays, 10) || 0,
    })
    setShowForm(false)
    setName('')
    setLegalName('')
    setGstin('')
    setBillingEmail('')
    setApprovalThreshold('')
    setCreditDays('0')
  }

  return (
    <AppShell activeTab="Shop">
      <div className="min-h-screen bg-[#F5F0EB]">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-black text-[#1A1A1A]">Organizations</h1>
              <p className="text-sm text-[#6B5544] mt-1">
                Buy on behalf of a company: shared billing, approval routing, credit terms.
              </p>
            </div>
            <button
              onClick={() => setShowForm((v) => !v)}
              className="px-5 py-2.5 bg-[#1A1A1A] text-white rounded-xl font-bold hover:bg-[#3A2E26] transition text-sm"
            >
              {showForm ? 'Cancel' : '+ New Organization'}
            </button>
          </div>

          {showForm && (
            <div className="bg-white rounded-2xl border border-[#E8DDD3] p-6 mb-6">
              <h2 className="text-lg font-bold text-[#1A1A1A] mb-4">Create organization</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs font-bold uppercase tracking-widest text-[#6B5544] mb-1">
                    Name *
                  </span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full border border-[#E8DDD3] rounded-lg px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="block text-xs font-bold uppercase tracking-widest text-[#6B5544] mb-1">
                    Legal name
                  </span>
                  <input
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    className="w-full border border-[#E8DDD3] rounded-lg px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="block text-xs font-bold uppercase tracking-widest text-[#6B5544] mb-1">
                    GSTIN
                  </span>
                  <input
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    placeholder="27ABCDE1234F1Z5"
                    className="w-full border border-[#E8DDD3] rounded-lg px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="block text-xs font-bold uppercase tracking-widest text-[#6B5544] mb-1">
                    Billing email
                  </span>
                  <input
                    type="email"
                    value={billingEmail}
                    onChange={(e) => setBillingEmail(e.target.value)}
                    className="w-full border border-[#E8DDD3] rounded-lg px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="block text-xs font-bold uppercase tracking-widest text-[#6B5544] mb-1">
                    Approval threshold (₹)
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={approvalThreshold}
                    onChange={(e) => setApprovalThreshold(e.target.value)}
                    placeholder="Orders ≥ this need approver"
                    className="w-full border border-[#E8DDD3] rounded-lg px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="block text-xs font-bold uppercase tracking-widest text-[#6B5544] mb-1">
                    Credit terms (days)
                  </span>
                  <select
                    value={creditDays}
                    onChange={(e) => setCreditDays(e.target.value)}
                    className="w-full border border-[#E8DDD3] rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="0">Prepay only</option>
                    <option value="7">Net 7</option>
                    <option value="15">Net 15</option>
                    <option value="30">Net 30</option>
                    <option value="45">Net 45</option>
                    <option value="60">Net 60</option>
                  </select>
                </label>
              </div>
              <button
                onClick={handleCreate}
                disabled={!name.trim() || create.isPending}
                className="mt-4 px-6 py-2 bg-[#1A1A1A] text-white rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-[#3A2E26] disabled:opacity-50"
              >
                {create.isPending ? 'Creating…' : 'Create'}
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="text-sm text-[#6B5544]">Loading organizations…</div>
          ) : orgs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E8DDD3] p-12 text-center">
              <p className="text-sm text-[#6B5544]">
                You don't belong to any organization yet. Create one to start placing business
                orders, or ask an existing admin to invite you.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {orgs.map((o) => (
                <Link
                  key={o.id}
                  href={`/organizations/${o.id}`}
                  className="block bg-white rounded-2xl border border-[#E8DDD3] p-5 hover:border-[#8B5E3C] transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-[#1A1A1A]">{o.name}</div>
                      {o.legal_name && o.legal_name !== o.name && (
                        <div className="text-xs text-[#6B5544]">{o.legal_name}</div>
                      )}
                      {o.gstin && (
                        <div className="text-xs font-mono text-[#6B5544] mt-1">GSTIN {o.gstin}</div>
                      )}
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#F5F0EB] text-[#4A3728]">
                      {o.status}
                    </span>
                  </div>
                  <div className="mt-3 text-xs text-[#6B5544] flex gap-4">
                    {o.approval_threshold && (
                      <span>Approval ≥ ₹{o.approval_threshold.toFixed(0)}</span>
                    )}
                    {o.credit_terms_days > 0 && <span>Net {o.credit_terms_days}d</span>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
