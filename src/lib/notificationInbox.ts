export interface InboxNotification {
  id: string
  type: string
  title: string
  body: string
  deep_link?: string
  is_read: boolean
  created_at: string
  bucket: number
  ts: string
}

const copy: Record<string, [string, string]> = {
  'food_order_status': ['Food order updated', 'Open your order for preparation, delivery and payment details.'],
  'order_confirmed': ['Shopping order confirmed', 'View your order and shipment progress.'],
  'order_shipped': ['Your order is on the way', 'Track each shipment in your order.'],
  'order_delivered': ['Delivery completed', 'View delivery details and your order summary.'],
  'order_cancelled': ['Shopping order cancelled', 'Open your order for cancellation details.'],
  'order_refunded': ['Refund updated', 'Check the confirmed refund status in your order.'],
  'order_payment_failed': ['Payment needs attention', 'Open your order to check payment before retrying.'],
  'ride.assigned': ['Moped captain assigned', 'Track your captain and ride details.'],
  'ride.arriving': ['Your captain is on the way', 'Open your ride for the latest location.'],
  'ride.arrived': ['Your captain has arrived', 'Open your ride to view your pickup code.'],
  'ride.started': ['Your ride has started', 'Track your current trip.'],
  'ride.completed': ['Ride completed', 'View your trip and payment status.'],
  'ride.cancelled': ['Ride cancelled', 'Check your ride for the latest details.'],
  'ride.payment.paid': ['Ride payment confirmed', 'View your ride receipt.'],
  'doorstep.pro.application.approved': ['Application approved', 'Your partner application has been approved. Review your work settings to get ready for bookings.'],
  'doorstep.pro.application.rejected': ['Application needs attention', 'Open your application to review the decision and next steps.'],
  'doorstep.pro.document.reviewed': ['Document review updated', 'An administrator has reviewed your document. Open work settings to see the decision.'],
  'doorstep.pro.change.reviewed': ['Your changes have been reviewed', 'Open work settings to see the decision and any requested corrections.'],
  'doorstep.pro.price.reviewed': ['Service price reviewed', 'Open Services & prices to see the decision.'],
  'doorstep.pro.account.suspended': ['Account paused', 'Open your account for details. New assignments are paused.'],
  'doorstep.pro.account.reinstated': ['Account reactivated', 'Your partner account is active again.'],
  'doorstep.pro.offer.new': ['New service request', 'Review the request and its availability in Your jobs.'],
  'doorstep.pro.job.cancelled': ['Job cancelled', 'Open Your jobs for the latest booking details.'],
  'doorstep.pro.job.rescheduled': ['Job rescheduled', 'Check the updated visit time in Your jobs.'],
  'doorstep.pro.job.reminder': ['Upcoming visit', 'Check your next service appointment.'],
  'doorstep.pro.message.new': ['New customer message', 'Open the job to read and reply.'],
  'doorstep.pro.settlement.computed': ['Earnings statement ready', 'View your latest earnings and adjustments.'],
  'doorstep.booking.assigned': ['Your professional has accepted', 'Review your appointment and complete any payment due to confirm it.'],
  'doorstep.booking.confirmed': ['Booking confirmed', 'Your service booking is confirmed.'],
  'doorstep.booking.cancelled': ['Booking cancelled', 'Open your booking for cancellation and refund details.'],
  'doorstep.booking.completed': ['Service completed', 'View your booking summary and share feedback.'],
  'doorstep.booking.pro_en_route': ['Your professional is on the way', 'Follow the visit in your booking.'],
  'doorstep.booking.pro_arrived': ['Your professional has arrived', 'Open your booking to continue.'],
  'doorstep.booking.extras_payment_due': ['Payment requested', 'Review the approved additional work and payment in your booking.'],
  'doorstep.message.new': ['New service message', 'Open your booking to read and reply.'],
  'follow': ['New follower', 'Someone started following you.'],
  'reaction': ['New reaction', 'Someone reacted to your post.'],
  'comment': ['New comment', 'Someone commented on your post.'],
  'friend_request': ['New friend request', 'Open the request to respond.'],
  'friend_accepted': ['Friend request accepted', 'Your friend request was accepted.'],
}

/** Stored mobile links must never launch an arbitrary scheme or external URL. */
export function notificationWebLink(value: unknown): string | undefined {
  if (typeof value !== 'string' || /[\\\x00-\x20]/.test(value)) return undefined
  if (value.startsWith('doorstep-pro://')) {
    const route = value.slice('doorstep-pro://'.length).split(/[/?#]/)[0]
    const tabs: Record<string, string> = { home: 'dashboard', account: 'setup', onboarding: 'setup', prices: 'prices', earnings: 'earnings', jobs: 'jobs', offers: 'jobs' }
    return tabs[route] ? `/doorstep/partner?tab=${tabs[route]}` : undefined
  }
  const path = value.startsWith('momentum://') ? '/' + value.slice('momentum://'.length) : value
  if (!path.startsWith('/') || path.startsWith('//') || /%0[ad]/i.test(path)) return undefined
  return path
}

export function decodeNotificationPage(value: unknown): { notifications: InboxNotification[]; next_cursor: string | null } {
  const envelope = value as { data?: unknown; meta?: { next_cursor?: unknown } } | null
  if (!envelope || !Array.isArray(envelope.data)) throw new Error('Notifications could not be loaded. Please try again.')
  const notifications = envelope.data.map((row: unknown): InboxNotification => {
    const n = row as Record<string, unknown> | null
    if (!n || typeof n.notification_id !== 'string' || typeof n.type !== 'string' || !Number.isInteger(n.bucket) || typeof n.ts !== 'string' || typeof n.created_at !== 'string' || typeof n.is_read !== 'boolean') throw new Error('A notification could not be read. Please refresh.')
    const text = copy[n.type] ?? (n.type.startsWith('doorstep.pro.') ? ['Partner update', 'Open your workspace for details.'] : n.type.startsWith('doorstep.') ? ['Service booking update', 'Open your booking for details.'] : ['New notification', 'Open this update for details.'])
    return { id: n.notification_id, type: n.type, title: text[0], body: text[1], deep_link: notificationWebLink(n.deep_link), is_read: n.is_read, created_at: n.created_at, bucket: n.bucket as number, ts: n.ts }
  })
  return { notifications, next_cursor: typeof envelope.meta?.next_cursor === 'string' && envelope.meta.next_cursor ? envelope.meta.next_cursor : null }
}
