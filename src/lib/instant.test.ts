import { describe, expect, it } from "vitest"

import { formatInstant, isDay, nextDay, tashkentDayStart } from "./instant"

describe("formatInstant", () => {
  it("shows Tashkent time (UTC+5) whatever the browser's zone", () => {
    expect(formatInstant("2026-10-26T09:30:00Z")).toBe("26.10.2026 14:30")
    expect(formatInstant("2026-12-31T20:05:00.123456Z")).toBe(
      "01.01.2027 01:05"
    )
    expect(formatInstant("2026-10-26T09:30:00+05:00")).toBe("26.10.2026 09:30")
  })

  it("shows nothing for an instant that has not happened", () => {
    expect(formatInstant(null)).toBe("")
  })
})

describe("Tashkent days for the API", () => {
  it("starts a day at Tashkent midnight, in UTC", () => {
    expect(tashkentDayStart("2026-10-27")).toBe("2026-10-26T19:00:00.000Z")
  })

  it("moves to the next day across a month and a year", () => {
    expect(nextDay("2026-10-31")).toBe("2026-11-01")
    expect(nextDay("2026-12-31")).toBe("2027-01-01")
  })

  it("accepts only a real calendar day", () => {
    expect(isDay("2026-10-27")).toBe(true)
    expect(isDay("2026-13-01")).toBe(false)
    expect(isDay("27.10.2026")).toBe(false)
  })
})
