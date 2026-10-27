import { barcodeSvg } from "./barcode"
import { fillVariables, labelPrice, type LabelData } from "./label-data"
import { mm } from "./mm"
import type { LabelElement, LabelLayout, LabelTextStyle } from "./templates-api"

const fonts = {
  SANS: 'Arial, "Helvetica Neue", sans-serif',
  SERIF: '"Times New Roman", Times, serif',
  MONO: 'Consolas, "Courier New", monospace',
} satisfies Record<LabelTextStyle["font"], string>

const lineHeight = 1.15
const digitsPt = 6
const ptToMm = 25.4 / 72
const fitStepPt = 0.5
const fitMinPt = 4

/**
 * The styles of every page that draws labels, the preview and the editor included: no page margin, exact colours,
 * one label per page. No `@page size`: Chrome would turn a wide page to landscape, and the label driver turns it once
 * more (docs/printing.md).
 */
export const labelPageStyles = `@page{margin:0}html{print-color-adjust:exact;-webkit-print-color-adjust:exact}html,body{margin:0;background:white}.label{break-after:page}.label:last-child{break-after:auto}`

/**
 * One label of a template as elements of `document`, inline styles only: the editor's canvas, the preview and every
 * printed page are this same drawing, so what is seen is what is printed. Elements are drawn in order, a later one
 * over an earlier one. User text enters through `textContent`, never as HTML. Call `fitLabelText` once it is placed.
 */
export function drawLabel(
  document: Document,
  layout: LabelLayout,
  data: LabelData
): HTMLElement {
  const label = document.createElement("div")
  label.className = "label"
  Object.assign(label.style, {
    position: "relative",
    width: `${layout.widthMm}mm`,
    height: `${layout.heightMm}mm`,
    overflow: "hidden",
    background: "white",
    color: "black",
    boxSizing: "border-box",
  })
  for (const element of layout.elements) {
    const node = elementNode(document, element, data)
    Object.assign(node.style, {
      position: "absolute",
      left: `${element.xMm}mm`,
      top: `${element.yMm}mm`,
      width: `${element.widthMm}mm`,
      height: `${element.heightMm}mm`,
      overflow: "hidden",
      boxSizing: "border-box",
    })
    label.append(node)
  }
  return label
}

function elementNode(
  document: Document,
  element: LabelElement,
  data: LabelData
): HTMLElement {
  switch (element.type) {
    case "TEXT":
      return textNode(document, element.style, (content) => {
        content.textContent = fillVariables(element.text, data.values)
      })
    case "PRICE":
      return textNode(document, element.style, (content) => {
        priceContent(content, element, data)
      })
    case "BARCODE":
      return barcodeNode(document, element, data.barcode)
    case "SHAPE": {
      const node = document.createElement("div")
      Object.assign(node.style, {
        border:
          mm(element.borderMm) > 0
            ? `${element.borderMm}mm solid black`
            : "none",
        background: element.filled ? "black" : "transparent",
      })
      return node
    }
    case "IMAGE": {
      const node = document.createElement("div")
      const image = document.createElement("img")
      image.src = element.src
      image.alt = ""
      Object.assign(image.style, {
        display: "block",
        width: "100%",
        height: "100%",
        objectFit: "contain",
      })
      node.append(image)
      return node
    }
  }
}

function textNode(
  document: Document,
  style: LabelTextStyle,
  fill: (content: HTMLElement) => void
): HTMLElement {
  const node = document.createElement("div")
  const content = document.createElement("div")
  fill(content)
  Object.assign(node.style, {
    display: "flex",
    flexDirection: "column",
    justifyContent: { TOP: "flex-start", MIDDLE: "center", BOTTOM: "flex-end" }[
      style.verticalAlign
    ],
    fontFamily: fonts[style.font],
    fontSize: `${String(style.fontSizePt)}pt`,
    lineHeight: String(lineHeight),
    fontWeight: style.bold ? "700" : "400",
    fontStyle: style.italic ? "italic" : "normal",
    textDecorationLine:
      [style.underline && "underline", style.strike && "line-through"]
        .filter(Boolean)
        .join(" ") || "none",
    textAlign: { START: "left", CENTER: "center", END: "right" }[style.align],
    background: style.inverted ? "black" : "transparent",
    color: style.inverted ? "white" : "black",
    overflowWrap: "anywhere",
    whiteSpace: "pre-wrap",
  })
  // Shrinks to fit only when the template says so; `data-fit` keeps the starting size.
  if (style.fit) node.dataset.fit = String(style.fontSizePt)
  node.dataset.text = ""
  node.append(content)
  return node
}

function priceContent(
  content: HTMLElement,
  element: Extract<LabelElement, { type: "PRICE" }>,
  data: LabelData
) {
  const price = data.price(element.priceTypeId ?? null)
  if (price === null) return
  content.style.whiteSpace = "nowrap"
  const [whole = "", fraction = "00"] = price.split(".")
  // «18⁷⁹⁰ сум»: the thousands at full size, the last three digits small and raised, the currency under them. Only
  // for whole sums from a thousand up; anything else is written in full.
  if (!element.split || fraction !== "00" || whole.length < 4) {
    content.textContent = element.currency
      ? `${labelPrice(price)} ${data.currency}`
      : labelPrice(price)
    return
  }
  const document = content.ownerDocument
  const major = document.createElement("span")
  major.textContent = labelPrice(whole.slice(0, -3))
  const small = document.createElement("span")
  Object.assign(small.style, {
    display: "inline-flex",
    flexDirection: "column",
    verticalAlign: "top",
    fontSize: "50%",
    lineHeight: "1.1",
    marginInlineStart: "0.08em",
    textAlign: "start",
  })
  const minor = document.createElement("span")
  minor.textContent = whole.slice(-3)
  minor.style.textDecorationLine = "underline"
  small.append(minor)
  if (element.currency) {
    const currency = document.createElement("span")
    currency.textContent = data.currency
    currency.style.fontSize = "60%"
    small.append(currency)
  }
  content.append(major, small)
}

function barcodeNode(
  document: Document,
  element: Extract<LabelElement, { type: "BARCODE" }>,
  value: string | null
): HTMLElement {
  const node = document.createElement("div")
  Object.assign(node.style, {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-end",
    fontFamily: fonts.SANS,
  })
  if (value === null) return node
  const digitsMm = element.digits ? digitsPt * ptToMm * lineHeight : 0
  const barsMm = mm(element.heightMm) - digitsMm
  const bars =
    barsMm > 2 ? barcodeSvg(document, value, mm(element.widthMm), barsMm) : null
  if (bars) node.append(bars)
  // A code that does not fit or does not encode still prints its digits, and the preview says so.
  else node.dataset.barcodeFallback = ""
  if (element.digits || !bars) {
    const digits = document.createElement("div")
    digits.textContent = value
    Object.assign(digits.style, {
      fontSize: `${String(digitsPt)}pt`,
      lineHeight: String(lineHeight),
      whiteSpace: "nowrap",
    })
    node.append(digits)
  }
  return node
}

const overflows = (node: HTMLElement, content: HTMLElement) =>
  content.scrollHeight > node.clientHeight + 0.5 ||
  content.scrollWidth > node.clientWidth + 0.5

// The font sizes a template allows (TradeNet `LabelLimits`: whole points, 4 to 96), read back from `data-fit`.
const startSizes = new Map(
  Array.from({ length: 93 }, (_, i) => [String(i + 4), i + 4] as const)
)

/** Shrinks every `fit` text of a placed label until it fits its box, half a point at a time, down to 4 pt. */
export function fitLabelText(label: HTMLElement) {
  for (const node of label.querySelectorAll<HTMLElement>("[data-fit]")) {
    // The label lives in another document (a frame): `instanceof HTMLElement` of this window would fail.
    const content = node.firstElementChild as HTMLElement | null
    if (content === null) continue
    let pt = startSizes.get(node.dataset.fit ?? "") ?? fitMinPt
    while (pt > fitMinPt && overflows(node, content)) {
      pt -= fitStepPt
      node.style.fontSize = `${String(pt)}pt`
    }
  }
}

export type LabelWarning = "clipped" | "barcodeDigitsOnly"

/** What the preview must say about a placed, fitted label: the printer gets the same thing. */
export function labelWarnings(label: HTMLElement): LabelWarning[] {
  const warnings: LabelWarning[] = []
  const clipped = [...label.querySelectorAll<HTMLElement>("[data-text]")].some(
    (node) => {
      const content = node.firstElementChild as HTMLElement | null
      return content !== null && overflows(node, content)
    }
  )
  if (clipped) warnings.push("clipped")
  if (label.querySelector("[data-barcode-fallback]"))
    warnings.push("barcodeDigitsOnly")
  return warnings
}
