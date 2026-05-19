'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/services/authService'
import AppShell from '@/components/AppShell'
import { useMyPages, useCreatePage } from '@/hooks/useBusinessPages'
import {
  useOnboardingStatus,
  useStartOnboarding,
  useSaveBasicInfo,
  useSaveStorefront,
  useSaveDocuments,
  useSaveFulfillment,
  useSavePayout,
  useSubmitApplication,
} from '@/hooks/useSellerOnboarding'
import type { BusinessType } from '@/types/commerce'
import type { BusinessPage } from '@/types/profile'
import { uploadMedia } from '@/lib/mediaUpload'
import api from '@/lib/api'

// ── Map backend onboarding_step → UI step (1-5) ─────────────────
function backendToUI(step: number): number {
  if (step <= 1) return 1
  if (step <= 3) return 2
  if (step <= 4) return 3
  if (step <= 6) return 4
  return 5
}

const STEPS = [
  { id: 1, label: 'Business Info' },
  { id: 2, label: 'Branding' },
  { id: 3, label: 'KYC Details' },
  { id: 4, label: 'Delivery & Payout' },
  { id: 5, label: 'Review & Submit' },
]

type Phase = 'loading' | 'no_auth' | 'intro' | 'wizard' | 'redirect_status' | 'redirect_dashboard'

export default function SellerOnboardingPage() {
  const router = useRouter()
  const session = typeof window !== 'undefined' ? getSession() : null
  const { data: myPages, isLoading: loadingPages } = useMyPages()
  const { data: seller, isLoading: loadingSeller } = useOnboardingStatus()

  const [uiStep, setUIStep] = useState(0)
  const [draftPage, setDraftPage] = useState<BusinessPage | null>(null)

  // Determine phase
  const isLoading = loadingPages || loadingSeller
  let phase: Phase = 'loading'
  if (!session) {
    phase = 'no_auth'
  } else if (isLoading) {
    phase = 'loading'
  } else if (seller) {
    if (seller.status === 'approved') {
      phase = 'redirect_dashboard'
    } else if (['submitted', 'under_review', 'changes_required', 'rejected'].includes(seller.status)) {
      phase = 'redirect_status'
    } else {
      // draft seller exists — resume wizard
      phase = 'wizard'
    }
  } else {
    // no seller — check if a draft business page exists (orphan from failed start)
    phase = 'intro'
  }

  // Auth redirect
  useEffect(() => {
    if (phase === 'no_auth') {
      router.replace('/login?redirect=/seller/onboarding')
    } else if (phase === 'redirect_dashboard') {
      router.replace('/seller/dashboard')
    } else if (phase === 'redirect_status') {
      router.replace('/seller/application-status')
    }
  }, [phase, router])

  // Resume from last saved step + find draft page
  useEffect(() => {
    if (seller && seller.status === 'draft') {
      setUIStep(backendToUI(seller.onboarding_step))
    }
    if (myPages && seller?.business_page_id) {
      const page = myPages.find(p => p.id === seller.business_page_id)
      if (page) setDraftPage(page)
    } else if (myPages) {
      const draft = myPages.find(p => p.status === 'draft')
      if (draft) setDraftPage(draft)
    }
  }, [seller, myPages])

  // Pre-populate form fields from seller + page
  useEffect(() => {
    if (seller) {
      setStoreName(seller.store_name || '')
      setEmail(seller.email || '')
      setBusinessType((seller.business_type || 'individual') as BusinessType)
      setOwnerName(seller.owner_name || '')
      setPhone(seller.phone || '')
      setCity(seller.city || '')
      setStateName(seller.state || '')
      setDescription(seller.description || '')
      setTagline(seller.tagline || '')
      setSupportEmail(seller.support_email || '')
      setSupportPhone(seller.support_phone || '')
    }
    if (draftPage) {
      setPageHandle(draftPage.page_handle || '')
      setPageName(draftPage.page_name || '')
      setCategory(draftPage.category || 'business')
      if (draftPage.description) setDescription(draftPage.description)
      if (draftPage.business_email) setEmail(draftPage.business_email)
    }
  }, [seller, draftPage])

  // ── Mutations ──────────────────────────────────────────────────
  const createPage = useCreatePage()
  const startOnboarding = useStartOnboarding()
  const saveBasic = useSaveBasicInfo()
  const saveStorefront = useSaveStorefront()
  const saveDocs = useSaveDocuments()
  const saveFulfillment = useSaveFulfillment()
  const savePayout = useSavePayout()
  const submitApp = useSubmitApplication()

  // ── Form state ─────────────────────────────────────────────────
  // Step 1: Basic business info
  const [pageHandle, setPageHandle] = useState('')
  const [pageName, setPageName] = useState('')
  const [category, setCategory] = useState('business')
  const [storeName, setStoreName] = useState('')
  const [email, setEmail] = useState('')
  const [businessType, setBusinessType] = useState<BusinessType>('individual')
  const [description, setDescription] = useState('')

  // Step 2: Branding
  const [tagline, setTagline] = useState('')
  const [supportEmail, setSupportEmail] = useState('')
  const [supportPhone, setSupportPhone] = useState('')

  // Step 3: KYC
  const [ownerName, setOwnerName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [state, setStateName] = useState('')
  const [docs, setDocs] = useState<{ document_type: string; media_id: string; fileName: string; uploading: boolean }[]>([
    { document_type: 'pan_card', media_id: '', fileName: '', uploading: false },
  ])

  // Step 4: Delivery & Payout
  const [deliveryModes, setDeliveryModes] = useState<string[]>(['platform'])
  const [codEnabled, setCodEnabled] = useState(false)
  const [returnWindowDays, setReturnWindowDays] = useState(7)
  const [accountHolder, setAccountHolder] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [ifscCode, setIfscCode] = useState('')
  const [bankName, setBankName] = useState('')

  const [error, setError] = useState('')

  // ── Slug generator ─────────────────────────────────────────────
  const autoSlug = useCallback((name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }, [])

  // ── Document file upload handler ──────────────────────────────
  const handleDocUpload = async (index: number, file: File) => {
    setDocs(prev => prev.map((d, i) => i === index ? { ...d, uploading: true, fileName: file.name } : d))
    try {
      const mediaId = await uploadMedia(file, 'image')
      setDocs(prev => prev.map((d, i) => i === index ? { ...d, media_id: mediaId, uploading: false } : d))
    } catch {
      setDocs(prev => prev.map((d, i) => i === index ? { ...d, uploading: false, fileName: '' } : d))
      setError('File upload failed. Please try again.')
    }
  }

  // ── Step handlers ──────────────────────────────────────────────
  const handleStep1 = async () => {
    setError('')
    if (!pageName.trim() || !email.trim()) {
      setError('Business name and email are required')
      return
    }
    const handle = pageHandle.trim() || autoSlug(pageName)
    try {
      // Create or reuse draft business page
      let pageId = draftPage?.id
      if (!pageId) {
        const page = await createPage.mutateAsync({
          page_handle: handle,
          page_name: pageName,
          category,
          description,
          business_email: email,
          status: 'draft',
        })
        pageId = page.id
        setDraftPage(page)
      }
      // Create draft seller linked to this page
      if (!seller) {
        await startOnboarding.mutateAsync({
          business_page_id: pageId,
          store_name: pageName,
          email,
          business_type: businessType,
        })
      }
      setUIStep(2)
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err.message || 'Failed to create business page'
      if (msg.includes('HANDLE_TAKEN')) {
        setError('That page handle is already taken. Try a different one.')
      } else {
        setError(msg)
      }
    }
  }

  const handleStep2 = async () => {
    setError('')
    try {
      // Update business page branding via PATCH
      if (draftPage) {
        await api.patch(`/v1/pages/${draftPage.id}`, {
          description: description || undefined,
        })
      }
      await saveStorefront.mutateAsync({
        tagline: tagline || undefined,
        support_email: supportEmail || undefined,
        support_phone: supportPhone || undefined,
      })
      setUIStep(3)
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to save branding')
    }
  }

  const handleStep3 = async () => {
    setError('')
    if (!ownerName.trim()) {
      setError('Owner name is required')
      return
    }
    try {
      await saveBasic.mutateAsync({
        store_name: storeName || pageName,
        owner_name: ownerName,
        business_type: businessType,
        email,
        phone: phone || undefined,
        city: city || undefined,
        state: state || undefined,
        description: description || undefined,
      })
      const validDocs = docs.filter(d => d.media_id.trim())
      if (validDocs.length > 0) {
        await saveDocs.mutateAsync(validDocs)
      }
      setUIStep(4)
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to save KYC details')
    }
  }

  const handleStep4 = async () => {
    setError('')
    if (!accountHolder.trim() || !accountNumber.trim()) {
      setError('Account holder name and account number are required')
      return
    }
    try {
      await saveFulfillment.mutateAsync({
        delivery_modes: deliveryModes,
        cod_enabled: codEnabled,
        return_window_days: returnWindowDays,
      })
      await savePayout.mutateAsync({
        account_holder_name: accountHolder,
        account_number: accountNumber,
        ifsc_code: ifscCode || undefined,
        bank_name: bankName || undefined,
      })
      setUIStep(5)
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to save delivery/payout')
    }
  }

  const handleStep5 = async () => {
    setError('')
    try {
      await submitApp.mutateAsync()
      router.push('/seller/application-status')
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to submit application')
    }
  }

  const handleNext = async () => {
    if (uiStep === 1) await handleStep1()
    else if (uiStep === 2) await handleStep2()
    else if (uiStep === 3) await handleStep3()
    else if (uiStep === 4) await handleStep4()
    else if (uiStep === 5) await handleStep5()
  }

  const isSaving =
    createPage.isPending || startOnboarding.isPending || saveBasic.isPending ||
    saveStorefront.isPending || saveDocs.isPending || saveFulfillment.isPending ||
    savePayout.isPending || submitApp.isPending

  // ── Loading / redirect states ──────────────────────────────────
  if (phase === 'loading' || phase === 'no_auth' || phase === 'redirect_dashboard' || phase === 'redirect_status') {
    return (
      <AppShell activeTab="Shop">
        <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 bg-brand-bg">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    )
  }

  // ── Intro screen ───────────────────────────────────────────
  if (phase === 'intro' && uiStep === 0 && !seller && !draftPage) {
    return (
      <AppShell activeTab="Shop">
        <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-brand-bg px-4 py-8">
          <div className="max-w-md w-full bg-brand-card rounded-2xl shadow-lg border border-brand-divider p-8 text-center animate-fadeIn">
            <h1 className="text-2xl font-black text-brand-text mb-2 tracking-tight">Seller Onboarding</h1>
            <p className="text-brand-text/50 mb-8 text-sm font-medium">Launch your store on VChat today.</p>
            <div className="text-left space-y-2.5 mb-8 bg-brand-bg/50 rounded-xl p-5 border border-brand-divider">
              {STEPS.map((s, i) => (
                <div key={s.id} className="flex items-center gap-3">
                  <span className="w-6 h-6 bg-brand-card border border-brand-divider rounded-full flex items-center justify-center text-xs font-black text-brand-text/50">{i+1}</span>
                  <span className="text-sm font-bold text-brand-text/80">{s.label}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setUIStep(1)} className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm shadow-lg shadow-primary/20">Get Started</button>
          </div>
        </div>
      </AppShell>
    )
  }

  // ── Wizard Layout ──────────────────────────────────────────
  const progress = ((uiStep - 1) / (STEPS.length - 1)) * 100
  const inputCls = 'w-full border border-brand-divider rounded-xl px-4 py-2.5 text-brand-text bg-brand-bg/40 focus:bg-brand-bg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm font-medium placeholder:text-brand-text/20'
  const labelCls = 'block text-[10px] font-black uppercase tracking-widest text-brand-text/40 mb-1'

  return (
    <AppShell activeTab="Shop">
      <div className="min-h-[calc(100vh-64px)] bg-brand-bg flex flex-col items-center">
        {/* Progress Header - Balanced */}
        <div className="w-full bg-brand-card border-b border-brand-divider sticky top-0 z-40 shadow-sm">
          <div className="max-w-2xl mx-auto flex items-center justify-between px-6 py-4">
            <h1 className="text-sm font-black text-brand-text uppercase tracking-wider">Store Application</h1>
            <div className="flex-1 max-w-[150px] h-1.5 bg-brand-secondary/50 rounded-full mx-6 overflow-hidden">
              <div className="h-full bg-primary transition-all duration-700 ease-out" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs font-black text-primary uppercase tracking-widest">{Math.round(progress)}%</span>
          </div>
        </div>

        {/* Content Container - Balanced Minimal */}
        <div className="w-full max-w-2xl px-4 py-6 sm:py-10">
          <div className="bg-brand-card rounded-3xl shadow-xl border border-brand-divider p-6 sm:p-10 animate-fadeIn">
            {error && (
              <div className="mb-6 p-4 bg-red-500/5 border border-red-500/10 rounded-xl flex items-start gap-3 text-red-600 dark:text-red-400">
                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="text-xs font-bold leading-relaxed">{error}</span>
              </div>
            )}

            {/* ── Step 1: Basic Business Info ──────────────────── */}
            {uiStep === 1 && (
              <div className="animate-slideUp space-y-4">
                <div className="flex justify-between items-baseline mb-2">
                  <h2 className="text-xl font-black text-brand-text tracking-tight">Business Info</h2>
                  <span className="text-[10px] font-black text-brand-text/30 uppercase tracking-[0.2em]">Step 1/5</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={labelCls}>Business Name*</label><input className={inputCls} placeholder="e.g. My Shop" value={pageName} onChange={e => { setPageName(e.target.value); setStoreName(e.target.value); if (!pageHandle) setPageHandle(autoSlug(e.target.value)) }} /></div>
                  <div><label className={labelCls}>Email*</label><input type="email" className={inputCls} placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} /></div>
                </div>
                <div>
                  <label className={labelCls}>Page Handle</label>
                  <div className="flex items-center gap-2 px-4 py-2.5 border border-brand-divider rounded-xl bg-brand-bg/40 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all">
                    <span className="text-brand-text/30 text-xs font-bold select-none">postbook.com/pages/</span>
                    <input className="flex-1 bg-transparent border-none text-sm font-medium text-brand-text outline-none placeholder:text-brand-text/20" value={pageHandle} onChange={e => setPageHandle(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={labelCls}>Business Type</label><select className={`${inputCls} h-[44px] cursor-pointer`} value={businessType} onChange={e => setBusinessType(e.target.value as BusinessType)}><option value="individual">Individual</option><option value="retailer">Retailer</option><option value="brand">Brand</option></select></div>
                  <div><label className={labelCls}>Description</label><textarea className={`${inputCls} h-[44px] py-3 resize-none`} rows={1} placeholder="Bio..." value={description} onChange={e => setDescription(e.target.value)} /></div>
                </div>
              </div>
            )}

            {/* ── Step 2: Branding ─────────────────────────────── */}
            {uiStep === 2 && (
              <div className="animate-slideUp space-y-4">
                <h2 className="text-xl font-black text-brand-text tracking-tight">Store Branding</h2>
                <div className="space-y-4">
                  <div><label className={labelCls}>Tagline</label><input className={inputCls} placeholder="Catchy brand line" value={tagline} onChange={e => setTagline(e.target.value)} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className={labelCls}>Support Email</label><input type="email" className={inputCls} value={supportEmail} onChange={e => setSupportEmail(e.target.value)} /></div>
                    <div><label className={labelCls}>Support Phone</label><input className={inputCls} value={supportPhone} onChange={e => setSupportPhone(e.target.value)} /></div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 3: Verification ────────────────────────── */}
            {uiStep === 3 && (
              <div className="animate-slideUp space-y-5">
                <h2 className="text-xl font-black text-brand-text tracking-tight">Identity</h2>
                <div className="space-y-4">
                  <div><label className={labelCls}>Owner Name*</label><input className={inputCls} value={ownerName} onChange={e => setOwnerName(e.target.value)} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className={labelCls}>Phone</label><input className={inputCls} value={phone} onChange={e => setPhone(e.target.value)} /></div>
                    <div><label className={labelCls}>City</label><input className={inputCls} value={city} onChange={e => setCity(e.target.value)} /></div>
                  </div>
                  <div className="pt-4 border-t border-brand-divider">
                    <h3 className="text-[10px] font-black text-brand-text/30 uppercase mb-4 tracking-widest">Verification Docs</h3>
                    {docs.map((doc, i) => (
                      <div key={i} className="mb-4 p-4 bg-brand-bg/30 border border-brand-divider rounded-xl space-y-3">
                        <div>
                          <label className={labelCls}>Doc Type</label>
                          <select className={`${inputCls} py-2 h-auto text-xs`} value={doc.document_type} onChange={e => setDocs(prev => prev.map((d, j) => j === i ? { ...d, document_type: e.target.value } : d))}>
                            <option value="pan_card">PAN Card</option>
                            <option value="aadhaar">Aadhaar (Masked)</option>
                            <option value="gst_certificate">GST Certificate</option>
                          </select>
                        </div>
                        {doc.media_id ? (
                          <div className="flex items-center justify-between p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg">
                            <span className="text-xs font-bold text-emerald-600 uppercase truncate flex-1">{doc.fileName || 'Uploaded'}</span>
                            <button type="button" onClick={() => setDocs(prev => prev.map((d, j) => j === i ? { ...d, media_id: '', fileName: '' } : d))} className="text-xs font-black text-red-500/50 hover:text-red-500 ml-3">REMOVE</button>
                          </div>
                        ) : (
                          <label className="flex items-center justify-center p-5 border-2 border-dashed border-brand-divider rounded-xl cursor-pointer hover:bg-brand-bg/50 group transition-all">
                            <span className="text-[10px] font-black text-brand-text/30 group-hover:text-primary transition-colors uppercase tracking-widest">Select secure file</span>
                            <input type="file" className="hidden" accept="image/*,.pdf" onChange={e => { const f = e.target.files?.[0]; if (f) handleDocUpload(i, f) }} />
                          </label>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={() => setDocs(prev => [...prev, { document_type: 'other', media_id: '', fileName: '', uploading: false }])} className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">+ Add Document</button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 4: Fulfillment ─────────────────────────── */}
            {uiStep === 4 && (
              <div className="animate-slideUp space-y-6">
                <h2 className="text-xl font-black text-brand-text tracking-tight">Logistics</h2>
                <div className="grid grid-cols-2 gap-4">
                  {['platform', 'self_ship', 'pickup'].map(mode => (
                    <label key={mode} className={`flex items-center justify-center py-4 rounded-xl border-2 transition-all cursor-pointer ${deliveryModes.includes(mode) ? 'border-primary bg-primary/5' : 'border-brand-divider hover:border-brand-text/10'}`}>
                      <input type="checkbox" className="hidden" checked={deliveryModes.includes(mode)} onChange={e => setDeliveryModes(prev => e.target.checked ? [...prev, mode] : prev.filter(m => m !== mode))} />
                      <span className="text-[10px] font-black text-brand-text/50 uppercase tracking-widest">{mode.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
                <div className="pt-6 border-t border-brand-divider space-y-4">
                  <h3 className="text-[10px] font-black text-brand-text/30 uppercase tracking-widest">Banking Details</h3>
                  <div className="space-y-4">
                    <div><label className={labelCls}>Account Holder*</label><input className={inputCls} value={accountHolder} onChange={e => setAccountHolder(e.target.value)} /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className={labelCls}>Account Number*</label><input className={inputCls} value={accountNumber} onChange={e => setAccountNumber(e.target.value)} /></div>
                      <div><label className={labelCls}>IFSC Code</label><input className={inputCls} value={ifscCode} onChange={e => setIfscCode(e.target.value)} /></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 5: Review ──────────────────────────────── */}
            {uiStep === 5 && (
              <div className="animate-slideUp space-y-4">
                <h2 className="text-xl font-black text-brand-text tracking-tight">Final Summary</h2>
                <div className="bg-brand-bg/50 border border-brand-divider rounded-2xl p-6 space-y-3">
                  <div className="flex justify-between items-center"><span className="text-xs font-black text-brand-text/30 uppercase tracking-widest">Store</span><span className="text-sm font-bold text-brand-text">{pageName}</span></div>
                  <div className="flex justify-between items-center border-t border-brand-divider pt-3"><span className="text-xs font-black text-brand-text/30 uppercase tracking-widest">Email</span><span className="text-sm font-bold text-brand-text">{email}</span></div>
                  <div className="flex justify-between items-center border-t border-brand-divider pt-3"><span className="text-xs font-black text-brand-text/30 uppercase tracking-widest">Owner</span><span className="text-sm font-bold text-brand-text">{ownerName}</span></div>
                </div>
                <p className="text-[10px] font-bold text-brand-text/40 uppercase tracking-widest text-center leading-relaxed">By submitting, you agree to all seller terms.</p>
              </div>
            )}

            {/* ── Fixed Navigation ── */}
            <div className="flex justify-between items-center mt-10 pt-6 border-t border-brand-divider">
              {uiStep > 1 ? (
                <button onClick={() => { setError(''); setUIStep(s => s - 1) }} className="px-6 py-3 rounded-xl border border-brand-divider text-brand-text/60 font-black text-xs uppercase tracking-widest hover:text-brand-text hover:bg-brand-bg transition-all">Back</button>
              ) : (
                <button onClick={() => router.push('/commerce')} className="px-6 py-3 text-brand-text/40 font-black text-xs uppercase tracking-widest hover:text-brand-text">Cancel</button>
              )}
              <button onClick={handleNext} disabled={isSaving} className="px-10 py-3 bg-primary text-primary-foreground rounded-xl font-black shadow-lg shadow-primary/20 hover:opacity-90 active:scale-[0.98] disabled:opacity-50 transition-all text-xs uppercase tracking-widest flex items-center gap-2">
                {isSaving ? (
                  <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                ) : null}
                {uiStep === 5 ? 'Done' : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
