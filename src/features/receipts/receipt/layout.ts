import type { components } from "@/api/schema"

export type ReceiptLayout = components["schemas"]["ReceiptLayout"]
export type ReceiptBlock = components["schemas"]["ReceiptBlock"]
export type BlockType = ReceiptBlock["type"]
export type ReceiptTextSize = components["schemas"]["ReceiptTextSize"]
export type ReceiptAlign = components["schemas"]["ReceiptAlign"]
export type ReceiptDividerStyle = components["schemas"]["ReceiptDividerStyle"]
export type ReceiptItemsLayout = components["schemas"]["ReceiptItemsLayout"]
export type PaperWidth = 58 | 80

export type BlockOf<T extends BlockType> = Extract<ReceiptBlock, { type: T }>

/** What the server accepts (TradeNet `ReceiptLayout.cs`); the editor refuses the same, one step earlier. */
export const limits = {
  fontSizePt: { min: 6, max: 14 },
  blocks: 30,
  images: 2,
  textLength: 300,
  titleLength: 40,
  qrValueLength: 200,
  qrSizeMm: { min: 15, max: 40 },
  imageWidthPercent: { min: 20, max: 100 },
}

/** Blocks about the sale itself appear once; texts, QR codes, dividers repeat, images up to `limits.images`. */
export const singleBlocks: readonly BlockType[] = [
  "STORE",
  "DOCUMENT",
  "ITEMS",
  "TOTALS",
  "PAYMENTS",
  "BARCODE",
]

/** A receipt without these cannot be returned or paid for: the server refuses a layout missing one. */
export const requiredBlocks: readonly BlockType[] = [
  "DOCUMENT",
  "ITEMS",
  "TOTALS",
]

export const blockTypes: readonly BlockType[] = [
  "TEXT",
  "IMAGE",
  "STORE",
  "DOCUMENT",
  "ITEMS",
  "TOTALS",
  "PAYMENTS",
  "BARCODE",
  "QR",
  "DIVIDER",
]

/** What a roll prints across: a thermal head is narrower than its paper. */
export function printedWidthMm(paperWidthMm: number): number {
  return paperWidthMm === 58 ? 48 : 72
}

export function isPaperWidth(value: number): value is PaperWidth {
  return value === 58 || value === 80
}
