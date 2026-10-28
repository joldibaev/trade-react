import type { FieldCode } from "@/api/errors"
import { imageMaxLength } from "@/features/printing/image"
import { textError } from "@/lib/text-rules"

import { unknownVariables } from "../receipt/data"
import {
  limits,
  requiredBlocks,
  singleBlocks,
  type BlockType,
  type PaperWidth,
  type ReceiptBlock,
  type ReceiptLayout,
} from "../receipt/layout"

/** A block with a key of the editor's own: the server has no block ids, the order is the printing order. */
export type DraftBlock = { key: string; block: ReceiptBlock }

export type Draft = {
  paperWidthMm: number
  fontSizePt: number
  blocks: DraftBlock[]
}

let counter = 0
export const newKey = () => `block-${String(++counter)}`

export const draftOf = (layout: ReceiptLayout): Draft => ({
  paperWidthMm: layout.paperWidthMm,
  fontSizePt: layout.fontSizePt,
  blocks: layout.blocks.map((block) => ({ key: newKey(), block })),
})

export const layoutOf = (draft: Draft): ReceiptLayout => ({
  paperWidthMm: draft.paperWidthMm,
  fontSizePt: draft.fontSizePt,
  blocks: draft.blocks.map((item) => item.block),
})

/** The words a new block starts with: they are the catalog's. */
export type BlockDefaults = { text: string; title: string }

export function newBlock(type: BlockType, words: BlockDefaults): ReceiptBlock {
  switch (type) {
    case "TEXT":
      return {
        type,
        text: words.text,
        align: "CENTER",
        size: "NORMAL",
        bold: false,
      }
    case "IMAGE":
      return { type, src: "", widthPercent: 60 }
    case "STORE":
      return {
        type,
        name: true,
        address: true,
        phone: true,
        align: "CENTER",
        size: "NORMAL",
      }
    case "DOCUMENT":
      return {
        type,
        title: words.title,
        size: "NORMAL",
        dateTime: true,
        cashbox: true,
      }
    case "ITEMS":
      return {
        type,
        layout: "LINES",
        size: "NORMAL",
        nameBold: false,
        lineNumbers: true,
        discounts: true,
      }
    case "TOTALS":
      return {
        type,
        subtotal: true,
        discount: true,
        size: "NORMAL",
        totalSize: "LARGE",
      }
    case "PAYMENTS":
      return { type, change: true, size: "NORMAL" }
    case "BARCODE":
      return { type, digits: true }
    case "QR":
      return { type, value: "", sizeMm: 25 }
    case "DIVIDER":
      return { type, style: "DASHED" }
  }
}

/** The standard receipt: the shop, the number, the goods, the totals, the payments, the number as a barcode, thanks. */
export function standardLayout(
  words: BlockDefaults,
  paperWidthMm: PaperWidth = 80
): ReceiptLayout {
  const types: BlockType[] = [
    "STORE",
    "DOCUMENT",
    "ITEMS",
    "TOTALS",
    "PAYMENTS",
    "BARCODE",
    "TEXT",
  ]
  return {
    paperWidthMm,
    fontSizePt: 9,
    blocks: types.map((type) => newBlock(type, words)),
  }
}

const count = (draft: Draft, type: BlockType) =>
  draft.blocks.filter((item) => item.block.type === type).length

export const isRequired = (type: BlockType) => requiredBlocks.includes(type)

/** A block of this type may be added: not past the limits, a once-only block not twice, at most two images. */
export function canAdd(draft: Draft, type: BlockType): boolean {
  if (draft.blocks.length >= limits.blocks) return false
  if (singleBlocks.includes(type)) return count(draft, type) === 0
  if (type === "IMAGE") return count(draft, type) < limits.images
  return true
}

export type BlockAction = "up" | "down" | "duplicate" | "delete"

/** What the selected block may do now; required blocks cannot be deleted, once-only ones cannot be duplicated. */
export function canAct(
  draft: Draft,
  key: string,
  action: BlockAction
): boolean {
  const index = draft.blocks.findIndex((item) => item.key === key)
  const item = draft.blocks[index]
  if (!item) return false
  switch (action) {
    case "up":
      return index > 0
    case "down":
      return index < draft.blocks.length - 1
    case "duplicate":
      return canAdd(draft, item.block.type)
    case "delete":
      return !isRequired(item.block.type)
  }
}

/** The draft after `action` on the block, and the block to select next. */
export function applyAction(
  draft: Draft,
  key: string,
  action: BlockAction
): { draft: Draft; selected: string | null } {
  const index = draft.blocks.findIndex((item) => item.key === key)
  const item = draft.blocks[index]
  if (!item || !canAct(draft, key, action)) return { draft, selected: key }
  const blocks = [...draft.blocks]
  switch (action) {
    case "up":
    case "down": {
      const to = action === "up" ? index - 1 : index + 1
      const other = blocks[to]
      if (!other) return { draft, selected: key }
      blocks[to] = item
      blocks[index] = other
      return { draft: { ...draft, blocks }, selected: key }
    }
    case "duplicate": {
      const copy = { key: newKey(), block: item.block }
      blocks.splice(index + 1, 0, copy)
      return { draft: { ...draft, blocks }, selected: copy.key }
    }
    case "delete": {
      blocks.splice(index, 1)
      return {
        draft: { ...draft, blocks },
        selected: (blocks[index] ?? blocks[index - 1])?.key ?? null,
      }
    }
  }
}

/** Fields of one block (`text`, `title`, `value`, `sizeMm`, `widthPercent`, `src`) to the code that refuses them. */
export type BlockErrors = Partial<Record<string, FieldCode>>

const inRange = (value: number, range: { min: number; max: number }) =>
  Number.isInteger(value) && value >= range.min && value <= range.max

/** What TradeNet would refuse about one block, found here first; never stricter than the server. */
export function blockErrors(block: ReceiptBlock): BlockErrors {
  const errors: BlockErrors = {}
  const refuse = (field: string, code: FieldCode | undefined) => {
    if (code !== undefined) errors[field] = code
  }
  const variables = (text: string) =>
    unknownVariables(text).length > 0 ? "INVALID_VALUE" : undefined
  switch (block.type) {
    case "TEXT":
      refuse(
        "text",
        textError(block.text, { max: limits.textLength, multiline: true }) ??
          variables(block.text)
      )
      break
    case "IMAGE":
      if (block.src === "") refuse("src", "REQUIRED")
      else if (block.src.length > imageMaxLength) refuse("src", "OUT_OF_RANGE")
      if (!inRange(block.widthPercent, limits.imageWidthPercent))
        refuse("widthPercent", "OUT_OF_RANGE")
      break
    case "DOCUMENT":
      refuse("title", textError(block.title, { max: limits.titleLength }))
      break
    case "QR":
      refuse(
        "value",
        textError(block.value, { max: limits.qrValueLength }) ??
          variables(block.value)
      )
      if (!inRange(block.sizeMm, limits.qrSizeMm))
        refuse("sizeMm", "OUT_OF_RANGE")
      break
    default:
      break
  }
  return errors
}

/** The errors per block key, and the ones about the layout as a whole under `""` (the roll, the text size, the count). */
export function draftErrors(draft: Draft): Map<string, BlockErrors> {
  const errors = new Map<string, BlockErrors>()
  for (const item of draft.blocks) {
    const found = blockErrors(item.block)
    if (Object.keys(found).length > 0) errors.set(item.key, found)
  }
  const general: BlockErrors = {}
  if (!inRange(draft.fontSizePt, limits.fontSizePt))
    general.fontSizePt = "OUT_OF_RANGE"
  if (draft.blocks.length > limits.blocks) general.blocks = "OUT_OF_RANGE"
  else if (requiredBlocks.some((type) => count(draft, type) === 0))
    general.blocks = "REQUIRED"
  if (Object.keys(general).length > 0) errors.set("", general)
  return errors
}

/**
 * The server names a refused field by its place: `layout.blocks[3].text`, `layout.fontSizePt`, `layout.blocks`. This
 * turns them into block keys (`""` for the layout) and field names, in the same shape as `draftErrors`.
 */
export function serverBlockErrors(
  draft: Draft,
  fieldErrors: Record<string, readonly string[]>
): Map<string, BlockErrors> {
  const errors = new Map<string, BlockErrors>()
  // Indices arrive as text; looking them up by text keeps them from becoming numbers by hand.
  const byIndex = new Map(draft.blocks.map((item, i) => [String(i), item]))
  const add = (key: string, field: string, code: string | undefined) => {
    if (code === undefined) return
    errors.set(key, { ...errors.get(key), [field]: code as FieldCode })
  }
  for (const [path, codes] of Object.entries(fieldErrors)) {
    const block = /^layout\.blocks\[(\d+)\]\.?(.*)$/i.exec(path)
    if (block) {
      const item = byIndex.get(block[1] ?? "")
      add(item?.key ?? "", block[2] || "block", codes[0])
    } else add("", path.replace(/^layout\./i, ""), codes[0])
  }
  return errors
}
