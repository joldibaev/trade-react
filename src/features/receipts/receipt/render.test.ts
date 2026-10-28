import { describe, expect, it } from "vitest"

import { printerDotMm } from "@/features/printing/barcode"

import {
  fillVariables,
  qrValue,
  textValues,
  unknownVariables,
  type ReceiptTexts,
} from "./data"
import type { ReceiptBlock, ReceiptLayout } from "./layout"
import { drawReceipt } from "./render"
import { sampleReceipt } from "./sample"

const texts: ReceiptTexts = {
  number: "№",
  date: "Дата",
  cashbox: "Касса",
  subtotal: "Сумма",
  discount: "Скидка",
  total: "Итого",
  received: "Получено",
  change: "Сдача",
  itemName: "Товар",
  quantity: "Кол-во",
  amount: "Сумма",
  notFiscal: "Не является фискальным чеком",
}

const data = sampleReceipt({
  storeName: "Cosmos Чиланзар",
  storeAddress: "Ташкент & область",
  cashbox: "Касса 1",
  cash: "Наличные",
  longProduct: "Кетчуп томатный классический",
  weighedProduct: "Сыр",
  discountedProduct: "Хлеб",
})

const items: ReceiptBlock = {
  type: "ITEMS",
  layout: "LINES",
  size: "NORMAL",
  nameBold: false,
  lineNumbers: true,
  discounts: true,
}
const totals: ReceiptBlock = {
  type: "TOTALS",
  subtotal: true,
  discount: true,
  size: "NORMAL",
  totalSize: "LARGE",
}
const document1: ReceiptBlock = {
  type: "DOCUMENT",
  title: "Товарный чек",
  size: "NORMAL",
  dateTime: true,
  cashbox: true,
}

function layoutOf(
  blocks: ReceiptBlock[],
  paperWidthMm: 58 | 80 = 80
): ReceiptLayout {
  return { paperWidthMm, fontSizePt: 9, blocks }
}

const draw = (blocks: ReceiptBlock[], receipt = data, paper: 58 | 80 = 80) =>
  drawReceipt(document, layoutOf(blocks, paper), receipt, texts)

describe("variables", () => {
  it("fills the known ones and leaves any other {word} as written", () => {
    const values = textValues(data, "№")
    expect(fillVariables("Чек {number} от {date} {time}", values)).toBe(
      "Чек №1042 от 07.10.2026 14:32"
    )
    expect(fillVariables("{storeName}: {nmae}", values)).toBe(
      "Cosmos Чиланзар: {nmae}"
    )
  })

  it("reports what TradeNet would refuse, and no cashier", () => {
    expect(unknownVariables("{number} {cashier} {nmae}")).toEqual([
      "cashier",
      "nmae",
    ])
    expect(unknownVariables("{ 1 } {} {number}")).toEqual([])
  })

  it("writes the total as the receipt shows it", () => {
    expect(textValues(data, "№").total).toBe("92 280,00")
    expect(textValues(data, "№").storePhone).toBe("+998 71 200 01 03")
  })
})

describe("QR value", () => {
  it("keeps the values of an ordinary text as printed", () => {
    expect(qrValue("{storeName} {number}", data, "№")).toBe(
      "Cosmos Чиланзар №1042"
    )
  })

  it("URL-encodes the values in a link, with the raw number and total", () => {
    expect(
      qrValue(
        "https://t.me/shop?n={number}&s={storeAddress}&t={total}",
        data,
        "№"
      )
    ).toBe(
      "https://t.me/shop?n=1042&s=%D0%A2%D0%B0%D1%88%D0%BA%D0%B5%D0%BD%D1%82%20%26%20%D0%BE%D0%B1%D0%BB%D0%B0%D1%81%D1%82%D1%8C&t=92280.00"
    )
    expect(qrValue("HTTP://x.uz/{date}", data, "№")).toBe(
      "HTTP://x.uz/07.10.2026"
    )
  })
})

describe("drawReceipt", () => {
  it("ends with the not-fiscal line whatever the template holds", () => {
    for (const blocks of [[], [items], [document1, items, totals]]) {
      const { root } = draw(blocks)
      expect(root.lastElementChild?.textContent).toBe(
        "Не является фискальным чеком"
      )
    }
  })

  it("prints the receipt number with the title, then the date and the cashbox", () => {
    const { root } = draw([document1])
    const block = root.querySelector("[data-block='0']")
    expect(block?.textContent).toContain("Товарный чек №1042")
    expect(block?.textContent).toContain("07.10.2026 14:32")
    expect(block?.textContent).toContain("Касса 1")
  })

  it("writes user text as text, never as markup", () => {
    const hostile = { ...data, storeName: "<img src=x onerror=alert(1)>" }
    const { root } = draw(
      [
        {
          type: "TEXT",
          text: "<b>{storeName}</b>",
          align: "START",
          size: "NORMAL",
          bold: false,
        },
      ],
      hostile
    )
    expect(root.querySelector("img, b")).toBeNull()
    expect(root.textContent).toContain("<b><img src=x onerror=alert(1)></b>")
  })

  it("keeps line breaks of a text", () => {
    const { root } = draw([
      {
        type: "TEXT",
        text: "a\nb",
        align: "CENTER",
        size: "SMALL",
        bold: true,
      },
    ])
    const text = root.querySelector<HTMLElement>("[data-block='0']")
    expect(text?.style.whiteSpace).toBe("pre-wrap")
    expect(text?.style.textAlign).toBe("center")
    expect(text?.style.fontWeight).toBe("bold")
  })

  it("lists the goods as lines, with the discount only where there is one", () => {
    const { root } = draw([items])
    const block = root.querySelector<HTMLElement>("[data-block='0']")
    expect(block?.style.gridTemplateColumns).toBe("minmax(0, 1fr)")
    expect(block?.textContent).toContain("1. Кетчуп томатный классический")
    expect(block?.textContent).toContain("2 × 18 790,00")
    expect(block?.textContent).toContain("0,45 × 96 000,00")
    expect(block?.textContent.match(/Скидка/g)).toHaveLength(1)
    expect(block?.textContent).toContain("Скидка−1 000,00")
  })

  it("lists the goods as a table: a header row, then name, quantity and amount", () => {
    const { root } = draw([{ ...items, layout: "TABLE", lineNumbers: false }])
    const block = root.querySelector<HTMLElement>("[data-block='0']")
    expect(block?.style.gridTemplateColumns).toBe("minmax(0, 1fr) auto auto")
    // 3 header cells + 3 cells for each of the 3 lines.
    expect(block?.children).toHaveLength(12)
    expect(block?.children[0]?.textContent).toBe("Товар")
    expect(block?.children[3]?.textContent).toContain(
      "Кетчуп томатный классический"
    )
    expect(block?.children[3]?.textContent).toContain("× 18 790,00")
    expect(block?.children[4]?.textContent).toBe("2")
    expect(block?.children[5]?.textContent).toBe("37 580,00")
  })

  it("lets a long name wrap inside the roll", () => {
    const { root } = draw([items])
    expect(root.style.overflowWrap).toBe("anywhere")
    expect(root.style.width).toBe("72mm")
    const narrow = draw([items], data, 58).root
    expect(narrow.style.width).toBe("48mm")
  })

  it("draws the printed width alone when printing, the whole roll with margins in the editor", () => {
    const printed = drawReceipt(document, layoutOf([]), data, texts).root
    expect(printed.style.width).toBe("72mm")
    const roll = drawReceipt(document, layoutOf([]), data, texts, {
      roll: true,
    }).root
    expect(roll.style.width).toBe("80mm")
    expect(roll.style.padding).toBe("2mm 4mm 4mm")
  })

  it("shows the subtotal and discount only for a discounted sale, the total always", () => {
    const { root } = draw([totals])
    expect(root.textContent).toContain("Сумма93 280,00")
    expect(root.textContent).toContain("Скидка−1 000,00")
    expect(root.textContent).toContain("Итого92 280,00")
    const plain = draw([totals], {
      ...data,
      discount: "0.00",
      subtotal: "92280.00",
    }).root
    expect(plain.textContent).not.toContain("Скидка")
    expect(plain.textContent).toContain("Итого92 280,00")
  })

  it("prints the payments, and the change only for cash that asked for it", () => {
    const withChange: ReceiptBlock = {
      type: "PAYMENTS",
      change: true,
      size: "NORMAL",
    }
    expect(draw([withChange]).root.textContent).toContain("Получено100 000,00")
    expect(draw([withChange]).root.textContent).toContain("Сдача7 720,00")
    const without = draw([{ ...withChange, change: false }]).root
    expect(without.textContent).toContain("Наличные92 280,00")
    expect(without.textContent).not.toContain("Сдача")
    const card = draw([withChange], {
      ...data,
      payments: [
        { method: "Карта", amount: "92280.00", received: null, change: null },
      ],
    }).root
    expect(card.textContent).not.toContain("Сдача")
  })

  it("leaves out the store's phone when the shop has none", () => {
    const store: ReceiptBlock = {
      type: "STORE",
      name: true,
      address: true,
      phone: true,
      align: "CENTER",
      size: "NORMAL",
    }
    expect(draw([store]).root.textContent).toContain("+998 71")
    expect(
      draw([store], { ...data, storePhone: null }).root.textContent
    ).not.toContain("+998")
  })

  it("draws the number as a Code 128 barcode, even when its digits could pass for an EAN-8", () => {
    const barcode: ReceiptBlock = { type: "BARCODE", digits: true }
    const { root, issues } = draw([barcode], { ...data, number: "96385074" })
    expect(issues).toEqual([])
    expect(root.querySelector("svg")).not.toBeNull()
    // Code 128 of 8 digits is 11 modules per pair of digits plus start, check and stop: well over EAN-8's 67.
    const viewBox = root.querySelector("svg")?.getAttribute("viewBox") ?? ""
    expect(Number(viewBox.split(" ")[2])).toBeGreaterThan(80)
    expect(root.querySelector("[data-block='0']")?.textContent).toBe("96385074")
  })

  it("prints the digits alone when the number cannot be a barcode", () => {
    const { root, issues } = draw([{ type: "BARCODE", digits: false }], {
      ...data,
      number: "№ 1042",
    })
    expect(issues).toEqual([{ index: 0, kind: "barcodeDigitsOnly" }])
    expect(root.querySelector("svg")).toBeNull()
    expect(root.querySelector("[data-block='0']")?.textContent).toBe("№ 1042")
  })

  it("draws a QR code in whole printer dots", () => {
    const { root, issues } = draw([
      { type: "QR", value: "https://t.me/cosmos", sizeMm: 30 },
    ])
    expect(issues).toEqual([])
    const svg = root.querySelector("svg")
    const side = Number.parseFloat(svg?.style.width ?? "")
    expect(side).toBeLessThanOrEqual(30)
    const total = Number((svg?.getAttribute("viewBox") ?? "").split(" ")[2])
    const dots = side / printerDotMm / total
    expect(dots).toBeCloseTo(Math.round(dots), 6)
    expect(dots).toBeGreaterThanOrEqual(2)
  })

  it("stops on a QR code that cannot be read at its size, and prints its text instead", () => {
    const value = `https://shop.uz/${"x".repeat(150)}`
    const small = draw([{ type: "QR", value, sizeMm: 15 }])
    expect(small.issues).toEqual([{ index: 0, kind: "qrTooSmall" }])
    expect(small.root.querySelector("svg")).toBeNull()
    expect(small.root.textContent).toContain(value)
    // The filled value is what counts: a link that grows when its values are URL-encoded.
    const long = draw([
      {
        type: "QR",
        value: `https://x.uz/${"{storeAddress}".repeat(400)}`,
        sizeMm: 40,
      },
    ])
    expect(long.issues).toEqual([{ index: 0, kind: "qrTooLong" }])
  })

  it("draws dividers", () => {
    const { root } = draw([
      { type: "DIVIDER", style: "DASHED" },
      { type: "DIVIDER", style: "SPACE" },
    ])
    expect(
      root.querySelector<HTMLElement>("[data-block='0']")?.style.borderTop
    ).toContain("dashed")
    expect(
      root.querySelector<HTMLElement>("[data-block='1']")?.style.height
    ).toBe("2mm")
  })

  it("scales a size against the text size of the receipt", () => {
    const { root } = draw([
      { type: "TEXT", text: "x", align: "START", size: "LARGE", bold: false },
    ])
    expect(
      root.querySelector<HTMLElement>("[data-block='0']")?.style.fontSize
    ).toBe("14.4pt")
  })
})

describe("a QR link with a long Cyrillic address", () => {
  // One Cyrillic letter is six characters once URL-encoded: the filled value is what must fit.
  const address = "Ташкент, Чиланзарский район, 9-й квартал, дом 14, корпус 2"
  const link = "https://shop.uz/find?address={storeAddress}"
  const long = { ...data, storeAddress: address }

  it("is refused at 15 mm: its modules would be under 2 printer dots", () => {
    const { issues, root } = draw(
      [{ type: "QR", value: link, sizeMm: 15 }],
      long
    )
    expect(issues).toEqual([{ index: 0, kind: "qrTooSmall" }])
    expect(root.querySelector("svg")).toBeNull()
  })

  it("is refused when the filled value fits no QR code at all", () => {
    const huge = { ...data, storeAddress: address.repeat(20) }
    const { issues } = draw([{ type: "QR", value: link, sizeMm: 40 }], huge)
    expect(issues).toEqual([{ index: 0, kind: "qrTooLong" }])
  })

  it("passes at 40 mm", () => {
    const { issues, root } = draw(
      [{ type: "QR", value: link, sizeMm: 40 }],
      long
    )
    expect(issues).toEqual([])
    expect(root.querySelector("svg")).not.toBeNull()
  })

  it("passes at 15 mm when the value is short", () => {
    const { issues } = draw(
      [{ type: "QR", value: "https://t.me/cosmos", sizeMm: 15 }],
      long
    )
    expect(issues).toEqual([])
  })
})
