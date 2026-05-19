'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import * as faceapi from 'face-api.js'
import { getPostMatchSession, ssoFromPostbook } from '@/lib/postmatchApi'
import { getSession } from '@/services/authService'
import {
  useUpdatePostMatchProfile,
  useInitPhotoUpload, useCompletePhotoUpload,
} from '@/hooks/usePostmatch'
import type { Gender, LookingFor, RelationshipIntent } from '@/types/postmatch'

type Step = 'rules' | 'personal' | 'media' | 'location'

const ALL_STEPS: Step[] = ['rules', 'personal', 'media', 'location']

export default function OnboardingPage() {
  const router = useRouter()

  const [step, setStep] = useState<Step>('rules')
  const [error, setError] = useState('')
  const [bootstrapping, setBootstrapping] = useState(true)

  // Personal info — all on one page
  const [firstName, setFirstName] = useState('')
  const [dobDay, setDobDay] = useState('')
  const [dobMonth, setDobMonth] = useState('')
  const [dobYear, setDobYear] = useState('')
  const [gender, setGender] = useState<Gender | ''>('')
  const [lookingFor, setLookingFor] = useState<LookingFor | ''>('')
  const [intent, setIntent] = useState<RelationshipIntent | ''>('')

  // Photos + selfie
  const [photos, setPhotos] = useState<{ file: File; preview: string; uploading: boolean; done: boolean }[]>([])
  const [selfie, setSelfie] = useState<{ file: File; preview: string; uploading: boolean; done: boolean } | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dobMonthRef = useRef<HTMLInputElement>(null)
  const dobYearRef = useRef<HTMLInputElement>(null)
  const initUpload = useInitPhotoUpload()
  const completeUpload = useCompletePhotoUpload()

  // Face detection
  const [faceModelsLoaded, setFaceModelsLoaded] = useState(false)
  const [faceStatus, setFaceStatus] = useState<'idle' | 'detecting' | 'matched' | 'no_face' | 'multi_face' | 'mismatch'>('idle')
  const photoDescriptorsRef = useRef<Float32Array[]>([])

  // Location
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [locationStatus, setLocationStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle')

  const updateProfile = useUpdatePostMatchProfile()

  useEffect(() => {
    const run = async () => {
      // Must be logged into AtPost first
      const pbUser = getSession()
      if (!pbUser) {
        router.replace('/login?redirect=/postmatch/onboarding')
        return
      }

      // Pre-populate form from AtPost profile
      const pbFirst = pbUser.firstName || pbUser.name?.split(' ')[0] || ''
      if (pbFirst) setFirstName(pbFirst)
      if (pbUser.dob) {
        // Expected formats: "YYYY-MM-DD" or similar — split safely
        const parts = pbUser.dob.split(/[-/]/)
        if (parts.length === 3) {
          if (parts[0].length === 4) { setDobYear(parts[0]); setDobMonth(parts[1]); setDobDay(parts[2]) }
          else { setDobDay(parts[0]); setDobMonth(parts[1]); setDobYear(parts[2]) }
        }
      }
      if (pbUser.gender) {
        const g = pbUser.gender.toLowerCase()
        if (g === 'male') setGender('male')
        else if (g === 'female') setGender('female')
        else setGender('other')
      }

      // Establish PostMatch session via SSO if needed
      let postmatchSession = getPostMatchSession()
      if (!postmatchSession) {
        const email = (pbUser as { email?: string; loginId?: string }).email ?? pbUser.loginId
        const ok = await ssoFromPostbook(pbUser.id, email)
        if (!ok) {
          setError('Could not connect PostMatch to your VChat account. Please try again.')
          setBootstrapping(false)
          return
        }
        postmatchSession = getPostMatchSession()
      }

      if (postmatchSession?.onboarding_status === 'ready') {
        router.replace('/postmatch/discover')
        return
      }

      setBootstrapping(false)
    }
    run()
  }, [router])

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  // Load face-api.js models when entering media step
  useEffect(() => {
    if (step !== 'media' || faceModelsLoaded) return
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
        ])
        setFaceModelsLoaded(true)
      } catch {
        // Models failed to load — selfie will still work but without face matching
        console.warn('Face detection models failed to load')
      }
    }
    loadModels()
  }, [step, faceModelsLoaded])

  // Extract face descriptors from uploaded profile photos whenever photos change
  useEffect(() => {
    if (!faceModelsLoaded || photos.length === 0) {
      photoDescriptorsRef.current = []
      return
    }
    const extract = async () => {
      const descriptors: Float32Array[] = []
      for (const photo of photos) {
        try {
          const img = await faceapi.fetchImage(photo.preview)
          const detection = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks(true)
            .withFaceDescriptor()
          if (detection) descriptors.push(detection.descriptor)
        } catch {
          // skip photo if face detection fails
        }
      }
      photoDescriptorsRef.current = descriptors
    }
    extract()
  }, [faceModelsLoaded, photos])

  const goTo = useCallback((target: Step) => {
    setError('')
    setStep(target)
  }, [])

  // ── Personal info validation ───────────────────
  const validatePersonal = (): string | null => {
    if (!firstName.trim() || firstName.length > 22) return 'Name must be 1-22 characters'
    const d = parseInt(dobDay), m = parseInt(dobMonth), y = parseInt(dobYear)
    if (!d || !m || !y || d < 1 || d > 31 || m < 1 || m > 12 || y < 1920) return 'Enter a valid date of birth'
    const age = new Date().getFullYear() - y
    if (age < 18) return 'You must be at least 18'
    if (!gender) return 'Select your gender'
    if (!intent) return 'Select what you\'re looking for'
    return null
  }

  // ── Save profile ───────────────────────────────
  const handleSaveProfile = async () => {
    setError('')
    const dob = `${dobYear}-${dobMonth.padStart(2, '0')}-${dobDay.padStart(2, '0')}`
    try {
      await updateProfile.mutateAsync({
        first_name: firstName,
        date_of_birth: dob,
        gender: gender as Gender,
        looking_for: (lookingFor || 'everyone') as LookingFor,
        relationship_intent: (intent || 'figuring_out') as RelationshipIntent,
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
      })
      return true
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to save profile')
      return false
    }
  }

  // ── Photo upload ───────────────────────────────
  const handleUploadAll = async () => {
    setError('')
    if (photos.length < 1) { setError('Upload at least 1 profile photo'); return false }
    if (!selfie) { setError('Selfie is required for verification'); return false }

    const allMedia = [...photos, selfie]
    try {
      for (let i = 0; i < allMedia.length; i++) {
        const item = allMedia[i]
        if (item.done) continue

        // Update uploading state
        if (i < photos.length) {
          setPhotos(prev => prev.map((p, j) => j === i ? { ...p, uploading: true } : p))
        } else {
          setSelfie(prev => prev ? { ...prev, uploading: true } : prev)
        }

        const initRes = await initUpload.mutateAsync({
          content_type: item.file.type,
          file_name: item.file.name,
          file_size: item.file.size,
        })
        await fetch(initRes.upload_url, {
          method: 'PUT',
          body: item.file,
          headers: { 'Content-Type': item.file.type },
        })
        await completeUpload.mutateAsync({
          media_id: initRes.media_id,
          media_key: initRes.media_key,
          is_primary: i === 0,
        })

        if (i < photos.length) {
          setPhotos(prev => prev.map((p, j) => j === i ? { ...p, uploading: false, done: true } : p))
        } else {
          setSelfie(prev => prev ? { ...prev, uploading: false, done: true } : prev)
        }
      }
      return true
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Upload failed')
      setPhotos(prev => prev.map(p => ({ ...p, uploading: false })))
      setSelfie(prev => prev ? { ...prev, uploading: false } : prev)
      return false
    }
  }

  // ── Camera for selfie ──────────────────────────
  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 640 } })
      streamRef.current = stream
      setCameraOpen(true)
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }
      }, 100)
    } catch {
      setError('Camera access denied. Please allow camera to take a selfie.')
    }
  }

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0)

    setFaceStatus('detecting')

    // Face detection + matching
    if (faceModelsLoaded) {
      try {
        const detections = await faceapi.detectAllFaces(canvas, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks(true)
          .withFaceDescriptors()

        if (detections.length === 0) {
          setFaceStatus('no_face')
          return // Don't capture — no face detected
        }
        if (detections.length > 1) {
          setFaceStatus('multi_face')
          return // Don't capture — multiple faces
        }

        const selfieDescriptor = detections[0].descriptor

        // If we have photo descriptors, compare faces
        if (photoDescriptorsRef.current.length > 0) {
          const distances = photoDescriptorsRef.current.map(d =>
            faceapi.euclideanDistance(selfieDescriptor, d)
          )
          const bestMatch = Math.min(...distances)
          // Threshold: 0.6 is standard for face-api.js (lower = more similar)
          if (bestMatch > 0.6) {
            setFaceStatus('mismatch')
            return // Don't capture — face doesn't match profile photos
          }
        }

        setFaceStatus('matched')
      } catch {
        // If face detection fails, allow selfie but mark as idle
        setFaceStatus('idle')
      }
    }

    canvas.toBlob((blob) => {
      if (!blob) return
      const file = new File([blob], `selfie-${Date.now()}.jpg`, { type: 'image/jpeg' })
      setSelfie({ file, preview: URL.createObjectURL(blob), uploading: false, done: false })
      closeCamera()
    }, 'image/jpeg', 0.9)
  }

  const closeCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCameraOpen(false)
  }

  // ── Photo add ──────────────────────────────────
  const handleAddPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    const newPhotos = files.map(f => ({
      file: f, preview: URL.createObjectURL(f), uploading: false, done: false,
    }))
    setPhotos(prev => [...prev, ...newPhotos].slice(0, 6))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Location ───────────────────────────────────
  const requestLocation = () => {
    if (!navigator.geolocation) { setLocationStatus('denied'); return }
    setLocationStatus('requesting')
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLatitude(pos.coords.latitude); setLongitude(pos.coords.longitude); setLocationStatus('granted') },
      () => { setLocationStatus('denied') },
      { enableHighAccuracy: false, timeout: 10000 }
    )
  }

  // ── Step handlers ──────────────────────────────
  const handleContinue = async () => {
    setError('')
    switch (step) {
      case 'personal': {
        const err = validatePersonal()
        if (err) { setError(err); return }
        goTo('media')
        break
      }
      case 'media': {
        const uploaded = await handleUploadAll()
        if (uploaded) goTo('location')
        break
      }
      case 'location': {
        const saved = await handleSaveProfile()
        if (saved) router.push('/postmatch/discover')
        break
      }
      default:
        break
    }
  }

  const isSaving = updateProfile.isPending || initUpload.isPending || completeUpload.isPending

  const stepIndex = ALL_STEPS.indexOf(step)
  const progress = (stepIndex / (ALL_STEPS.length - 1)) * 100

  if (bootstrapping) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#222] border-t-rose-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#888] text-sm font-medium">Connecting PostMatch to your VChat account…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* ── Top bar ─────────────────────────────── */}
      <div className="sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-[#1a1a1a]">
        <div className="max-w-xl mx-auto flex items-center justify-between px-5 h-14">
          <Link href="/postmatch" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-600 to-orange-500 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            </div>
            <span className="text-base font-black tracking-tight text-white">PostMatch</span>
          </Link>
          <span className="text-xs font-semibold text-[#666]">Step {stepIndex + 1} of {ALL_STEPS.length}</span>
        </div>
        <div className="h-1 bg-[#1a1a1a]">
          <div className="h-full bg-gradient-to-r from-rose-600 to-orange-500 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="max-w-xl mx-auto px-5 py-8">
        {/* Error banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm font-medium flex items-center gap-3">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
            {error}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            RULES
        ═══════════════════════════════════════════════════════ */}
        {step === 'rules' && (
          <div className="max-w-sm mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-black mb-1">Community Guidelines</h1>
              <p className="text-[#666] text-sm">A few things to keep in mind</p>
            </div>

            <div className="bg-[#111] rounded-2xl border border-[#222] divide-y divide-[#1a1a1a] mb-8">
              {[
                { icon: '🪪', title: 'Be authentic', desc: 'Use real photos and accurate info. Fake profiles get removed.' },
                { icon: '🔒', title: 'Protect your privacy', desc: 'Don\'t share personal details like address or finances early on.' },
                { icon: '🤝', title: 'Be respectful', desc: 'Treat others the way you\'d want to be treated. Zero tolerance for harassment.' },
                { icon: '🚩', title: 'Report concerns', desc: 'See something wrong? Report it. We review every case.' },
              ].map((rule, i) => (
                <div key={i} className="flex gap-4 p-4">
                  <span className="text-2xl flex-shrink-0 mt-0.5">{rule.icon}</span>
                  <div>
                    <h3 className="font-bold text-white text-sm">{rule.title}</h3>
                    <p className="text-[#666] text-xs mt-0.5 leading-relaxed">{rule.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => goTo('personal')}
              className="w-full py-4 bg-white text-black rounded-2xl font-bold text-sm hover:bg-[#1a1a1a] active:scale-[0.98] transition-all"
            >
              I Agree — Continue
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            PERSONAL INFO — ALL IN ONE PAGE
        ═══════════════════════════════════════════════════════ */}
        {step === 'personal' && (
          <div>
            <div className="mb-6">
              <h1 className="text-2xl font-black">About you</h1>
              <p className="text-[#666] text-sm mt-1">Tell us a bit about yourself. All fields are required.</p>
            </div>

            <div className="bg-[#111] rounded-2xl border border-[#222] p-5 space-y-5">
              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-[#888] mb-1.5 uppercase tracking-wider">First Name</label>
                <input
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-3 text-white text-sm font-medium focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition placeholder:text-[#555]"
                  placeholder="Your first name"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  maxLength={22}
                  autoFocus
                />
                <p className="text-[10px] text-[#666] mt-1">This appears on your profile. 1-22 characters.</p>
              </div>

              {/* Date of birth */}
              <div>
                <label className="block text-xs font-bold text-[#888] mb-1.5 uppercase tracking-wider">Date of Birth</label>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    className="bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-3 text-center text-sm font-bold text-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition placeholder:text-[#555]"
                    placeholder="DD"
                    value={dobDay}
                    onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 2); setDobDay(v); if (v.length === 2) dobMonthRef.current?.focus() }}
                    maxLength={2}
                  />
                  <input
                    ref={dobMonthRef}
                    className="bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-3 text-center text-sm font-bold text-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition placeholder:text-[#555]"
                    placeholder="MM"
                    value={dobMonth}
                    onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 2); setDobMonth(v); if (v.length === 2) dobYearRef.current?.focus() }}
                    maxLength={2}
                  />
                  <input
                    ref={dobYearRef}
                    className="bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-3 text-center text-sm font-bold text-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition placeholder:text-[#555]"
                    placeholder="YYYY"
                    value={dobYear}
                    onChange={e => setDobYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    maxLength={4}
                  />
                </div>
                <p className="text-[10px] text-[#666] mt-1">Your age will be shown publicly. Must be 18+.</p>
              </div>

              {/* Gender */}
              <div>
                <label className="block text-xs font-bold text-[#888] mb-1.5 uppercase tracking-wider">Gender</label>
                <div className="grid grid-cols-4 gap-2">
                  {([
                    ['male', 'Man'],
                    ['female', 'Woman'],
                    ['non_binary', 'Non-Binary'],
                    ['other', 'Other'],
                  ] as const).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setGender(val)}
                      className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${
                        gender === val
                          ? 'border-rose-500 bg-rose-50 text-rose-600'
                          : 'border-[#333] text-[#666] hover:border-[#555] bg-[#111]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Interested in */}
              <div>
                <label className="block text-xs font-bold text-[#888] mb-1.5 uppercase tracking-wider">Interested In</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ['everyone', 'Everyone'],
                    ['male', 'Men'],
                    ['female', 'Women'],
                  ] as const).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setLookingFor(val)}
                      className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${
                        lookingFor === val
                          ? 'border-rose-500 bg-rose-50 text-rose-600'
                          : 'border-[#333] text-[#666] hover:border-[#555] bg-[#111]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Intent */}
              <div>
                <label className="block text-xs font-bold text-[#888] mb-1.5 uppercase tracking-wider">Looking For</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ['long_term', 'Long-term partner', '💞'],
                    ['marriage', 'Marriage', '💍'],
                    ['casual', 'Something casual', '🎈'],
                    ['figuring_out', 'Still exploring', '🧭'],
                  ] as const).map(([val, label, icon]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setIntent(val)}
                      className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-left transition-all ${
                        intent === val
                          ? 'border-rose-500 bg-rose-50'
                          : 'border-[#333] bg-[#111] hover:border-[#555]'
                      }`}
                    >
                      <span className="text-lg">{icon}</span>
                      <span className={`text-xs font-bold ${intent === val ? 'text-rose-600' : 'text-[#888]'}`}>{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Continue button */}
            <button
              onClick={handleContinue}
              disabled={isSaving}
              className="w-full mt-6 py-4 bg-gradient-to-r from-rose-600 to-orange-500 text-white rounded-2xl font-bold text-sm disabled:opacity-30 hover:shadow-lg hover:shadow-rose-500/20 active:scale-[0.98] transition-all"
            >
              Continue
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            MEDIA — PHOTOS + SELFIE (mandatory)
        ═══════════════════════════════════════════════════════ */}
        {step === 'media' && (
          <div>
            <div className="mb-6">
              <h1 className="text-2xl font-black">Photos & Selfie</h1>
              <p className="text-[#666] text-sm mt-1">Upload profile photos and take a selfie for verification.</p>
            </div>

            {/* Profile Photos */}
            <div className="bg-[#111] rounded-2xl border border-[#222] p-5 mb-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-bold text-sm text-white">Profile Photos</h3>
                  <p className="text-[11px] text-[#666]">At least 1 required. Up to 6.</p>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${photos.length > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-[#1a1a1a] text-[#666]'}`}>
                  {photos.length}/6
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {Array.from({ length: 6 }).map((_, i) => {
                  const photo = photos[i]
                  if (photo) {
                    return (
                      <div key={i} className="relative aspect-[3/4] rounded-xl overflow-hidden border border-[#333]">
                        <img src={photo.preview} alt="" className="w-full h-full object-cover" />
                        {photo.uploading && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                        {photo.done && (
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                          </div>
                        )}
                        {i === 0 && (
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 px-2 py-1">
                            <span className="text-[8px] font-bold text-white uppercase tracking-wider">Primary</span>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => { URL.revokeObjectURL(photo.preview); setPhotos(prev => prev.filter((_, j) => j !== i)) }}
                          className="absolute top-1.5 left-1.5 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-red-500 transition"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                      </div>
                    )
                  }
                  return (
                    <label key={i} className="aspect-[3/4] rounded-xl border-2 border-dashed border-[#333] flex flex-col items-center justify-center cursor-pointer hover:border-rose-400 hover:bg-rose-50/30 transition group">
                      <div className="w-7 h-7 rounded-full bg-[#1a1a1a] group-hover:bg-rose-100 flex items-center justify-center transition">
                        <svg className="w-4 h-4 text-[#666] group-hover:text-rose-500 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                      </div>
                      <input ref={i === photos.length ? fileInputRef : undefined} type="file" className="hidden" accept="image/jpeg,image/png,image/webp" multiple onChange={handleAddPhoto} />
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Selfie Section */}
            <div className="bg-[#111] rounded-2xl border border-[#222] p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-bold text-sm text-white">Selfie Verification <span className="text-red-500">*</span></h3>
                  <p className="text-[11px] text-[#666]">Required. Your selfie must match your profile photos.</p>
                </div>
                {!faceModelsLoaded && step === 'media' && (
                  <span className="text-[10px] font-bold text-[#555] flex items-center gap-1.5">
                    <div className="w-3 h-3 border border-[#555] border-t-transparent rounded-full animate-spin" />
                    Loading AI...
                  </span>
                )}
                {selfie && faceStatus === 'matched' && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500">Verified</span>
                )}
                {selfie && faceStatus !== 'matched' && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-500">Done</span>
                )}
              </div>

              {cameraOpen ? (
                /* Camera viewfinder */
                <div className="relative rounded-2xl overflow-hidden bg-black">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full aspect-square object-cover scale-x-[-1]" />
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Oval guide overlay */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-48 h-60 border-[3px] border-white/40 rounded-[50%]" />
                  </div>
                  <p className="absolute top-4 left-0 right-0 text-center text-white text-xs font-bold">
                    {faceStatus === 'detecting' ? 'Analyzing face...' : 'Position your face in the oval'}
                  </p>

                  {/* Face detection feedback */}
                  {faceStatus === 'no_face' && (
                    <div className="absolute top-12 left-4 right-4 bg-red-500/90 backdrop-blur rounded-xl px-4 py-2 text-center">
                      <p className="text-white text-xs font-bold">No face detected. Look directly at the camera.</p>
                    </div>
                  )}
                  {faceStatus === 'multi_face' && (
                    <div className="absolute top-12 left-4 right-4 bg-red-500/90 backdrop-blur rounded-xl px-4 py-2 text-center">
                      <p className="text-white text-xs font-bold">Multiple faces detected. Only your face should be visible.</p>
                    </div>
                  )}
                  {faceStatus === 'mismatch' && (
                    <div className="absolute top-12 left-4 right-4 bg-amber-500/90 backdrop-blur rounded-xl px-4 py-2 text-center">
                      <p className="text-white text-xs font-bold">Face doesn&apos;t match your profile photos. Try again.</p>
                    </div>
                  )}

                  <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-4">
                    <button
                      onClick={() => { closeCamera(); setFaceStatus('idle') }}
                      className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white hover:bg-white/30 transition"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                    <button
                      onClick={capturePhoto}
                      disabled={faceStatus === 'detecting'}
                      className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center hover:scale-105 active:scale-95 transition disabled:opacity-50"
                    >
                      {faceStatus === 'detecting' ? (
                        <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-white" />
                      )}
                    </button>
                    <div className="w-12" /> {/* spacer */}
                  </div>
                </div>
              ) : selfie ? (
                /* Selfie preview */
                <div className="relative">
                  <div className={`w-32 h-32 rounded-full overflow-hidden border-4 mx-auto ${faceStatus === 'matched' ? 'border-emerald-400' : 'border-rose-300'}`}>
                    <img src={selfie.preview} alt="Selfie" className="w-full h-full object-cover" />
                  </div>
                  {faceStatus === 'matched' && (
                    <div className="flex items-center justify-center gap-1.5 mt-2">
                      <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <span className="text-xs font-bold text-emerald-500">Face verified — matches your photos</span>
                    </div>
                  )}
                  {selfie.uploading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  <button
                    onClick={() => { URL.revokeObjectURL(selfie.preview); setSelfie(null); setFaceStatus('idle') }}
                    className="mx-auto mt-3 flex items-center gap-1.5 text-xs font-bold text-[#666] hover:text-red-500 transition"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                    Retake
                  </button>
                </div>
              ) : (
                /* Take selfie button */
                <button
                  onClick={openCamera}
                  className="w-full flex items-center justify-center gap-3 py-8 border-2 border-dashed border-[#333] rounded-2xl hover:border-rose-400 hover:bg-rose-50/30 transition group"
                >
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-rose-100 to-orange-100 flex items-center justify-center group-hover:from-rose-200 group-hover:to-orange-200 transition">
                    <svg className="w-7 h-7 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" /></svg>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-sm text-white group-hover:text-rose-600 transition">Take a Selfie</p>
                    <p className="text-[11px] text-[#666]">Opens your camera for a live photo</p>
                  </div>
                </button>
              )}
            </div>

            {/* Continue / Back */}
            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => goTo('personal')}
                className="px-6 py-4 rounded-2xl text-[#666] font-bold text-sm hover:bg-[#1a1a1a] transition"
              >
                Back
              </button>
              <button
                onClick={handleContinue}
                disabled={isSaving || photos.length < 1 || !selfie}
                className="flex-1 py-4 bg-gradient-to-r from-rose-600 to-orange-500 text-white rounded-2xl font-bold text-sm disabled:opacity-30 hover:shadow-lg hover:shadow-rose-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                {isSaving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {isSaving ? 'Uploading...' : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            LOCATION
        ═══════════════════════════════════════════════════════ */}
        {step === 'location' && (
          <div className="max-w-sm mx-auto text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-rose-100 to-orange-100 flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
            </div>
            <h1 className="text-2xl font-black mb-2">Find people near you</h1>
            <p className="text-[#666] text-sm leading-relaxed max-w-xs mx-auto mb-8">
              We use your location to show matches nearby. This helps find people you can actually meet.
            </p>

            {locationStatus === 'idle' && (
              <div className="space-y-3">
                <button
                  onClick={requestLocation}
                  className="w-full py-4 bg-gradient-to-r from-rose-600 to-orange-500 text-white rounded-2xl font-bold text-sm hover:shadow-lg hover:shadow-rose-500/20 active:scale-[0.98] transition-all"
                >
                  Enable Location
                </button>
                <button
                  onClick={handleContinue}
                  disabled={isSaving}
                  className="w-full py-3 text-[#666] font-bold text-sm hover:text-white transition"
                >
                  {isSaving ? 'Saving...' : 'Skip for now'}
                </button>
              </div>
            )}

            {locationStatus === 'requesting' && (
              <div className="py-6">
                <div className="w-8 h-8 border-[3px] border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-[#666] text-sm font-medium">Waiting for permission...</p>
              </div>
            )}

            {locationStatus === 'granted' && (
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-full">
                  <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                  <span className="text-emerald-600 text-sm font-bold">Location enabled</span>
                </div>
                <button
                  onClick={handleContinue}
                  disabled={isSaving}
                  className="w-full py-4 bg-gradient-to-r from-rose-600 to-orange-500 text-white rounded-2xl font-bold text-sm disabled:opacity-30 hover:shadow-lg hover:shadow-rose-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  {isSaving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  Find Matches
                </button>
              </div>
            )}

            {locationStatus === 'denied' && (
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-100 rounded-full">
                  <span className="text-amber-600 text-sm font-bold">Location unavailable</span>
                </div>
                <p className="text-[#666] text-xs leading-relaxed max-w-xs mx-auto">
                  Matches won&apos;t be sorted by distance. You can enable location later in settings.
                </p>
                <button
                  onClick={handleContinue}
                  disabled={isSaving}
                  className="w-full py-4 bg-gradient-to-r from-rose-600 to-orange-500 text-white rounded-2xl font-bold text-sm disabled:opacity-30 hover:shadow-lg hover:shadow-rose-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  {isSaving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  Continue Without Location
                </button>
              </div>
            )}

            <button
              onClick={() => goTo('media')}
              className="mt-4 text-xs font-bold text-[#666] hover:text-white transition"
            >
              Go Back
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
