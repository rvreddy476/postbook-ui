import { describe, expect, test } from 'bun:test'
import { rgbTripleToHex } from '../profileThemeColor'

describe('rgbTripleToHex', () => {
  test('turns the theme token triple into the hex the profile stores', () => {
    expect(rgbTripleToHex('59 130 196')).toBe('#3b82c4')
    expect(rgbTripleToHex(' 90 155 216 ')).toBe('#5a9bd8')
    expect(rgbTripleToHex('15, 20, 25')).toBe('#0f1419')
  })

  test('is empty for anything that is not three channels', () => {
    expect(rgbTripleToHex('')).toBe('')
    expect(rgbTripleToHex('#3b82c4')).toBe('')
    expect(rgbTripleToHex('59 130')).toBe('')
    expect(rgbTripleToHex('59 130 300')).toBe('')
  })
})
