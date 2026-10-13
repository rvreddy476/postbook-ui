import { expect, test } from 'bun:test'
import { decodeNotificationPage, notificationWebLink } from '@/lib/notificationInbox'
import { notificationSseDecoder } from '@/lib/notificationSse'
import { serviceTypeCategories } from '../applicationOptions'

const row = { notification_id: 'notice-1', type: 'doorstep.pro.document.reviewed', bucket: 202610, ts: 'timestamp-key', created_at: '2026-10-09T10:00:00Z', is_read: false, deep_link: 'doorstep-pro://onboarding' }

test('inbox decodes the actual array envelope and retains read keys and history cursor', () => {
  const page = decodeNotificationPage({ data: [row], meta: { next_cursor: 'next-page' } })
  expect(page.next_cursor).toBe('next-page')
  expect(page.notifications[0]).toMatchObject({ id: 'notice-1', bucket: 202610, ts: 'timestamp-key', title: 'Document review updated', deep_link: '/doorstep/partner?tab=setup' })
  expect(page.notifications[0].body).not.toContain('approved')
  expect(decodeNotificationPage({ data: [] })).toEqual({ notifications: [], next_cursor: null })
})

test('bad notification responses do not silently look like an empty inbox', () => {
  for (const data of [null, {}, { data: { notifications: [] } }, { data: [{ ...row, ts: null }] }]) expect(() => decodeNotificationPage(data)).toThrow()
})

test('customer acceptance copy reflects assignment without asserting payment', () => {
  const notification = decodeNotificationPage({ data: [{ ...row, type: 'doorstep.booking.assigned', deep_link: '/doorstep/bookings/test' }] }).notifications[0]
  expect(notification.title).toBe('Your professional has accepted')
  expect(notification.body).not.toContain('paid')
})

test('notification deep links route inside the web app and refuse unsafe destinations', () => {
  expect(notificationWebLink('doorstep-pro://jobs/booking-id')).toBe('/doorstep/partner?tab=jobs')
  expect(notificationWebLink('doorstep-pro://prices')).toBe('/doorstep/partner?tab=prices')
  expect(notificationWebLink('momentum://doorstep/bookings/id')).toBe('/doorstep/bookings/id')
  for (const value of ['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', 'doorstep-pro://unknown', '/%0aevil', '/bad\npath']) expect(notificationWebLink(value)).toBeUndefined()
})

test('stream frames survive every network split, CRLF and multiline data', () => {
  const frame = ':heartbeat\r\nevent: notification\r\ndata: {"payload":\r\ndata: {"notification_id":"a"}}\r\n\r\n'
  for (let split = 0; split <= frame.length; split++) {
    const events: [string, string][] = []
    const read = notificationSseDecoder((event, data) => events.push([event, data]))
    read(frame.slice(0, split)); read(frame.slice(split))
    expect(events).toEqual([['notification', '{"payload":\n{"notification_id":"a"}}']])
  }
})

test('stream parser handles byte-sized chunks and independent events', () => {
  const events: string[] = []
  const read = notificationSseDecoder((event, data) => events.push(event + ':' + data))
  for (const char of 'event:notification\ndata:one\n\ndata:two\n\n') read(char)
  expect(events).toEqual(['notification:one', 'message:two'])
})

test('service categories are derived only from database metadata and deduplicated', () => {
  const item = { code: 'ac', name: 'AC', description: '', requires_certificate: false }
  expect(serviceTypeCategories([item])).toEqual([])
  expect(serviceTypeCategories([{ ...item, categories: [{ id: 'b', name: 'Repair' }, { id: 'a', name: 'Appliances' }] }, { ...item, categories: [{ id: 'b', name: 'Repair' }] }])).toEqual([{ id: 'a', name: 'Appliances' }, { id: 'b', name: 'Repair' }])
})
