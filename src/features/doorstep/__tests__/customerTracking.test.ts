import { describe, expect, test } from 'bun:test'
import { customerQueryPrefix, freshLocation, rideTerminalStatuses } from '../../../lib/customerTracking'
import { parseFrame } from '../hooks/live'

describe('customer tracking hints', () => {
  test('reads the actual Home Services backend location event name', () => {
    const parsed = parseFrame(JSON.stringify({ event_type: 'doorstep.booking.pro_location', data: { lat: 17.4, lng: 78.5, eta_minutes: 8, at: '2026-10-12T10:00:00Z' } }))
    expect(parsed?.fix?.etaMinutes).toBe(8)
  })
  test('refreshes authoritative reads for all four services', () => {
    expect(customerQueryPrefix('doorstep.booking.assigned')).toEqual(['doorstep', 'customer'])
    expect(customerQueryPrefix('food_order_status')).toEqual(['feast', 'customer'])
    expect(customerQueryPrefix('order_delivered')).toEqual(['shop', 'orders'])
    expect(customerQueryPrefix('ride.arrived')).toEqual(['mopedu', 'customer'])
    expect(customerQueryPrefix('seller_order_paid')).toBeNull()
    expect(customerQueryPrefix('ride.offer')).toBeNull()
  })
  test('never displays invalid, future or stale positions', () => {
    const now = Date.parse('2026-10-12T10:00:00Z')
    const point = { lat: 17.4, lng: 78.5, recorded_at: new Date(now).toISOString() }
    expect(freshLocation(point, now)).toEqual(point)
    expect(freshLocation(point, now + 120_001)).toBeNull()
    expect(freshLocation(point, now - 1)).toBeNull()
    expect(freshLocation({ ...point, lat: NaN }, now)).toBeNull()
    expect(freshLocation({ ...point, lng: 181 }, now)).toBeNull()
    expect(freshLocation({ ...point, recorded_at: 'invalid' }, now)).toBeNull()
    expect(freshLocation(null, now)).toBeNull()
  })
  test('terminal tracking includes every cancellation actor', () => {
    for (const status of ['completed', 'cancelled_by_customer', 'cancelled_by_partner', 'cancelled_by_admin', 'expired', 'failed']) {
      expect(rideTerminalStatuses).toContain(status)
    }
  })
})
