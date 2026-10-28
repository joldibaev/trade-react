import { qrValue, type ReceiptData } from "./data"
import type { ReceiptLayout } from "./layout"
import { qrProblem, type QrProblem } from "./qr"

/** A real shop, as far as a receipt prints it. */
export type ShopDetails = {
  name: string
  address: string | null
  phone: string | null
}

/** A sum far longer than any real one: eleven digits and the fraction. */
const longTotal = "99999999999.99"

export type QrFailure = {
  /** The QR block in `layout.blocks`. */
  index: number
  kind: "qrTooLong" | "qrTooSmall"
  /** The shops whose receipts would not print, by name. */
  shops: string[]
  /** Even the sample shop with a very large total does not print. */
  longTotal: boolean
}

const kindOf = (problem: QrProblem): QrFailure["kind"] =>
  problem === "tooLong" ? "qrTooLong" : "qrTooSmall"

/**
 * The QR blocks that would stop a print at a real till: the value is filled with each shop's own name, address and
 * phone (an address can be 500 characters, and in a link every Cyrillic letter is six), and with a huge total. The
 * editor shows them before the template is saved, naming the shops that fail.
 */
export function qrFailures(
  layout: ReceiptLayout,
  sample: ReceiptData,
  shops: readonly ShopDetails[],
  numberSign: string
): QrFailure[] {
  const failures: QrFailure[] = []
  layout.blocks.forEach((block, index) => {
    if (block.type !== "QR") return
    const check = (data: ReceiptData) =>
      qrProblem(qrValue(block.value, data, numberSign), block.sizeMm)
    const byKind = new Map<QrFailure["kind"], QrFailure>()
    const note = (problem: QrProblem | null) => {
      if (problem === null) return undefined
      const kind = kindOf(problem)
      const known = byKind.get(kind) ?? {
        index,
        kind,
        shops: [],
        longTotal: false,
      }
      byKind.set(kind, known)
      return known
    }
    for (const shop of shops) {
      const failure = note(
        check({
          ...sample,
          storeName: shop.name,
          storeAddress: shop.address ?? "",
          storePhone: shop.phone,
        })
      )
      failure?.shops.push(shop.name)
    }
    const big = note(check({ ...sample, total: longTotal }))
    if (big) big.longTotal = true
    failures.push(...byKind.values())
  })
  return failures
}
