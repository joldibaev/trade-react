/**
 * TradeNet sends instants as ISO strings with a zone (`"2026-10-26T09:30:00Z"`). The chain works in Tashkent time,
 * which is UTC+05:00 all year (no summer time), so the screen shows that time wherever the browser is, done by
 * hand like the numbers (src/lib/decimal.ts): `"27.10.2026 14:30"` reads the same in all three languages.
 */
const tashkentOffsetMs = 5 * 60 * 60 * 1000

const pad = (value: number) => String(value).padStart(2, "0")

/** `"2026-10-26T09:30:00Z"` → `"26.10.2026 14:30"`; null (not happened yet) → `""`. */
export function formatInstant(value: string | null): string {
  if (value === null) return ""
  const ms = Date.parse(value)
  if (Number.isNaN(ms)) throw new Error(`Not an instant: "${value}"`)
  const at = new Date(ms + tashkentOffsetMs)
  return `${pad(at.getUTCDate())}.${pad(at.getUTCMonth() + 1)}.${String(at.getUTCFullYear())} ${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())}`
}

const dayPattern = /^\d{4}-\d{2}-\d{2}$/

/** A calendar day as a date input gives it ("2026-10-27"), checked. */
export function isDay(value: unknown): value is string {
  return (
    typeof value === "string" &&
    dayPattern.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  )
}

/**
 * The instant a Tashkent day starts, as the API takes it: `"2026-10-27"` → `"2026-10-26T19:00:00.000Z"`. Written with
 * `Z`, since a `+05:00` in a URL would arrive as a space.
 */
export function tashkentDayStart(day: string): string {
  return new Date(
    Date.parse(`${day}T00:00:00Z`) - tashkentOffsetMs
  ).toISOString()
}

/** The day after: `"2026-10-31"` → `"2026-11-01"`. A period "to the 31st" ends where the 1st begins. */
export function nextDay(day: string): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
}
