import type { FieldCode } from "@/api/errors"

import { imageMaxLength } from "@/features/printing/image"

import { unknownVariables } from "../label-data"
import { mm, mmText } from "../mm"
import type {
  LabelElement,
  LabelLayout,
  LabelTextStyle,
} from "../templates-api"

/** TradeNet `LabelLimits`: what the server refuses, checked here first so the editor can say it at the element. */
export const limits = {
  minSizeMm: 10,
  maxSizeMm: 120,
  maxElements: 40,
  maxImages: 3,
  textMaxLength: 300,
  minFontPt: 4,
  maxFontPt: 96,
  maxBorderMm: 5,
  imageMaxLength,
  nameMaxLength: 100,
}

/** The rolls shops use (trade4's sizes). */
export const labelSizes = [
  [58, 40],
  [58, 30],
  [40, 30],
  [30, 20],
] as const

/** Drag, resize and the label's size snap to half a millimetre: finer than the eye, coarser than a slip of the hand. */
export const snapMm = 0.5
const minBoxMm = 0.5

/** An element of the draft: the API's element, keyed for React and for the history (the API keeps no ids). */
export type DraftItem = { key: string; element: LabelElement }

export type Draft = { widthMm: string; heightMm: string; items: DraftItem[] }

export type ElementKind =
  "TEXT" | "PRICE" | "BARCODE" | "FRAME" | "LINE" | "IMAGE"

let nextKey = 1
export const newKey = () => `e${String(nextKey++)}`

export const draftOf = (layout: LabelLayout): Draft => ({
  widthMm: layout.widthMm,
  heightMm: layout.heightMm,
  items: layout.elements.map((element) => ({ key: newKey(), element })),
})

export const layoutOf = (draft: Draft): LabelLayout => ({
  widthMm: draft.widthMm,
  heightMm: draft.heightMm,
  elements: draft.items.map((item) => item.element),
})

export type Box = { x: number; y: number; w: number; h: number }

export const boxOf = (element: LabelElement): Box => ({
  x: mm(element.xMm),
  y: mm(element.yMm),
  w: mm(element.widthMm),
  h: mm(element.heightMm),
})

export const snap = (value: number) => Math.round(value / snapMm) * snapMm

/** The box kept inside the label: shrunk when bigger, moved back in when out. */
export function fitInside(box: Box, width: number, height: number): Box {
  const w = Math.min(Math.max(box.w, minBoxMm), width)
  const h = Math.min(Math.max(box.h, 0.1), height)
  return {
    x: Math.min(Math.max(box.x, 0), width - w),
    y: Math.min(Math.max(box.y, 0), height - h),
    w,
    h,
  }
}

export function withBox(element: LabelElement, box: Box): LabelElement {
  return {
    ...element,
    xMm: mmText(box.x),
    yMm: mmText(box.y),
    widthMm: mmText(box.w),
    heightMm: mmText(box.h),
  }
}

const baseStyle: LabelTextStyle = {
  font: "SANS",
  fontSizePt: 9,
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  align: "START",
  verticalAlign: "TOP",
  fit: true,
  inverted: false,
}

const priceStyle: LabelTextStyle = {
  ...baseStyle,
  fontSizePt: 18,
  bold: true,
  align: "END",
  verticalAlign: "MIDDLE",
}

/** A new element of a kind, at trade4's defaults, kept inside the label. */
export function newElement(
  kind: ElementKind,
  width: number,
  height: number,
  text: string,
  image = ""
): LabelElement {
  const box = (x: number, y: number, w: number, h: number) =>
    fitInside({ x, y, w: Math.min(w, width - 4), h }, width, height)
  const at = (b: Box) => ({
    xMm: mmText(b.x),
    yMm: mmText(b.y),
    widthMm: mmText(b.w),
    heightMm: mmText(b.h),
  })
  switch (kind) {
    case "TEXT":
      return { type: "TEXT", text, style: baseStyle, ...at(box(2, 2, 30, 6)) }
    case "PRICE":
      return {
        type: "PRICE",
        priceTypeId: null,
        split: true,
        currency: true,
        style: priceStyle,
        ...at(box(2, 2, 30, 10)),
      }
    case "BARCODE":
      return { type: "BARCODE", digits: true, ...at(box(2, 2, 40, 12)) }
    case "FRAME":
      return {
        type: "SHAPE",
        borderMm: "0.30",
        filled: false,
        ...at({ x: 0, y: 0, w: width, h: height }),
      }
    case "LINE":
      return {
        type: "SHAPE",
        borderMm: "0.00",
        filled: true,
        ...at(box(2, snap(height / 2), width - 4, 0.3)),
      }
    case "IMAGE":
      return { type: "IMAGE", src: image, ...at(box(2, 2, 20, 10)) }
  }
}

export type PresetName = "standard" | "sale" | "price" | "empty"
export const presetNames: readonly PresetName[] = [
  "standard",
  "sale",
  "price",
  "empty",
]

/**
 * trade4's presets: rows sharing the label's height inside a small margin, a price size from the height. `saleText`
 * is the banner's word in the screen's language; `oldPriceTypeId` is the type crossed out on a sale label.
 */
export function presetLayout(
  name: PresetName,
  width: number,
  height: number,
  texts: { sale: string },
  oldPriceTypeId: string | null
): LabelLayout {
  const pad = Math.min(1.5, width * 0.04)
  const round = (value: number) => Math.round(value * 10) / 10
  const priceSize = Math.min(Math.max(Math.round(height * 0.55), 12), 36)
  const rows = (shares: number[]) => {
    const inner = height - 2 * pad
    let y = pad
    return shares.map((share) => {
      const h = round(inner * share)
      const row = { x: pad, y: round(y), w: round(width - 2 * pad), h }
      y += h
      return fitInside(row, width, height)
    })
  }
  const text = (b: Box, value: string, style: Partial<LabelTextStyle>) =>
    withBox(
      {
        type: "TEXT",
        text: value,
        style: { ...baseStyle, ...style },
        xMm: "",
        yMm: "",
        widthMm: "",
        heightMm: "",
      },
      b
    )
  const price = (
    b: Box,
    fontSizePt: number,
    extra: Partial<Extract<LabelElement, { type: "PRICE" }>> = {},
    style: Partial<LabelTextStyle> = {}
  ) =>
    withBox(
      {
        type: "PRICE",
        priceTypeId: null,
        split: true,
        currency: true,
        style: { ...priceStyle, fontSizePt, ...style },
        xMm: "",
        yMm: "",
        widthMm: "",
        heightMm: "",
        ...extra,
      },
      b
    )
  const barcode = (b: Box, digits: boolean) =>
    withBox(
      { type: "BARCODE", digits, xMm: "", yMm: "", widthMm: "", heightMm: "" },
      b
    )

  let elements: LabelElement[] = []
  if (name === "standard") {
    const [n, p, b] = rows([0.3, 0.33, 0.37])
    if (n && p && b)
      elements = [
        text(n, "{name}", { bold: true }),
        price(p, priceSize),
        barcode(b, true),
      ]
  } else if (name === "sale") {
    const [banner, n, old, p, b] = rows([0.16, 0.2, 0.14, 0.24, 0.26])
    if (banner && n && old && p && b)
      elements = [
        text(banner, texts.sale, {
          bold: true,
          align: "CENTER",
          verticalAlign: "MIDDLE",
          inverted: true,
        }),
        text(n, "{name}", {}),
        price(
          old,
          Math.max(Math.round(priceSize * 0.45), limits.minFontPt),
          { priceTypeId: oldPriceTypeId, split: false },
          { strike: true }
        ),
        price(p, priceSize),
        barcode(b, true),
      ]
  } else if (name === "price") {
    const [p, b, c] = rows([0.45, 0.4, 0.15])
    if (p && b && c)
      elements = [
        price(
          p,
          Math.min(Math.round(priceSize * 1.2), limits.maxFontPt),
          {},
          { align: "CENTER" }
        ),
        barcode(b, false),
        text(c, "{code}  {date}", { fontSizePt: 6, align: "CENTER" }),
      ]
  }
  return { widthMm: mmText(width), heightMm: mmText(height), elements }
}

/** A new size for the label: elements shrink or move back inside it. */
export function resizeLabel(
  draft: Draft,
  width: number,
  height: number
): Draft {
  return {
    widthMm: mmText(width),
    heightMm: mmText(height),
    items: draft.items.map((item) => ({
      ...item,
      element: withBox(
        item.element,
        fitInside(boxOf(item.element), width, height)
      ),
    })),
  }
}

/** What the server would refuse, by element key ("" for the label itself): checked before saving and test printing. */
export function draftErrors(draft: Draft): Map<string, FieldCode> {
  const errors = new Map<string, FieldCode>()
  const width = mm(draft.widthMm)
  const height = mm(draft.heightMm)
  if (
    [width, height].some(
      (side) => !(side >= limits.minSizeMm && side <= limits.maxSizeMm)
    )
  )
    errors.set("", "OUT_OF_RANGE")
  for (const { key, element } of draft.items) {
    const b = boxOf(element)
    if (b.x + b.w > width + 0.001 || b.y + b.h > height + 0.001)
      errors.set(key, "OUT_OF_RANGE")
    if (element.type === "TEXT") {
      if (element.text.trim() === "") errors.set(key, "REQUIRED")
      else if (
        element.text.length > limits.textMaxLength ||
        unknownVariables(element.text).length > 0
      )
        errors.set(key, "INVALID_VALUE")
    }
    if (
      element.type === "SHAPE" &&
      mm(element.borderMm) <= 0 &&
      !element.filled
    )
      errors.set(key, "INVALID_VALUE")
    if (element.type === "IMAGE" && element.src === "")
      errors.set(key, "REQUIRED")
  }
  return errors
}
