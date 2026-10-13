'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import api from '@/lib/api'
import { useAuthUser } from '@/store/auth'
import { GoogleLocation } from '@/features/maps/GoogleLocation'
import { freshLocation, rideTerminalStatuses, rideTrackingStatuses } from '@/lib/customerTracking'

type Ride = {
  id: string; status: string; pickup_address: string; drop_address: string
  pickup_lat: number; pickup_lng: number; drop_lat: number; drop_lng: number
  captain_location?: { lat: number; lng: number; recorded_at: string }; otp?: string
}
const labels: Record<string, string> = {
  requested: 'Ride requested', searching_partner: 'Finding your captain', partner_assigned: 'Captain assigned',
  partner_arriving: 'Captain on the way', arrived: 'Captain arrived', otp_verified: 'Pickup verified',
  in_progress: 'Ride in progress', completed: 'Ride completed', cancelled_by_customer: 'Ride cancelled',
  cancelled_by_partner: 'Ride cancelled by captain', cancelled_by_admin: 'Ride cancelled', expired: 'Request expired', failed: 'Ride could not be arranged', scheduled: 'Ride scheduled',
}

export function RideTrackingScreen({ rideId }: { rideId: string }) {
  const user = useAuthUser()
  const [now, setNow] = useState(Date.now())
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const visibility = () => setVisible(document.visibilityState === 'visible')
    visibility()
    document.addEventListener('visibilitychange', visibility)
    const timer = setInterval(() => setNow(Date.now()), 5_000)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', visibility) }
  }, [])
  const query = useQuery({
    queryKey: ['mopedu', 'customer', user?.id, rideId], enabled: !!user?.id && /^[a-zA-Z0-9-]+$/.test(rideId),
    queryFn: async () => {
      const response = await api.get<{ data: Ride }>(`/v1/rider/rides/${encodeURIComponent(rideId)}`)
      if (!response.data.data || response.data.data.id !== rideId || !response.data.data.status) throw new Error('Invalid ride response')
      return response.data.data
    },
    refetchInterval: 5_000, refetchOnWindowFocus: 'always', refetchOnReconnect: 'always',
  })
  const ride = query.data
  const tracking = !!ride && rideTrackingStatuses.includes(ride.status)
  const fix = tracking && !query.isError ? freshLocation(ride?.captain_location, now) : null
  const paymentEnabled = !!user?.id && !!ride && rideTerminalStatuses.includes(ride.status)
  const payment = useQuery({
    queryKey: ['mopedu', 'customer', user?.id, rideId, 'payment'], enabled: paymentEnabled,
    queryFn: async () => (await api.get<{ data: { status?: string; amount_paise?: number } }>(`/v1/rider/rides/${encodeURIComponent(rideId)}/payment`)).data.data,
    refetchInterval: 10_000, refetchOnWindowFocus: 'always',
  })
  return <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
    <header className="flex items-center justify-between gap-4"><div><Link href="/">Home</Link><h1 className="text-2xl font-semibold">Your Moped ride</h1></div><button type="button" onClick={() => { void query.refetch(); if (paymentEnabled) void payment.refetch() }}>Refresh</button></header>
    {!user ? <p><Link href={`/login?redirect=${encodeURIComponent(`/mopedu/booking/${rideId}`)}`}>Sign in to view your ride</Link></p> : null}
    {query.isLoading ? <p role="status">Loading your ride…</p> : null}
    {query.isError ? <p role="alert">We couldn’t update this ride. {ride ? 'Showing the last loaded status.' : 'Check your connection and try again.'}</p> : null}
    {ride ? <>
      <section className="rounded-2xl border p-6" aria-live="polite"><h2 className="text-xl font-semibold">{labels[ride.status] ?? 'Ride status updated'}</h2><p className="mt-2">From: {ride.pickup_address}</p><p>To: {ride.drop_address}</p><p className="mt-3 text-sm">Last checked: {query.dataUpdatedAt ? new Date(query.dataUpdatedAt).toLocaleTimeString() : 'Not yet checked'}</p></section>
      {tracking ? <section className="rounded-2xl border p-6"><h2 className="text-lg font-semibold">Captain location</h2><p>{fix ? 'Latest reported location. ETA is not available.' : 'Waiting for a recent captain location. ETA is not available.'}</p><GoogleLocation label="Ride tracking map" points={[
        { point: { lat: ride.pickup_lat, lng: ride.pickup_lng }, label: 'Pickup' },
        { point: { lat: ride.drop_lat, lng: ride.drop_lng }, label: 'Destination' },
        ...(fix ? [{ point: { lat: fix.lat, lng: fix.lng }, label: 'Captain' }] : []),
      ]} /></section> : null}
      {visible && !query.isError && ride.otp && ['partner_assigned', 'partner_arriving', 'arrived'].includes(ride.status) ? <section className="rounded-2xl border p-6"><h2>Pickup code</h2><p className="text-2xl font-semibold">{ride.otp}</p><p>Share with your captain only when you meet at pickup.</p></section> : null}
      {paymentEnabled ? <section className="rounded-2xl border p-6"><h2>Payment</h2><p>{payment.isError ? 'Payment status unavailable. Refresh before retrying payment.' : payment.data?.status ? `Status: ${payment.data.status.replaceAll('_', ' ')}` : 'Checking payment status…'}</p></section> : null}
    </> : null}
  </main>
}
