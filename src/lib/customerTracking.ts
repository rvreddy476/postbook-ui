/** Notification payloads invalidate authenticated reads; never patch payment or job state. */
export function customerQueryPrefix(type: string): readonly string[] | null {
  if (type.startsWith('doorstep.booking.') || ['doorstep.message.new', 'doorstep.rework.updated', 'doorstep.outstanding.due'].includes(type)) return ['doorstep', 'customer']
  if (type === 'food_order_status') return ['feast', 'customer']
  if (['order_confirmed', 'order_shipped', 'order_delivered', 'order_cancelled', 'order_refunded', 'order_payment_failed'].includes(type)) return ['shop', 'orders']
  if (['ride.assigned', 'ride.arriving', 'ride.arrived', 'ride.started', 'ride.completed', 'ride.cancelled', 'ride.payment.paid'].includes(type)) return ['mopedu', 'customer']
  return null
}

export function freshLocation(point: { lat: number; lng: number; recorded_at: string } | null | undefined, now = Date.now()) {
  if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng) || Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180) return null
  const age = now - Date.parse(point.recorded_at)
  return age >= 0 && age <= 120_000 ? point : null
}

export const rideTrackingStatuses = ['partner_assigned', 'partner_arriving', 'arrived', 'otp_verified', 'in_progress']
export const rideTerminalStatuses = ['completed', 'cancelled_by_customer', 'cancelled_by_partner', 'cancelled_by_admin', 'expired', 'failed']
