/** Incremental SSE decoder: an event can span any number of network chunks. */
export function notificationSseDecoder(onEvent: (event: string, data: string) => void) {
  let buffer = ''
  let event = ''
  let data: string[] = []
  return (chunk: string) => {
    buffer += chunk
    let end: number
    while ((end = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, end).replace(/\r$/, '')
      buffer = buffer.slice(end + 1)
      if (line === '') {
        if (data.length) onEvent(event || 'message', data.join('\n'))
        event = ''
        data = []
      } else if (!line.startsWith(':')) {
        const colon = line.indexOf(':')
        const name = colon < 0 ? line : line.slice(0, colon)
        const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '')
        if (name === 'event') event = value
        if (name === 'data') data.push(value)
      }
    }
  }
}
