import { beforeEach, describe, expect, it, vi } from "vitest"

import { readImage } from "./image"

const png = (bytes: string) =>
  new File([bytes], "logo.png", { type: "image/png" })

// jsdom draws no pictures and has no `decode`, so the browser's verdict is played by the test.
const decode = vi.fn<() => Promise<void>>()

beforeEach(() => {
  decode.mockReset()
  Object.defineProperty(HTMLImageElement.prototype, "decode", {
    configurable: true,
    value: decode,
  })
})

function decodeAs(outcome: "ok" | "broken") {
  decode.mockImplementation(() =>
    outcome === "ok"
      ? Promise.resolve()
      : Promise.reject(new DOMException("broken", "EncodingError"))
  )
}

describe("readImage", () => {
  it("keeps a picture the browser decodes", async () => {
    decodeAs("ok")
    const result = await readImage(png("fine"))
    expect(result.ok).toBe(true)
  })

  it("refuses a file with a valid type whose bytes the browser cannot decode", async () => {
    decodeAs("broken")
    expect(await readImage(png("\x89PNG damaged"))).toEqual({
      ok: false,
      reason: "broken",
    })
  })

  it("refuses a type other than PNG or JPEG without decoding", async () => {
    const gif = new File(["x"], "logo.gif", { type: "image/gif" })
    expect(await readImage(gif)).toEqual({ ok: false, reason: "type" })
    expect(decode).not.toHaveBeenCalled()
  })
})
