import { describe, expect, test } from 'bun:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { decodeNotificationPage } from '@/lib/notificationInbox'
import {
  GENERIC_ACTOR_SENTENCE,
  NOTIFICATION_ICONS,
  bellLine,
  bellRow,
  notificationActorId,
  notificationHasActor,
  notificationIcon,
  notificationPresentationFields,
  notificationTitle,
} from '@/lib/notificationPresentation'
import { NOTIFICATION_GLYPHS, NotificationGlyph } from '@/components/notifications/NotificationGlyph'
import { ActivityList } from '../ActivityList'

const ZERO = '00000000-0000-0000-0000-000000000000'
const ACTOR = '6f1c2a3b-0000-4000-8000-00000000abcd'

const row = (extra: Record<string, unknown> = {}) => ({
  notification_id: 'n1', type: 'commerce_order_shipped', bucket: 202610, ts: 'ts-1', created_at: '2026-10-18T09:00:00Z', is_read: false, deep_link: '/orders/o1', actor_user_id: ZERO, ...extra,
})
const decode = (extra: Record<string, unknown> = {}) => decodeNotificationPage({ data: [row(extra)] }).notifications[0]

/** Stored types seen on dev that must never fall to the generic line once the server sends a title. */
const REAL_TYPES = [
  'commerce_order_created', 'dm', 'commerce_order_shipped', 'order_delivered', 'commerce_invoice_issued', 'food_order_status',
  'commerce_order_paid', 'friend_request', 'dating.verification.completed', 'follow', 'reaction', 'comment',
  'doorstep.pro.price.reviewed', 'creator_went_live', 'dating.spark.created', 'dating.match.expired', 'commerce_seller_new_order',
  'seller_new_order', 'order_shipped', 'order_confirmed', 'message_request', 'qa.answer.created', 'incoming_video_call',
  'friend_accepted', 'channel.update.published', 'incoming_call', 'doorstep.pro.document.reviewed', 'qa.question.followed.answered',
  'comment_reaction', 'qa.answer.best_selected', 'order_payment_failed', 'order_cancelled', 'doorstep.pro.application.approved',
  'doorstep.booking.assigned', 'doorstep.booking.confirmed', 'doorstep.booking.reminder',
]

describe('presentation fields decode', () => {
  test('icon accepts only the pinned keys', () => {
    for (const k of NOTIFICATION_ICONS) expect(notificationIcon(k)).toBe(k)
    for (const v of [undefined, null, '', 'Order', 'shop', 3]) expect(notificationIcon(v)).toBeUndefined()
  })

  test('title is trimmed; blank or absent is undefined', () => {
    expect(notificationTitle('  Your order is on its way.  ')).toBe('Your order is on its way.')
    for (const v of [undefined, null, '', '   ', 7]) expect(notificationTitle(v)).toBeUndefined()
  })

  test('the zero UUID and blanks are no actor', () => {
    expect(notificationActorId(ZERO)).toBeUndefined()
    expect(notificationActorId('')).toBeUndefined()
    expect(notificationActorId(undefined)).toBeUndefined()
    expect(notificationActorId(ACTOR)).toBe(ACTOR)
    expect(notificationHasActor(ACTOR, 'Asha')).toBe(true)
    expect(notificationHasActor(ACTOR, '')).toBe(false)
    expect(notificationHasActor(ZERO, 'Asha')).toBe(false)
  })

  test('the bell normaliser keeps title, icon and a usable actor; absent stays undefined', () => {
    expect(notificationPresentationFields({ title: 'Asha followed you.', icon: 'social', actor: { id: ACTOR, username: 'asha', display_name: 'Asha' } }))
      .toEqual({ title: 'Asha followed you.', icon: 'social', actor: { id: ACTOR, username: 'asha', display_name: 'Asha' } })
    const old = notificationPresentationFields({ type: 'follow' })
    expect(old.title).toBeUndefined()
    expect(old.icon).toBeUndefined()
    expect(old.actor).toBeUndefined()
    expect(notificationPresentationFields({ actor: { id: ZERO, display_name: 'x' } }).actor).toBeUndefined()
  })

  test('the Activity normaliser keeps title and icon', () => {
    const n = decode({ title: 'Your order has shipped.', icon: 'order' })
    expect(n.server_title).toBe('Your order has shipped.')
    expect(n.icon).toBe('order')
    expect(n.actor_id).toBeUndefined()
  })
})

describe('Activity page wording', () => {
  test('a type the web does not handle uses the server title', () => {
    expect(decode({ type: 'commerce_order_shipped', title: 'Your order has shipped.' }).title).toBe('Your order has shipped.')
    expect(decode({ type: 'dating.spark.created', title: 'Someone sent you a spark.', icon: 'dating' }).title).toBe('Someone sent you a spark.')
    // The prefix fallbacks are generic too.
    expect(decode({ type: 'doorstep.pro.something.new', title: 'Your partner profile was updated.' }).title).toBe('Your partner profile was updated.')
  })

  test('a type the web handles keeps its own copy', () => {
    const n = decode({ type: 'order_shipped', title: 'Server words', icon: 'order' })
    expect(n.title).toBe('Your order is on the way')
    expect(n.body).toBe('Track each shipment in your order.')
    expect(decode({ type: 'follow', title: 'Asha followed you.', actor_user_id: ACTOR }).title).toBe('New follower')
  })

  test('absent fields fall back as before', () => {
    const n = decode({ type: 'commerce_order_shipped' })
    expect(n.title).toBe('New notification')
    expect(n.server_title).toBeUndefined()
    expect(n.icon).toBeUndefined()
    expect(decode({ type: 'doorstep.pro.something.new' }).title).toBe('Partner update')
  })

  test('no listed real type renders the generic line when the server sends a title', () => {
    for (const type of REAL_TYPES) {
      const n = decode({ type, title: `Sentence for ${type}.`, icon: 'system' })
      const html = renderToStaticMarkup(<ActivityList notifications={[n]} onOpen={() => undefined} />)
      expect(html).not.toContain('New notification')
      expect(html).not.toContain('Q&amp;A update')
      expect(html).not.toContain('Partner update')
      expect(html).not.toContain('Service booking update')
    }
  })

  test('an unknown qa row takes the server title; a known one keeps its own', () => {
    const followed = decode({ type: 'qa.question.followed.answered', title: 'Ravi answered a question you follow.', icon: 'qa' })
    expect(renderToStaticMarkup(<ActivityList notifications={[followed]} onOpen={() => undefined} />)).toContain('Ravi answered a question you follow.')
    const best = decode({ type: 'qa.answer.best_selected', title: 'Server words', icon: 'qa' })
    expect(renderToStaticMarkup(<ActivityList notifications={[best]} onOpen={() => undefined} />)).toContain('Your answer was marked as best')
  })

  test('a row with no actor shows the glyph its icon picks', () => {
    const html = renderToStaticMarkup(<ActivityList notifications={[decode({ title: 'Your order has shipped.', icon: 'order' })]} onOpen={() => undefined} />)
    expect(html).toContain('data-notification-glyph="order"')
    const food = renderToStaticMarkup(<ActivityList notifications={[decode({ type: 'food_order_status', icon: 'food' })]} onOpen={() => undefined} />)
    expect(food).toContain('data-notification-glyph="food"')
  })

  test('a row with a named actor, or without an icon, shows no glyph', () => {
    const named = decode({ type: 'follow', icon: 'social', actor_user_id: ACTOR, actor: { id: ACTOR, display_name: 'Asha' } })
    expect(renderToStaticMarkup(<ActivityList notifications={[named]} onOpen={() => undefined} />)).not.toContain('data-notification-glyph')
    expect(renderToStaticMarkup(<ActivityList notifications={[decode()]} onOpen={() => undefined} />)).not.toContain('data-notification-glyph')
  })
})

describe('bell wording', () => {
  test('own sentence with an actor; server title otherwise; generic only with neither', () => {
    expect(bellLine('started following you', 'Asha followed you.', true)).toEqual({ kind: 'actor', sentence: 'started following you' })
    expect(bellLine(null, 'Your order has shipped.', true)).toEqual({ kind: 'title', title: 'Your order has shipped.' })
    expect(bellLine('started following you', 'Asha followed you.', false)).toEqual({ kind: 'title', title: 'Asha followed you.' })
    expect(bellLine(null, undefined, true)).toEqual({ kind: 'actor', sentence: GENERIC_ACTOR_SENTENCE })
    expect(bellLine('called you', undefined, false)).toEqual({ kind: 'actor', sentence: 'called you' })
  })

  test('a row with no actor picks its glyph by icon and shows the server title', () => {
    const r = bellRow({ actor_user_id: ZERO, title: 'Your food order is being prepared.', icon: 'food' }, null)
    expect(r.hasActor).toBe(false)
    expect(r.glyph).toBe('food')
    expect(r.line).toEqual({ kind: 'title', title: 'Your food order is being prepared.' })
  })

  test('a named actor keeps the avatar and the web sentence', () => {
    const embedded = bellRow({ actor_user_id: ACTOR, title: 'Asha followed you.', icon: 'social', actor: { id: ACTOR, display_name: 'Asha' } }, 'started following you')
    expect(embedded).toEqual({ hasActor: true, name: 'Asha', line: { kind: 'actor', sentence: 'started following you' }, glyph: undefined })
    const looked = bellRow({ actor_user_id: ACTOR }, 'started following you', 'Asha')
    expect(looked.hasActor).toBe(true)
    expect(looked.name).toBe('Asha')
  })

  test('an older server (no title, no icon) renders as before', () => {
    const r = bellRow({ actor_user_id: ACTOR }, null)
    expect(r.glyph).toBeUndefined()
    expect(r.name).toBe(ACTOR.slice(0, 8))
    expect(r.line).toEqual({ kind: 'actor', sentence: GENERIC_ACTOR_SENTENCE })
  })
})

describe('glyphs', () => {
  test('every icon key has a glyph and renders a tinted circle', () => {
    for (const k of NOTIFICATION_ICONS) {
      expect(NOTIFICATION_GLYPHS[k]).toBeTruthy()
      const html = renderToStaticMarkup(<NotificationGlyph icon={k} />)
      expect(html).toContain(`data-notification-glyph="${k}"`)
      expect(html).toContain('bg-primary-tint')
      expect(html).toContain('<svg')
    }
  })
})
