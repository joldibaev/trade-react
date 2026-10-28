import { describe, expect, it } from "vitest"

import type { BlockOf, BlockType, ReceiptBlock } from "../receipt/layout"
import {
  applyAction,
  blockErrors,
  canAct,
  canAdd,
  draftErrors,
  draftOf,
  layoutOf,
  newBlock,
  serverBlockErrors,
  standardLayout,
} from "./draft"

const words = { text: "Спасибо", title: "Товарный чек" }
const standard = () => draftOf(standardLayout(words))
const make = <T extends BlockType>(
  type: T,
  patch: Partial<BlockOf<T>>
): ReceiptBlock => ({ ...newBlock(type, words), ...patch })
const keyOf = (draft: ReturnType<typeof standard>, type: string) =>
  draft.blocks.find((item) => item.block.type === type)?.key ?? ""

describe("the standard receipt", () => {
  it("has the three required blocks and passes every check", () => {
    const draft = standard()
    expect(draft.blocks.map((item) => item.block.type)).toEqual([
      "STORE",
      "DOCUMENT",
      "ITEMS",
      "TOTALS",
      "PAYMENTS",
      "BARCODE",
      "TEXT",
    ])
    expect(draftErrors(draft).size).toBe(0)
  })

  it("goes to the server as the layout it came from", () => {
    const layout = standardLayout(words, 58)
    expect(layoutOf(draftOf(layout))).toEqual(layout)
  })
})

describe("adding", () => {
  it("allows a block about the sale once, texts and dividers any number of times", () => {
    const draft = standard()
    expect(canAdd(draft, "STORE")).toBe(false)
    expect(canAdd(draft, "BARCODE")).toBe(false)
    expect(canAdd(draft, "TEXT")).toBe(true)
    expect(canAdd(draft, "QR")).toBe(true)
    expect(canAdd(draft, "DIVIDER")).toBe(true)
  })

  it("allows two images, not three", () => {
    let draft = standard()
    for (let added = 0; added < 2; added++) {
      expect(canAdd(draft, "IMAGE")).toBe(true)
      draft = {
        ...draft,
        blocks: [
          ...draft.blocks,
          {
            key: `image-${String(draft.blocks.length)}`,
            block: newBlock("IMAGE", words),
          },
        ],
      }
    }
    expect(canAdd(draft, "IMAGE")).toBe(false)
  })

  it("stops at 30 blocks", () => {
    const base = standard()
    const full = {
      ...base,
      blocks: [
        ...base.blocks,
        ...Array.from({ length: 23 }, (_, i) => ({
          key: `d-${String(i)}`,
          block: newBlock("DIVIDER", words),
        })),
      ],
    }
    expect(full.blocks).toHaveLength(30)
    expect(canAdd(full, "TEXT")).toBe(false)
    expect(canAct(full, keyOf(full, "TEXT"), "duplicate")).toBe(false)
  })
})

describe("acting on a block", () => {
  it("moves a block up and down, and not past the ends", () => {
    const draft = standard()
    const store = keyOf(draft, "STORE")
    expect(canAct(draft, store, "up")).toBe(false)
    const moved = applyAction(draft, store, "down").draft
    expect(moved.blocks.map((item) => item.block.type).slice(0, 2)).toEqual([
      "DOCUMENT",
      "STORE",
    ])
    const text = keyOf(draft, "TEXT")
    expect(canAct(draft, text, "down")).toBe(false)
  })

  it("duplicates a text under itself and selects the copy, but not a block that may appear once", () => {
    const draft = standard()
    const text = keyOf(draft, "TEXT")
    const result = applyAction(draft, text, "duplicate")
    expect(result.draft.blocks).toHaveLength(draft.blocks.length + 1)
    expect(result.selected).not.toBe(text)
    expect(canAct(draft, keyOf(draft, "ITEMS"), "duplicate")).toBe(false)
  })

  it("deletes a text but never a required block", () => {
    const draft = standard()
    for (const type of ["DOCUMENT", "ITEMS", "TOTALS"]) {
      expect(canAct(draft, keyOf(draft, type), "delete")).toBe(false)
      const same = applyAction(draft, keyOf(draft, type), "delete").draft
      expect(same.blocks).toHaveLength(draft.blocks.length)
    }
    const result = applyAction(draft, keyOf(draft, "TEXT"), "delete")
    expect(result.draft.blocks).toHaveLength(draft.blocks.length - 1)
    expect(result.selected).toBe(keyOf(draft, "BARCODE"))
  })
})

describe("checks, never stricter than TradeNet", () => {
  it("refuses an unknown variable, the cashier included, in a text and in a QR code", () => {
    const text = { ...newBlock("TEXT", words), text: "Кассир {cashier}" }
    expect(blockErrors(text)).toEqual({ text: "INVALID_VALUE" })
    const qr = { ...newBlock("QR", words), value: "https://x.uz/{nmae}" }
    expect(blockErrors(qr)).toEqual({ value: "INVALID_VALUE" })
  })

  it("lets other braces through as plain text", () => {
    const text = { ...newBlock("TEXT", words), text: "{ } {1} {number} {}" }
    expect(blockErrors(text)).toEqual({})
  })

  it("holds a text to 300 characters, a title to 1..40, a QR value to one line of 1..200", () => {
    expect(blockErrors(make("TEXT", { text: "x".repeat(301) }))).toEqual({
      text: "OUT_OF_RANGE",
    })
    expect(blockErrors(make("TEXT", { text: "x".repeat(300) }))).toEqual({})
    expect(blockErrors(make("DOCUMENT", { title: " " }))).toEqual({
      title: "REQUIRED",
    })
    expect(blockErrors(make("DOCUMENT", { title: "x".repeat(41) }))).toEqual({
      title: "OUT_OF_RANGE",
    })
    expect(blockErrors(make("QR", { value: "" }))).toEqual({
      value: "REQUIRED",
    })
    expect(blockErrors(make("QR", { value: "a\nb" }))).toEqual({
      value: "INVALID_FORMAT",
    })
    expect(blockErrors(make("QR", { value: "x".repeat(201) }))).toEqual({
      value: "OUT_OF_RANGE",
    })
  })

  it("mirrors the server's TextAttribute: no empty text, no space at the ends, NFC length", () => {
    expect(blockErrors(make("TEXT", { text: "" }))).toEqual({
      text: "REQUIRED",
    })
    expect(blockErrors(make("TEXT", { text: "a\nb" }))).toEqual({})
    expect(blockErrors(make("TEXT", { text: "a\n" }))).toEqual({
      text: "INVALID_FORMAT",
    })
    expect(blockErrors(make("DOCUMENT", { title: " чек" }))).toEqual({
      title: "INVALID_FORMAT",
    })
    // Decomposed letters count once normalized: 300 of them are allowed.
    expect(blockErrors(make("TEXT", { text: "й".repeat(300) }))).toEqual({})
  })

  it("reads variables on the NFC form, as the server does", () => {
    // A Kelvin sign is a K once normalized: {Kelvin} is an unknown variable, not text to let through.
    expect(blockErrors(make("TEXT", { text: "{Kelvin}" }))).toEqual({
      text: "INVALID_VALUE",
    })
  })

  it("holds a QR size to 15..40 mm and an image to 20..100 percent and a picture", () => {
    expect(blockErrors(make("QR", { value: "a", sizeMm: 14 }))).toEqual({
      sizeMm: "OUT_OF_RANGE",
    })
    expect(blockErrors(make("QR", { value: "a", sizeMm: 40 }))).toEqual({})
    expect(blockErrors(newBlock("IMAGE", words))).toEqual({ src: "REQUIRED" })
    expect(
      blockErrors(
        make("IMAGE", { src: "data:image/png;base64,AAAA", widthPercent: 19 })
      )
    ).toEqual({ widthPercent: "OUT_OF_RANGE" })
  })

  it("notices a missing required block and a text size outside 6..14 pt", () => {
    const draft = standard()
    const without = {
      ...draft,
      fontSizePt: 15,
      blocks: draft.blocks.filter((item) => item.block.type !== "TOTALS"),
    }
    expect(draftErrors(without).get("")).toEqual({
      fontSizePt: "OUT_OF_RANGE",
      blocks: "REQUIRED",
    })
  })
})

describe("the server's refusals", () => {
  it("land on the block they name, by its place in the list", () => {
    const draft = standard()
    const errors = serverBlockErrors(draft, {
      "layout.blocks[6].text": ["INVALID_VALUE"],
      "layout.blocks": ["REQUIRED"],
      "layout.fontSizePt": ["OUT_OF_RANGE"],
      "layout.blocks[40].text": ["INVALID_VALUE"],
    })
    expect(errors.get(keyOf(draft, "TEXT"))).toEqual({ text: "INVALID_VALUE" })
    expect(errors.get("")).toEqual({
      blocks: "REQUIRED",
      fontSizePt: "OUT_OF_RANGE",
      text: "INVALID_VALUE",
    })
  })
})
