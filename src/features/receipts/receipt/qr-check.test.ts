import { describe, expect, it } from "vitest"

import type { ReceiptLayout } from "./layout"
import { qrFailures } from "./qr-check"
import { sampleReceipt } from "./sample"

const sample = sampleReceipt({
  storeName: "Cosmos",
  storeAddress: "Ташкент",
  cashbox: "Касса 1",
  cash: "Наличные",
  longProduct: "a",
  weighedProduct: "b",
  discountedProduct: "c",
})

const layoutOf = (value: string, sizeMm: number): ReceiptLayout => ({
  paperWidthMm: 80,
  fontSizePt: 9,
  blocks: [{ type: "QR", value, sizeMm }],
})

const small = { name: "Чиланзар", address: "Ташкент", phone: null }
// 500 characters, as the server allows, and every Cyrillic letter six once a link encodes it.
const huge = {
  name: "Длинный адрес",
  address: "Ташкент, ".repeat(60).trim().slice(0, 500),
  phone: "+998712000103",
}
// Forty letters: a real address, which a link makes 240 characters long.
const long = {
  name: "Длинный",
  address: "Ташкент".padEnd(40, "ы"),
  phone: null,
}

describe("qrFailures", () => {
  it("passes a short link for ordinary shops", () => {
    expect(
      qrFailures(layoutOf("https://t.me/cosmos", 25), sample, [small], "№")
    ).toEqual([])
  })

  it("names the shop whose real address makes the link too big for its size", () => {
    const failures = qrFailures(
      layoutOf("https://shop.uz/?a={storeAddress}", 40),
      sample,
      [small, huge],
      "№"
    )
    expect(failures).toHaveLength(1)
    expect(failures[0]).toMatchObject({
      index: 0,
      shops: ["Длинный адрес"],
      longTotal: false,
    })
  })

  it("refuses a code that fits but would print modules under two dots", () => {
    const link = layoutOf("https://shop.uz/?a={storeAddress}", 15)
    expect(qrFailures(link, sample, [long], "№")[0]).toMatchObject({
      kind: "qrTooSmall",
      shops: ["Длинный"],
    })
    // The same shop passes at 40 mm; the 500-character address fits no code at all.
    expect(
      qrFailures(
        layoutOf("https://shop.uz/?a={storeAddress}", 40),
        sample,
        [long],
        "№"
      )
    ).toEqual([])
    expect(qrFailures(link, sample, [huge], "№")[0]).toMatchObject({
      kind: "qrTooLong",
    })
  })

  it("checks a very large total too", () => {
    const failures = qrFailures(
      layoutOf(`https://shop.uz/${"x".repeat(123)}?t={total}`, 15),
      sample,
      [],
      "№"
    )
    expect(failures.some((f) => f.longTotal)).toBe(true)
  })

  it("ignores the blocks that are not QR codes", () => {
    const layout: ReceiptLayout = {
      paperWidthMm: 80,
      fontSizePt: 9,
      blocks: [{ type: "BARCODE", digits: true }],
    }
    expect(qrFailures(layout, sample, [huge], "№")).toEqual([])
  })
})
