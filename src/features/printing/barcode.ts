import JsBarcode from "jsbarcode"

/**
 * A label printer prints whole dots: 203 dpi, as the shops' Xprinter XP-303B. A bar of a fraction of a dot comes out
 * one dot wider or narrower than its neighbours, and a scanner cannot read the code. So every module here is a whole
 * number of dots (trade4's lesson, docs/printing.md).
 */
export const printerDotMm = 25.4 / 203

export type BarcodeFormat = "EAN13" | "EAN8" | "CODE128"

/** The free space a scanner needs on each side of the bars, in modules (GS1 minimums; Code 128: 10). */
const quietZones = {
  EAN13: { left: 11, right: 7 },
  EAN8: { left: 7, right: 7 },
  CODE128: { left: 10, right: 10 },
} satisfies Record<BarcodeFormat, { left: number; right: number }>

/** The GS1 check digit is right for this EAN (the last digit). */
export function hasValidEanCheckDigit(value: string): boolean {
  if (!/^\d+$/.test(value)) return false
  const digits: number[] = []
  for (let i = 0; i < value.length; i++) digits.push(value.charCodeAt(i) - 48)
  const check = digits.pop()
  // From the right, the digits before the check digit weigh 3, 1, 3, 1, ...
  const sum = digits
    .reverse()
    .reduce((total, digit, i) => total + digit * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === check
}

/** EAN-13 or EAN-8 for a valid code of that length (a wrong check digit is printed as Code 128), else Code 128. */
export function barcodeFormat(value: string): BarcodeFormat {
  if (/^\d{13}$/.test(value) && hasValidEanCheckDigit(value)) return "EAN13"
  if (/^\d{8}$/.test(value) && hasValidEanCheckDigit(value)) return "EAN8"
  return "CODE128"
}

/** The widest module that is a whole number of dots and fits with its quiet zones; null when one dot does not fit. */
export function moduleDots(modules: number, widthMm: number): number | null {
  const dots = Math.floor(widthMm / printerDotMm / modules)
  return dots < 1 ? null : dots
}

/**
 * The bars of `value` as an SVG of `heightMm`, at most `widthMm` wide with the quiet zones, every module a whole
 * number of printer dots. Null when the code cannot be encoded (Code 128 takes ASCII only) or does not fit even at
 * one dot per module: the label then prints the digits only.
 */
export function barcodeSvg(
  document: Document,
  value: string,
  widthMm: number,
  heightMm: number,
  /** For a value that must stay Code 128 (a receipt number) though its digits could pass for an EAN. */
  forcedFormat?: BarcodeFormat
): SVGSVGElement | null {
  const format = forcedFormat ?? barcodeFormat(value)
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  // Set by JsBarcode's callback; an object, so the check below is not narrowed away.
  const result = { valid: true }
  try {
    // One unit per module and no margin or digits: the label sizes the bars and writes the digits itself.
    JsBarcode(svg, value, {
      format,
      width: 1,
      height: 100,
      margin: 0,
      displayValue: false,
      flat: true,
      valid: (ok) => {
        result.valid = ok
      },
    })
  } catch {
    return null
  }
  // With one unit per module and no margin, JsBarcode's width ("95px" for EAN-13) is the count of modules.
  const width = /^(\d+)/.exec(svg.getAttribute("width") ?? "")?.[1]
  if (!result.valid || width === undefined) return null
  // eslint-disable-next-line no-restricted-syntax -- a count of bars, not money.
  const modules = Number.parseInt(width, 10)
  const quiet = quietZones[format]
  const total = modules + quiet.left + quiet.right
  const dots = moduleDots(total, widthMm)
  if (dots === null) return null
  svg.setAttribute("viewBox", `${String(-quiet.left)} 0 ${String(total)} 100`)
  svg.setAttribute("preserveAspectRatio", "none")
  svg.setAttribute("shape-rendering", "crispEdges")
  svg.removeAttribute("width")
  svg.removeAttribute("height")
  svg.removeAttribute("style")
  svg.style.width = `${String(total * dots * printerDotMm)}mm`
  svg.style.height = `${String(heightMm)}mm`
  svg.style.display = "block"
  svg.style.flex = "none"
  return svg
}
