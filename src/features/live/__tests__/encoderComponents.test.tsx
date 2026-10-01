import { describe, expect, it } from "bun:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { encoderHostView } from "../encoder"
import { EncoderSetup } from "../components/EncoderSetup"
import { SourcePicker } from "../components/SourcePicker"

const KEY = "sk_FAKE_abc123XYZ"
const ingress = { server_url: "rtmps://dev.livekit.cloud/x", stream_key: KEY, ingress_id: "IN_1" }
const noop = () => {}

function setup(props: Partial<React.ComponentProps<typeof EncoderSetup>> = {}) {
  return renderToStaticMarkup(
    <EncoderSetup
      ingress={ingress}
      loading={false}
      resetting={false}
      error={null}
      view={encoderHostView({ status: "scheduled" })}
      onRetry={noop}
      onReset={noop}
      {...props}
    />,
  )
}

describe("source picker", () => {
  it("offers this device (default) and streaming software", () => {
    const html = renderToStaticMarkup(<SourcePicker value="device" onChange={noop} />)
    expect(html).toContain("How will you go live?")
    expect(html.indexOf("This device")).toBeLessThan(html.indexOf("Streaming software"))
    expect(html).toContain("OBS, an encoder or a camera")
    expect(html).toMatch(/checked="" value="device"/)
    expect(html).not.toMatch(/checked="" value="encoder"/)
  })
  it("marks the chosen source", () => {
    const html = renderToStaticMarkup(<SourcePicker value="encoder" onChange={noop} />)
    expect(html).toMatch(/checked="" value="encoder"/)
  })
})

describe("encoder setup card", () => {
  it("shows the server URL, and the key masked: the key is nowhere in the markup", () => {
    const html = setup()
    expect(html).toContain("rtmps://dev.livekit.cloud/x")
    expect(html).not.toContain(KEY)
    expect(html).toContain("•".repeat(16))
    expect(html).toContain('aria-label="Show stream key"')
    expect(html).toContain('aria-label="Copy stream key"')
    expect(html).toContain('aria-label="Copy server URL"')
    expect(html).toContain("Reset key")
  })
  it("has the three steps and the state line", () => {
    const html = setup({ view: encoderHostView({ status: "starting" }) })
    expect(html).toContain("Settings → Stream")
    expect(html).toContain("Press Start on this page.")
    expect(html).toContain("Press Start Streaming in OBS.")
    expect(html).toContain("Waiting for your software to connect")
    expect(html).toContain('data-status="starting"')
  })
  it("while the key loads there is no value and Reset is disabled", () => {
    const html = setup({ ingress: null, loading: true })
    expect(html).toContain('aria-busy="true"')
    expect(html).not.toContain("Copy stream key")
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>.*Reset key/)
  })
  it("an error shows its copy and a retry, not a stale key", () => {
    const html = setup({ ingress: null, error: "We couldn't set up the connection for your streaming software. Try again in a moment." })
    expect(html).toContain('role="alert"')
    expect(html).toContain("Try again")
    expect(html).not.toContain("Copy stream key")
  })
})
