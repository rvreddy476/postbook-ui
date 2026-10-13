import { RideTrackingScreen } from '@/features/mopedu/RideTrackingScreen'

export const metadata = { title: 'Track your Moped ride', robots: { index: false } }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <RideTrackingScreen rideId={id} />
}
