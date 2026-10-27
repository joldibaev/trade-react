/**
 * Money, quantities, unit prices and rates arrive from TradeNet as exact decimal strings with a fixed number of
 * fraction digits (`"12500.00"`, ADR-0004) and are never turned into JS numbers: `0.1 + 0.2` is not `0.3`.
 * These helpers work on the text itself.
 *
 * Russian, Uzbek and Kazakh write numbers alike: digits in groups of three split by a no-break space, a comma
 * before the fraction ("12 500,50"). Done by hand rather than with `Intl.NumberFormat`, whose Uzbek and Kazakh
 * data browsers do not all ship (trade4 found Chrome printing "12,500.5" for them).
 */

const decimalPattern = /^(-?)(\d+)(?:\.(\d+))?$/
const groupSeparator = " "
const fractionSeparator = ","

/** True for a plain decimal as the API writes it: optional minus, digits, optional dot and digits. */
export function isDecimal(value: string): boolean {
  return decimalPattern.test(value)
}

/** `"-1234567.50"` → `"-1 234 567,50"` (with no-break spaces). The fraction digits stay exactly as sent. */
export function formatDecimal(value: string): string {
  const match = decimalPattern.exec(value)
  if (!match) throw new Error(`Not a decimal string: "${value}"`)
  const [, sign = "", whole = "", fraction] = match
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, groupSeparator)
  return (
    sign +
    grouped +
    (fraction === undefined ? "" : fractionSeparator + fraction)
  )
}

/**
 * What a person typed (`"12 500,5"`, `"12500.50"`) as the API's decimal (`"12500.5"`), or null when it is not a
 * non-negative number with at most `scale` fraction digits. Spaces go, a comma becomes a dot; nothing is rounded:
 * `"1,005"` for money (scale 2) is refused, not made `"1.01"`. A leading zero is dropped (`"007"` → `"7"`),
 * since the API refuses one.
 */
export function parseDecimalInput(input: string, scale: number): string | null {
  // `\s` covers the no-break spaces of `formatDecimal` and of copied text too.
  const text = input.replace(/\s/g, "").replace(",", ".")
  const match = /^(\d+)(?:\.(\d*))?$/.exec(text)
  if (!match) return null
  const [, whole = "", fraction = ""] = match
  if (fraction.length > scale) return null
  const trimmed = whole.replace(/^0+(?=\d)/, "")
  return fraction === "" ? trimmed : `${trimmed}.${fraction}`
}

/** True when a decimal string is zero (`"0"`, `"0.00"`). Prices must be above zero. */
export function isZeroDecimal(value: string): boolean {
  return /^0+(?:\.0*)?$/.test(value)
}

/** Drops the zeros the API pads a fraction with: `"10.000"` → `"10"`, `"2.500"` → `"2.5"`, `"100"` stays. */
export function trimDecimal(value: string): string {
  return value.includes(".")
    ? value.replace(/0+$/, "").replace(/\.$/, "")
    : value
}

/** The API's decimal as an input shows it: `"12500.50"` → `"12500,5"`, `"10.000"` → `"10"`, null → `""`. */
export function decimalForInput(value: string | null): string {
  if (value === null) return ""
  return trimDecimal(value).replace(".", ",")
}
