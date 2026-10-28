import { barcodeSvg } from "@/features/printing/barcode"
import { formatDecimal, isZeroDecimal, trimDecimal } from "@/lib/decimal"
import { formatPhone } from "@/lib/phone"

import {
  fillVariables,
  qrValue,
  textValues,
  type ReceiptData,
  type ReceiptTexts,
} from "./data"
import {
  printedWidthMm,
  type BlockOf,
  type ReceiptAlign,
  type ReceiptBlock,
  type ReceiptLayout,
  type ReceiptTextSize,
} from "./layout"
import { qrSvg } from "./qr"

/** A size against the receipt's own text size (trade4's: LARGE is about 1.6×). */
const sizeFactor: Record<ReceiptTextSize, number> = {
  SMALL: 0.85,
  NORMAL: 1,
  LARGE: 1.6,
}
const storeNameEm = 1.3
const barcodeHeightMm = 10
const minus = "−"

/**
 * The styles of every page that draws a receipt, the preview included: no page margin, exact colours, the receipt
 * centred on whatever paper the driver gives. No `@page size`: the printer driver owns the paper (docs/printing.md).
 */
export const receiptPageStyles = `@page{margin:0}html{print-color-adjust:exact;-webkit-print-color-adjust:exact}html,body{margin:0;background:white}body>div{margin:0 auto}`

/** The empty page a receipt is drawn into, for the printer and for the preview alike. */
export const receiptDocument = `<!doctype html><html><head><meta charset="utf-8"><title>Cosmos</title><style>${receiptPageStyles}</style></head><body></body></html>`

/**
 * What cannot print as drawn. A QR code that does not fit or would be too small to scan stops a print job (a receipt
 * a phone cannot read is worse than none) and is flagged in the editor on the sample sale; a barcode that cannot be
 * drawn prints as digits.
 */
export type ReceiptIssue = {
  /** The block in `layout.blocks`. */
  index: number
  kind: "qrTooLong" | "qrTooSmall" | "barcodeDigitsOnly"
}

export type DrawnReceipt = { root: HTMLElement; issues: ReceiptIssue[] }

export type DrawOptions = {
  /**
   * Draw the whole roll, with the margins the printer head cannot reach, as the editor shows the paper. A print takes
   * the printed width only, centred.
   */
  roll?: boolean
}

/** The money of a receipt as the API sent it, grouped; a unit price's padding zeros (4 digits) are dropped to 2. */
const money = (value: string) =>
  formatDecimal(value.replace(/(\.\d\d)0+$/, "$1"))
const quantity = (value: string) => formatDecimal(trimDecimal(value))

/**
 * One receipt of a template as elements of `document`, inline styles only, so the preview and the printed page are the
 * same drawing. Texts enter through `textContent`, never as HTML: a product name cannot become markup. The receipt
 * always ends with the "not a fiscal receipt" line, whatever the template says.
 */
export function drawReceipt(
  document: Document,
  layout: ReceiptLayout,
  data: ReceiptData,
  texts: ReceiptTexts,
  options: DrawOptions = {}
): DrawnReceipt {
  const printed = printedWidthMm(layout.paperWidthMm)
  const side = options.roll ? (layout.paperWidthMm - printed) / 2 : 0
  const root = document.createElement("div")
  root.dataset.receipt = ""
  Object.assign(root.style, {
    width: `${String(printed + side * 2)}mm`,
    boxSizing: "border-box",
    padding: `2mm ${String(side)}mm 4mm`,
    background: "white",
    color: "black",
    fontFamily: 'Arial, "Helvetica Neue", sans-serif',
    fontSize: `${String(layout.fontSizePt)}pt`,
    lineHeight: "1.25",
    overflowWrap: "anywhere",
  })
  const drawing = new Drawing(document, layout, data, texts, printed)
  layout.blocks.forEach((block, index) => {
    const node = drawing.block(block, index)
    node.dataset.block = String(index)
    root.append(node)
  })
  const notice = drawing.line(texts.notFiscal, "CENTER")
  notice.style.marginTop = "2mm"
  notice.dataset.notice = ""
  root.append(notice)
  return { root, issues: drawing.issues }
}

class Drawing {
  readonly issues: ReceiptIssue[] = []
  private readonly values: ReturnType<typeof textValues>

  private readonly document: Document
  private readonly layout: ReceiptLayout
  private readonly data: ReceiptData
  private readonly texts: ReceiptTexts
  private readonly printedMm: number

  constructor(
    document: Document,
    layout: ReceiptLayout,
    data: ReceiptData,
    texts: ReceiptTexts,
    printedMm: number
  ) {
    this.document = document
    this.layout = layout
    this.data = data
    this.texts = texts
    this.printedMm = printedMm
    this.values = textValues(data, texts.number)
  }

  block(block: ReceiptBlock, index: number): HTMLElement {
    switch (block.type) {
      case "TEXT":
        return this.text(block)
      case "IMAGE":
        return this.image(block)
      case "STORE":
        return this.store(block)
      case "DOCUMENT":
        return this.documentBlock(block)
      case "ITEMS":
        return this.items(block)
      case "TOTALS":
        return this.totals(block)
      case "PAYMENTS":
        return this.payments(block)
      case "BARCODE":
        return this.barcode(block, index)
      case "QR":
        return this.qr(block, index)
      case "DIVIDER":
        return this.divider(block)
    }
  }

  line(text: string, align: ReceiptAlign = "START"): HTMLElement {
    const node = this.document.createElement("div")
    node.textContent = text
    node.style.textAlign = alignOf(align)
    return node
  }

  private group(...children: Element[]): HTMLElement {
    const node = this.document.createElement("div")
    node.append(...children)
    return node
  }

  private sized<T extends HTMLElement>(node: T, size: ReceiptTextSize): T {
    node.style.fontSize = `${String(this.layout.fontSizePt * sizeFactor[size])}pt`
    return node
  }

  /**
   * A label on the left and its value on the right: «Сдача ........ 10 000». When both do not fit one line the value
   * drops under the label, still on the right, and an unbroken value (a huge sum, a long cashbox name) breaks where it
   * must: nothing may run past the printed width, the receipt only gets longer.
   */
  private row(label: string, value: string): HTMLElement {
    const node = this.document.createElement("div")
    Object.assign(node.style, {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "baseline",
      justifyContent: "space-between",
      columnGap: "2mm",
    })
    const left = this.document.createElement("span")
    left.textContent = label
    Object.assign(left.style, { flex: "1 1 auto", minWidth: "0" })
    const right = this.document.createElement("span")
    right.textContent = value
    Object.assign(right.style, {
      flex: "0 1 auto",
      minWidth: "0",
      maxWidth: "100%",
      marginInlineStart: "auto",
      textAlign: "end",
    })
    node.append(left, right)
    return node
  }

  private text(block: BlockOf<"TEXT">): HTMLElement {
    const node = this.sized(
      this.line(fillVariables(block.text, this.values), block.align),
      block.size
    )
    Object.assign(node.style, {
      whiteSpace: "pre-wrap",
      fontWeight: block.bold ? "bold" : "normal",
    })
    return node
  }

  private image(block: BlockOf<"IMAGE">): HTMLElement {
    const image = this.document.createElement("img")
    image.src = block.src
    image.alt = ""
    Object.assign(image.style, {
      display: "block",
      width: `${String(block.widthPercent)}%`,
      margin: "0 auto",
    })
    return this.group(image)
  }

  private store(block: BlockOf<"STORE">): HTMLElement {
    const node = this.sized(this.group(), block.size)
    if (block.name) {
      const name = this.line(this.data.storeName, block.align)
      Object.assign(name.style, {
        fontWeight: "bold",
        fontSize: `${String(storeNameEm)}em`,
      })
      node.append(name)
    }
    if (block.address)
      node.append(this.line(this.data.storeAddress, block.align))
    if (block.phone && this.data.storePhone !== null)
      node.append(this.line(formatPhone(this.data.storePhone), block.align))
    return node
  }

  /** The receipt number always prints: a return finds the sale by it. */
  private documentBlock(block: BlockOf<"DOCUMENT">): HTMLElement {
    const title = this.line(`${block.title} ${this.values.number}`, "CENTER")
    title.style.fontWeight = "bold"
    const node = this.sized(this.group(title), block.size)
    if (block.dateTime)
      node.append(
        this.row(this.texts.date, `${this.data.date} ${this.data.time}`)
      )
    if (block.cashbox && this.data.cashbox !== null)
      node.append(this.row(this.texts.cashbox, this.data.cashbox))
    return node
  }

  private items(block: BlockOf<"ITEMS">): HTMLElement {
    const node = this.sized(this.group(), block.size)
    const table = block.layout === "TABLE"
    Object.assign(node.style, {
      display: "grid",
      gridTemplateColumns: table
        ? "minmax(0, 1fr) auto auto"
        : "minmax(0, 1fr)",
      columnGap: "2mm",
      rowGap: table ? "0.5mm" : "1mm",
    })
    if (table)
      for (const [text, align] of [
        [this.texts.itemName, "START"],
        [this.texts.quantity, "END"],
        [this.texts.amount, "END"],
      ] as const) {
        const head = this.line(text, align)
        Object.assign(head.style, {
          fontWeight: "bold",
          borderBottom: "0.3mm solid black",
        })
        node.append(head)
      }
    this.data.lines.forEach((item, index) => {
      const name = this.line(
        `${block.lineNumbers ? `${String(index + 1)}. ` : ""}${item.name}`
      )
      name.style.fontWeight = block.nameBold ? "bold" : "normal"
      const discounted = block.discounts && !isZeroDecimal(item.discount)
      if (table) {
        // The price goes under the name: three columns are all a narrow roll holds.
        const cell = this.group(name, this.line(`× ${money(item.price)}`))
        if (discounted)
          cell.append(
            this.line(`${this.texts.discount} ${minus}${money(item.discount)}`)
          )
        node.append(
          cell,
          this.line(quantity(item.quantity), "END"),
          this.line(money(item.amount), "END")
        )
        return
      }
      const entry = this.group(
        name,
        this.row(
          `${quantity(item.quantity)} × ${money(item.price)}`,
          money(item.amount)
        )
      )
      if (discounted)
        entry.append(
          this.row(this.texts.discount, `${minus}${money(item.discount)}`)
        )
      node.append(entry)
    })
    return node
  }

  /** The total always prints. */
  private totals(block: BlockOf<"TOTALS">): HTMLElement {
    const node = this.sized(this.group(), block.size)
    const discounted = !isZeroDecimal(this.data.discount)
    if (block.subtotal && discounted)
      node.append(this.row(this.texts.subtotal, money(this.data.subtotal)))
    if (block.discount && discounted)
      node.append(
        this.row(this.texts.discount, `${minus}${money(this.data.discount)}`)
      )
    const total = this.row(this.texts.total, money(this.data.total))
    total.style.fontWeight = "bold"
    node.append(this.sized(total, block.totalSize))
    return node
  }

  private payments(block: BlockOf<"PAYMENTS">): HTMLElement {
    const node = this.sized(this.group(), block.size)
    for (const payment of this.data.payments) {
      node.append(this.row(payment.method, money(payment.amount)))
      if (
        block.change &&
        payment.received !== null &&
        payment.change !== null
      ) {
        node.append(
          this.row(`  ${this.texts.received}`, money(payment.received))
        )
        node.append(this.row(`  ${this.texts.change}`, money(payment.change)))
      }
    }
    return node
  }

  /** The receipt number in Code 128 (a return scans it), bars of whole printer dots so a scanner reads them. */
  private barcode(block: BlockOf<"BARCODE">, index: number): HTMLElement {
    const node = this.group()
    Object.assign(node.style, {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    })
    const svg = barcodeSvg(
      this.document,
      this.data.number,
      this.printedMm,
      barcodeHeightMm,
      "CODE128"
    )
    if (svg) node.append(svg)
    else this.issues.push({ index, kind: "barcodeDigitsOnly" })
    // A number that does not encode still prints its digits.
    if (block.digits || !svg) node.append(this.line(this.data.number, "CENTER"))
    return node
  }

  /** A text that no QR code of a scannable size can hold prints as text, and stops a print job. */
  private qr(block: BlockOf<"QR">, index: number): HTMLElement {
    const value = qrValue(block.value, this.data, this.texts.number)
    const result = qrSvg(
      this.document,
      value,
      Math.min(block.sizeMm, this.printedMm)
    )
    if (typeof result === "string") {
      this.issues.push({
        index,
        kind: result === "tooLong" ? "qrTooLong" : "qrTooSmall",
      })
      return this.line(value, "CENTER")
    }
    result.style.margin = "0 auto"
    return this.group(result)
  }

  private divider(block: BlockOf<"DIVIDER">): HTMLElement {
    const node = this.document.createElement("div")
    Object.assign(node.style, {
      margin: "1.5mm 0",
      borderTop:
        block.style === "SPACE"
          ? "0"
          : `0.3mm ${block.style === "DASHED" ? "dashed" : "solid"} black`,
    })
    if (block.style === "SPACE") node.style.height = "2mm"
    return node
  }
}

function alignOf(align: ReceiptAlign): string {
  return align === "CENTER" ? "center" : align === "END" ? "end" : "start"
}
