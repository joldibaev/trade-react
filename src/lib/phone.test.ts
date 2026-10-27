import { describe, expect, it } from "vitest"

import { formatPhone } from "./phone"

const nbsp = " "
const spaced = (text: string) => text.replaceAll(" ", nbsp)

describe("formatPhone", () => {
  it("groups an Uzbek number as people dictate it, with no-break spaces", () => {
    expect(formatPhone("+998901234567")).toBe(spaced("+998 90 123 45 67"))
  })

  it("groups a Kazakh number", () => {
    expect(formatPhone("+77011234567")).toBe(spaced("+7 701 123 45 67"))
  })

  it("leaves another country or an unexpected length as sent", () => {
    expect(formatPhone("+4930123456")).toBe("+4930123456")
    expect(formatPhone("+99890123456")).toBe("+99890123456")
    expect(formatPhone("+9989012345678")).toBe("+9989012345678")
  })
})
