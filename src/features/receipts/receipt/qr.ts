import { encode } from "uqr"

import { printerDotMm } from "@/features/printing/barcode"

/** Fewer dots per module than this and a phone camera cannot tell the squares apart. */
const minModuleDots = 2
/** The free border a scanner needs, in modules (the QR standard). */
const quietModules = 4

export type QrProblem = "tooLong" | "tooSmall"

type Fit = { modules: boolean[][]; total: number; dots: number }

function fit(value: string, sizeMm: number): Fit | QrProblem {
  let modules: boolean[][]
  try {
    modules = encode(value, { ecc: "M", border: 0 }).data
  } catch {
    return "tooLong"
  }
  const total = modules.length + 2 * quietModules
  const dots = Math.floor(sizeMm / printerDotMm / total)
  if (dots < minModuleDots) return "tooSmall"
  return { modules, total, dots }
}

/** Whether `value` makes a QR code a camera can read at `sizeMm`, and if not why (without drawing it). */
export function qrProblem(value: string, sizeMm: number): QrProblem | null {
  const result = fit(value, sizeMm)
  return typeof result === "string" ? result : null
}

/**
 * A QR code as an SVG of at most `sizeMm` (its quiet border included), every module a whole number of printer dots.
 * `tooLong`: the value does not fit any QR code. `tooSmall`: it fits, but only with modules too small to scan at
 * this size, so the size must grow or the value shrink.
 */
export function qrSvg(
  document: Document,
  value: string,
  sizeMm: number
): SVGSVGElement | QrProblem {
  const result = fit(value, sizeMm)
  if (typeof result === "string") return result
  const { modules, total, dots } = result

  const path = modules
    .flatMap((row, y) =>
      row.flatMap((dark, x) =>
        dark
          ? [`M${String(x + quietModules)} ${String(y + quietModules)}h1v1h-1z`]
          : []
      )
    )
    .join("")
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  svg.setAttribute("viewBox", `0 0 ${String(total)} ${String(total)}`)
  svg.setAttribute("shape-rendering", "crispEdges")
  const bars = document.createElementNS("http://www.w3.org/2000/svg", "path")
  bars.setAttribute("d", path)
  bars.setAttribute("fill", "black")
  svg.append(bars)
  const side = `${String(total * dots * printerDotMm)}mm`
  Object.assign(svg.style, { display: "block", width: side, height: side })
  return svg
}
