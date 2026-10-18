import { describe, expect, test } from 'bun:test'

import {
  BATCH_MAX,
  LOAD_MORE_WITHIN,
  SWIPE_STEP,
  WHEEL_STEP,
  appendIds,
  canStep,
  idsToHydrate,
  initialViewerList,
  shouldLoadMore,
  startIndexOf,
  stepIndex,
  swipeStep,
  uniqueIds,
  viewerEntry,
  wheelStep,
} from '../sharedViewer'

describe('uniqueIds', () => {
  test('keeps first order, drops repeats and empties', () => {
    expect(uniqueIds(['a', 'b', 'a', '', null, undefined, 'c', 'b'])).toEqual(['a', 'b', 'c'])
  })
})

describe('initialViewerList', () => {
  test("the server's list wins when it holds the tapped post, and may page", () => {
    expect(initialViewerList(['p3', 'p2', 'p1'], ['p1', 'p2'], 'p2')).toEqual({ ids: ['p3', 'p2', 'p1'], pageable: true })
  })

  test('the server list without the tapped post is not used (the cursor would walk the wrong list)', () => {
    expect(initialViewerList(['p9', 'p8'], ['p1', 'p2'], 'p2')).toEqual({ ids: ['p1', 'p2'], pageable: false })
  })

  test('route missing: the given ids, as given', () => {
    expect(initialViewerList(null, ['p1', 'p2', 'p1'], 'p1')).toEqual({ ids: ['p1', 'p2'], pageable: false })
  })

  test('the tapped post is always in the list, first when nobody listed it', () => {
    expect(initialViewerList(null, ['p1'], 'p5')).toEqual({ ids: ['p5', 'p1'], pageable: false })
    expect(initialViewerList(null, undefined, 'p5')).toEqual({ ids: ['p5'], pageable: false })
    expect(initialViewerList([], [], 'p5')).toEqual({ ids: ['p5'], pageable: false })
  })
})

describe('startIndexOf / stepIndex / canStep', () => {
  test('opens on the tapped post, else the first', () => {
    expect(startIndexOf(['a', 'b', 'c'], 'c')).toBe(2)
    expect(startIndexOf(['a', 'b'], 'z')).toBe(0)
  })

  test('one step at a time, held inside the list', () => {
    expect(stepIndex(0, 1, 3)).toBe(1)
    expect(stepIndex(2, 1, 3)).toBe(2)
    expect(stepIndex(0, -1, 3)).toBe(0)
    expect(stepIndex(1, 5, 3)).toBe(2) // a big delta is still one step
    expect(stepIndex(2, -9, 3)).toBe(1)
    expect(stepIndex(0, 1, 0)).toBe(0)
  })

  test('canStep says whether the buttons have anywhere to go', () => {
    expect(canStep(0, -1, 3)).toBe(false)
    expect(canStep(0, 1, 3)).toBe(true)
    expect(canStep(2, 1, 3)).toBe(false)
    expect(canStep(2, -1, 3)).toBe(true)
    expect(canStep(0, 1, 1)).toBe(false)
    expect(canStep(0, -1, 0)).toBe(false)
  })
})

describe('appendIds', () => {
  test('a further page appends without repeats', () => {
    expect(appendIds(['a', 'b'], ['b', 'c', 'd'])).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('idsToHydrate', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

  test('current first, then the window ahead and one behind', () => {
    expect(idsToHydrate(ids, 2, new Set())).toEqual(['c', 'd', 'b', 'e', 'f', 'g'])
  })

  test('never asks twice', () => {
    expect(idsToHydrate(ids, 2, new Set(['c', 'd', 'b']))).toEqual(['e', 'f', 'g'])
    expect(idsToHydrate(ids, 2, new Set(ids))).toEqual([])
  })

  test('clamps at both ends', () => {
    expect(idsToHydrate(ids, 0, new Set())).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(idsToHydrate(ids, 7, new Set())).toEqual(['h', 'g'])
    expect(idsToHydrate(ids, 99, new Set())).toEqual(['h', 'g'])
    expect(idsToHydrate([], 0, new Set())).toEqual([])
  })

  test('stays inside one batch call', () => {
    const many = Array.from({ length: 300 }, (_, i) => `p${i}`)
    expect(idsToHydrate(many, 150, new Set(), 200, 200)).toHaveLength(BATCH_MAX)
  })
})

describe('shouldLoadMore', () => {
  const open = { pageable: true, cursor: 'c1', loading: false }

  test('near the end of what it has, with a cursor', () => {
    expect(shouldLoadMore(10 - LOAD_MORE_WITHIN, 10, open)).toBe(true)
    expect(shouldLoadMore(9, 10, open)).toBe(true)
    expect(shouldLoadMore(10 - LOAD_MORE_WITHIN - 1, 10, open)).toBe(false)
  })

  test('not without a cursor, not for a local list, not twice at once', () => {
    expect(shouldLoadMore(9, 10, { ...open, cursor: null })).toBe(false)
    expect(shouldLoadMore(9, 10, { ...open, pageable: false })).toBe(false)
    expect(shouldLoadMore(9, 10, { ...open, loading: true })).toBe(false)
  })
})

describe('viewerEntry', () => {
  const rows = new Map([['a', { id: 'a' }]])

  test('a returned row is shown', () => {
    expect(viewerEntry('a', rows, new Set(['a']), new Set())).toEqual({ kind: 'row', row: { id: 'a' } })
  })

  test('asked and not returned is unavailable, never guessed', () => {
    expect(viewerEntry('b', rows, new Set(['b']), new Set())).toEqual({ kind: 'unavailable' })
  })

  test('a failed read is an error (retryable); not yet asked is loading', () => {
    expect(viewerEntry('c', rows, new Set(), new Set(['c']))).toEqual({ kind: 'error' })
    expect(viewerEntry('d', rows, new Set(), new Set())).toEqual({ kind: 'loading' })
  })
})

describe('wheelStep / swipeStep', () => {
  test('wheel travel adds up to one step, then resets', () => {
    const first = wheelStep(0, WHEEL_STEP / 2)
    expect(first).toEqual({ step: 0, acc: WHEEL_STEP / 2 })
    expect(wheelStep(first.acc, WHEEL_STEP / 2)).toEqual({ step: 1, acc: 0 })
    expect(wheelStep(0, -WHEEL_STEP)).toEqual({ step: -1, acc: 0 })
  })

  test('a swipe up moves on, down goes back, a nudge does nothing', () => {
    expect(swipeStep(-SWIPE_STEP)).toBe(1)
    expect(swipeStep(SWIPE_STEP + 10)).toBe(-1)
    expect(swipeStep(SWIPE_STEP - 1)).toBe(0)
  })
})
