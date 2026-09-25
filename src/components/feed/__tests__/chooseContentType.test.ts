import { describe, expect, test } from 'bun:test'
import { chooseContentType } from '../chooseContentType'

const video = { type: 'video/mp4' }
const image = { type: 'image/jpeg' }

describe('chooseContentType', () => {
  test('nothing attached is a post', () => {
    expect(chooseContentType({ showPoll: false, files: [] })).toBe('post')
  })

  test('images are a post', () => {
    expect(chooseContentType({ showPoll: false, files: [image, image] })).toBe('post')
  })

  test('a feed video is a post, never "video" (that is an explicit Tube long_video on the server)', () => {
    expect(chooseContentType({ showPoll: false, files: [video] })).toBe('post')
    expect(chooseContentType({ showPoll: false, files: [image, video] })).toBe('post')
  })

  test('a poll is a poll', () => {
    expect(chooseContentType({ showPoll: true, files: [] })).toBe('poll')
  })

  test('a poll stays a poll even with a video attached', () => {
    expect(chooseContentType({ showPoll: true, files: [video] })).toBe('poll')
  })

  test('never returns anything but post or poll', () => {
    const inputs = [
      { showPoll: false, files: [] },
      { showPoll: false, files: [video] },
      { showPoll: false, files: [image] },
      { showPoll: true, files: [video] },
    ]
    for (const input of inputs) {
      expect(['post', 'poll']).toContain(chooseContentType(input))
    }
  })
})
