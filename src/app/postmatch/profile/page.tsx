'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getPostMatchSession, clearPostMatchAuth } from '@/lib/postmatchApi'
import { checkPostMatchAuth, postmatchLoginRedirect } from '@/lib/postmatchGuard'
import {
  usePostMatchProfile, useUpdatePostMatchProfile,
  usePostMatchPreferences, useUpdatePostMatchPreferences,
  usePostMatchPhotos, useDeletePhoto,
  usePostMatchLogout,
} from '@/hooks/usePostmatch'
import type { Gender, LookingFor, RelationshipIntent } from '@/types/postmatch'

function PostMatchNav({ active }: { active: 'discover' | 'matches' | 'chat' | 'profile' }) {
  const items = [
    { id: 'discover' as const, label: 'Discover', href: '/postmatch/discover', icon: '✦' },
    { id: 'matches' as const, label: 'Matches', href: '/postmatch/matches', icon: '♥' },
    { id: 'chat' as const, label: 'Chat', href: '/postmatch/matches', icon: '💬' },
    { id: 'profile' as const, label: 'Profile', href: '/postmatch/profile', icon: '⚙' },
  ]
  return (
    <nav className="sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-[#1a1a1a]">
      <div className="max-w-lg mx-auto flex items-center justify-between px-4 h-14">
        <Link href="/postmatch" className="text-sm font-black bg-gradient-to-r from-rose-600 to-orange-500 bg-clip-text text-transparent">PostMatch</Link>
        <div className="flex gap-1">
          {items.map(i => (
            <Link key={i.id} href={i.href} className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${active === i.id ? 'bg-rose-50 text-rose-600' : 'text-[#666] hover:text-white'}`}>
              <span className="mr-1">{i.icon}</span>{i.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}

const inputCls = 'w-full border border-[#333] rounded-xl px-4 py-3 text-white bg-[#1a1a1a] focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all text-sm font-medium placeholder:text-[#555]'
const labelCls = 'block text-[10px] font-black uppercase tracking-widest text-[#666] mb-1.5'
const selectCls = `${inputCls} h-[46px] cursor-pointer`

export default function PostMatchProfilePage() {
  const router = useRouter()
  const [session, setSession] = useState<ReturnType<typeof getPostMatchSession>>(null)

  const { data: profile, isLoading: loadingProfile } = usePostMatchProfile()
  const { data: prefs, isLoading: loadingPrefs } = usePostMatchPreferences()
  const { data: photos = [] } = usePostMatchPhotos()
  const updateProfile = useUpdatePostMatchProfile()
  const updatePrefs = useUpdatePostMatchPreferences()
  const deletePhoto = useDeletePhoto()
  const logout = usePostMatchLogout()

  const [tab, setTab] = useState<'profile' | 'preferences' | 'photos'>('profile')
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  // Profile form
  const [firstName, setFirstName] = useState('')
  const [bio, setBio] = useState('')
  const [city, setCity] = useState('')
  const [occupation, setOccupation] = useState('')
  const [education, setEducation] = useState('')
  const [religion, setReligion] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [drinking, setDrinking] = useState('')
  const [smoking, setSmoking] = useState('')
  const [intent, setIntent] = useState<RelationshipIntent>('figuring_out')

  // Preferences form
  const [minAge, setMinAge] = useState(18)
  const [maxAge, setMaxAge] = useState(35)
  const [distanceKm, setDistanceKm] = useState(50)
  const [prefGender, setPrefGender] = useState<LookingFor>('everyone')

  useEffect(() => {
    const state = checkPostMatchAuth()
    if (state === 'unauthenticated') { router.replace(postmatchLoginRedirect('/postmatch/profile')); return }
    if (state === 'needs_onboarding') { router.replace('/postmatch/onboarding'); return }
    setSession(getPostMatchSession())
  }, [router])

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name)
      setBio(profile.bio ?? '')
      setCity(profile.city ?? '')
      setOccupation(profile.occupation ?? '')
      setEducation(profile.education ?? '')
      setReligion(profile.religion ?? '')
      setHeightCm(profile.height_cm?.toString() ?? '')
      setDrinking(profile.drinking ?? '')
      setSmoking(profile.smoking ?? '')
      setIntent(profile.relationship_intent)
    }
  }, [profile])

  useEffect(() => {
    if (prefs) {
      setMinAge(prefs.min_age)
      setMaxAge(prefs.max_age)
      setDistanceKm(prefs.distance_km)
      setPrefGender(prefs.interested_in_gender)
    }
  }, [prefs])

  const handleSaveProfile = async () => {
    setError('')
    setSuccess('')
    if (!profile) return
    try {
      await updateProfile.mutateAsync({
        first_name: firstName,
        date_of_birth: profile.date_of_birth,
        gender: profile.gender,
        looking_for: profile.looking_for,
        relationship_intent: intent,
        bio: bio || undefined,
        city: city || undefined,
        occupation: occupation || undefined,
        education: education || undefined,
        religion: religion || undefined,
        height_cm: heightCm ? parseInt(heightCm) : undefined,
        drinking: drinking || undefined,
        smoking: smoking || undefined,
      })
      setSuccess('Profile updated!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to update profile')
    }
  }

  const handleSavePreferences = async () => {
    setError('')
    setSuccess('')
    try {
      await updatePrefs.mutateAsync({
        min_age: minAge,
        max_age: maxAge,
        distance_km: distanceKm,
        interested_in_gender: prefGender,
        relationship_intent: intent,
      })
      setSuccess('Preferences saved!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to save preferences')
    }
  }

  const handleLogout = async () => {
    try {
      await logout.mutateAsync()
    } catch {
      clearPostMatchAuth()
    }
    router.push('/postmatch')
  }

  const isLoading = loadingProfile || loadingPrefs

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <PostMatchNav active="profile" />

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Profile header */}
        <div className="bg-[#111] rounded-2xl border border-[#222] p-6 mb-4 text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-rose-500 to-orange-500 p-[3px] mx-auto mb-3">
            <div className="w-full h-full rounded-full bg-[#1a1a1a] overflow-hidden flex items-center justify-center">
              {photos.find(p => p.is_primary)?.media_url ? (
                <img src={photos.find(p => p.is_primary)!.media_url!} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[#555] text-3xl font-black">{firstName?.[0] ?? '?'}</span>
              )}
            </div>
          </div>
          <h2 className="text-xl font-black text-white">{firstName || 'Your Profile'}</h2>
          {profile && (
            <div className="flex items-center justify-center gap-3 mt-2">
              <span className="text-xs text-[#666]">{profile.city}</span>
              <span className="inline-block px-2 py-0.5 bg-rose-50 text-rose-500 rounded text-[10px] font-black uppercase tracking-wider">
                {profile.profile_completion_percent}% complete
              </span>
            </div>
          )}
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-[#111] rounded-xl border border-[#222] p-1 mb-4">
          {(['profile', 'preferences', 'photos'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setError(''); setSuccess('') }} className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition ${tab === t ? 'bg-gray-900 text-white' : 'text-[#666] hover:text-white'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Feedback */}
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-xs font-bold text-red-600">{error}</div>}
        {success && <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs font-bold text-emerald-600">{success}</div>}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Profile tab */}
            {tab === 'profile' && (
              <div className="bg-[#111] rounded-2xl border border-[#222] p-6 space-y-4">
                <div><label className={labelCls}>Name</label><input className={inputCls} value={firstName} onChange={e => setFirstName(e.target.value)} /></div>
                <div><label className={labelCls}>Bio</label><textarea className={`${inputCls} resize-none`} rows={3} value={bio} onChange={e => setBio(e.target.value)} maxLength={500} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={labelCls}>City</label><input className={inputCls} value={city} onChange={e => setCity(e.target.value)} /></div>
                  <div><label className={labelCls}>Occupation</label><input className={inputCls} value={occupation} onChange={e => setOccupation(e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={labelCls}>Education</label><input className={inputCls} value={education} onChange={e => setEducation(e.target.value)} /></div>
                  <div><label className={labelCls}>Religion</label><input className={inputCls} value={religion} onChange={e => setReligion(e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div><label className={labelCls}>Height (cm)</label><input type="number" className={inputCls} value={heightCm} onChange={e => setHeightCm(e.target.value)} /></div>
                  <div><label className={labelCls}>Drinking</label><select className={selectCls} value={drinking} onChange={e => setDrinking(e.target.value)}><option value="">—</option><option value="never">Never</option><option value="socially">Socially</option><option value="regularly">Regularly</option></select></div>
                  <div><label className={labelCls}>Smoking</label><select className={selectCls} value={smoking} onChange={e => setSmoking(e.target.value)}><option value="">—</option><option value="never">Never</option><option value="socially">Socially</option><option value="regularly">Regularly</option></select></div>
                </div>
                <div>
                  <label className={labelCls}>Intent</label>
                  <div className="grid grid-cols-2 gap-2">
                    {([['long_term', 'Long-term'], ['marriage', 'Marriage'], ['casual', 'Casual'], ['figuring_out', 'Figuring Out']] as const).map(([val, label]) => (
                      <button key={val} type="button" onClick={() => setIntent(val)} className={`py-2.5 rounded-xl border-2 text-xs font-bold transition ${intent === val ? 'border-rose-500 bg-rose-50 text-rose-600' : 'border-[#222] text-[#666] hover:border-[#333]'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={handleSaveProfile} disabled={updateProfile.isPending} className="w-full py-3 bg-gradient-to-r from-rose-600 to-orange-500 text-white rounded-xl font-bold shadow-lg shadow-rose-500/20 disabled:opacity-50 transition text-sm">
                  {updateProfile.isPending ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            )}

            {/* Preferences tab */}
            {tab === 'preferences' && (
              <div className="bg-[#111] rounded-2xl border border-[#222] p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={labelCls}>Min Age</label><input type="number" min={18} className={inputCls} value={minAge} onChange={e => setMinAge(parseInt(e.target.value) || 18)} /></div>
                  <div><label className={labelCls}>Max Age</label><input type="number" min={minAge} className={inputCls} value={maxAge} onChange={e => setMaxAge(parseInt(e.target.value) || 35)} /></div>
                </div>
                <div>
                  <label className={labelCls}>Max Distance ({distanceKm} km)</label>
                  <input type="range" min={5} max={200} value={distanceKm} onChange={e => setDistanceKm(parseInt(e.target.value))} className="w-full accent-rose-500" />
                  <div className="flex justify-between text-[10px] text-[#555] font-bold mt-1"><span>5 km</span><span>200 km</span></div>
                </div>
                <div>
                  <label className={labelCls}>Interested In</label>
                  <div className="grid grid-cols-3 gap-2">
                    {([['everyone', 'Everyone'], ['male', 'Men'], ['female', 'Women']] as const).map(([val, label]) => (
                      <button key={val} type="button" onClick={() => setPrefGender(val)} className={`py-3 rounded-xl border-2 text-xs font-bold transition ${prefGender === val ? 'border-rose-500 bg-rose-50 text-rose-600' : 'border-[#222] text-[#666] hover:border-[#333]'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={handleSavePreferences} disabled={updatePrefs.isPending} className="w-full py-3 bg-gradient-to-r from-rose-600 to-orange-500 text-white rounded-xl font-bold shadow-lg shadow-rose-500/20 disabled:opacity-50 transition text-sm">
                  {updatePrefs.isPending ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            )}

            {/* Photos tab */}
            {tab === 'photos' && (
              <div className="bg-[#111] rounded-2xl border border-[#222] p-6">
                <div className="grid grid-cols-3 gap-3">
                  {photos.map(p => (
                    <div key={p.id} className="relative aspect-[3/4] rounded-xl overflow-hidden border-2 border-[#222]">
                      {p.media_url ? (
                        <img src={p.media_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-[#1a1a1a] flex items-center justify-center text-[#555] text-xl">📷</div>
                      )}
                      {p.is_primary && <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 px-2 py-1"><span className="text-[9px] font-black text-white uppercase tracking-widest">Primary</span></div>}
                      <button
                        onClick={() => deletePhoto.mutate(p.id)}
                        disabled={deletePhoto.isPending}
                        className="absolute top-2 right-2 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center text-white text-xs hover:bg-red-500 transition"
                      >×</button>
                    </div>
                  ))}
                  {photos.length === 0 && (
                    <div className="col-span-3 py-8 text-center">
                      <p className="text-[#666] text-sm">No photos yet.</p>
                      <Link href="/postmatch/onboarding" className="text-rose-500 text-xs font-bold mt-1 inline-block hover:underline">Upload photos →</Link>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Logout */}
        <div className="mt-6 text-center">
          <button onClick={handleLogout} className="text-xs font-bold text-[#555] hover:text-red-500 uppercase tracking-widest transition">
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}
