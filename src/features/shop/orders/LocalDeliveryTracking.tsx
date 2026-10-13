'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { freshLocation } from '@/lib/customerTracking'
import { GoogleLocation } from '@/features/maps/GoogleLocation'
import { Button } from '@/components/ui/button'

type LocalJob = { id: string; shipment_id: string; status: string; customer_location?: { lat: number; lng: number; recorded_at: string } }
const labels: Record<string, string> = { awaiting_ready: 'Seller preparing your shipment', unassigned: 'Finding a delivery partner', assigned: 'Partner collecting your shipment', picked_up: 'On the way to you', delivered: 'Delivered', failed: 'Delivery needs assistance', cancelled: 'Delivery cancelled' }

export function LocalDeliveryTracking({ orderId }: { orderId: string }) {
  const [now, setNow] = useState(Date.now())
  const [codes, setCodes] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const active = useRef(true)
  const generation = useRef(0)
  const jobs = useQuery({
    queryKey: ['shop', 'orders', 'local-delivery', orderId],
    queryFn: async () => {
      const data = (await api.get<{ data: LocalJob[] }>(`/v1/commerce/delivery/orders/${encodeURIComponent(orderId)}/jobs`)).data.data
      if (!Array.isArray(data) || data.some(j => !j.id || !j.shipment_id || !labels[j.status])) throw new Error('Invalid delivery response')
      return data
    },
    refetchInterval: 5_000, refetchOnWindowFocus: 'always', refetchOnReconnect: 'always',
  })
  useEffect(() => {
    const visibility = () => { active.current = document.visibilityState === 'visible'; if (!active.current) { generation.current++; setCodes({}) } }
    visibility()
    document.addEventListener('visibilitychange', visibility)
    const timer = setInterval(() => setNow(Date.now()), 5_000)
    return () => { active.current = false; generation.current++; clearInterval(timer); document.removeEventListener('visibilitychange', visibility) }
  }, [orderId])
  useEffect(() => {
    generation.current++
    setCodes(old => Object.fromEntries(Object.entries(old).filter(([id]) => !jobs.isError && jobs.data?.some(j => j.id === id && j.status === 'picked_up'))))
  }, [jobs.data, jobs.isError])
  async function reveal(id: string) {
    if (busy || jobs.isError) return
    const attempt = generation.current
    setBusy(id); setError('')
    try {
      const code = (await api.get<{ data: { delivery_code: string } }>(`/v1/commerce/delivery/customer/jobs/${encodeURIComponent(id)}/code`)).data.data.delivery_code
      if (!/^\d{4,8}$/.test(code)) throw new Error('No code available')
      if (active.current && generation.current === attempt) setCodes(old => ({ ...old, [id]: code }))
    } catch { setError('The delivery code is unavailable. Refresh the shipment before trying again.') }
    finally { setBusy(null) }
  }
  if (jobs.isLoading) return <p role="status">Checking local deliveries…</p>
  if (!jobs.isError && !jobs.data?.length) return null
  return <section className="shop-w2-sec"><h2 className="shop-w2-sec__title">Local deliveries</h2>
    {jobs.isError ? <p role="alert">Delivery updates unavailable. <button type="button" onClick={() => void jobs.refetch()}>Retry</button></p> : null}
    {error ? <p role="alert">{error}</p> : null}
    {jobs.data?.map(job => {
      const fix = job.status === 'picked_up' && !jobs.isError ? freshLocation(job.customer_location, now) : null
      return <article key={job.id} className="mt-4 space-y-3 rounded-xl border p-4"><h3>Shipment {job.shipment_id.slice(0, 8)}</h3><p aria-live="polite">{labels[job.status]}</p>
        {job.status === 'picked_up' ? <>
          {fix ? <GoogleLocation label="Delivery partner location" points={[{ point: { lat: fix.lat, lng: fix.lng }, label: 'Delivery partner' }]} /> : <p>Waiting for a recent delivery partner location.</p>}
          <p>Share the delivery code only after receiving this shipment.</p>
          {codes[job.id] && !jobs.isError ? <p className="text-2xl font-semibold">{codes[job.id]}</p> : <Button variant="outline" disabled={!!busy || jobs.isError} onClick={() => void reveal(job.id)}>{busy === job.id ? 'Loading…' : 'Show delivery code'}</Button>}
        </> : null}
      </article>
    })}
  </section>
}
