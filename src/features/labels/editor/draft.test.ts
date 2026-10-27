import { describe, expect, it } from "vitest"

import { mm } from "../mm"
import {
  boxOf,
  draftErrors,
  draftOf,
  fitInside,
  labelSizes,
  layoutOf,
  newElement,
  presetLayout,
  presetNames,
  resizeLabel,
  snap,
  type Draft,
} from "./draft"
import { applyAction, canAdd } from "./items"

const inside = (draft: Draft) =>
  draft.items.every(({ element }) => {
    const b = boxOf(element)
    return (
      b.x >= 0 &&
      b.y >= 0 &&
      b.x + b.w <= mm(draft.widthMm) + 0.001 &&
      b.y + b.h <= mm(draft.heightMm) + 0.001
    )
  })

describe("boxes", () => {
  it("snaps to half a millimetre", () => {
    expect(snap(12.26)).toBe(12.5)
    expect(snap(12.24)).toBe(12)
  })

  it("keeps a box inside the label, shrinking it when it is bigger", () => {
    expect(fitInside({ x: 50, y: -3, w: 20, h: 5 }, 58, 40)).toEqual({
      x: 38,
      y: 0,
      w: 20,
      h: 5,
    })
    expect(fitInside({ x: 0, y: 0, w: 80, h: 5 }, 58, 40).w).toBe(58)
  })
})

describe("presets", () => {
  it("fit every roll size and pass the server's checks", () => {
    for (const [width, height] of labelSizes)
      for (const name of presetNames) {
        const draft = draftOf(
          presetLayout(name, width, height, { sale: "СКИДКА!" }, "old")
        )
        expect(
          inside(draft),
          `${name} ${String(width)}×${String(height)}`
        ).toBe(true)
        expect(
          draftErrors(draft).size,
          `${name} ${String(width)}×${String(height)}`
        ).toBe(0)
      }
  })

  it("crosses out the old price type on a sale label", () => {
    const old = presetLayout(
      "sale",
      58,
      40,
      { sale: "СКИДКА!" },
      "old"
    ).elements.find(
      (element) => element.type === "PRICE" && element.priceTypeId === "old"
    )
    expect(old?.type === "PRICE" && old.style.strike).toBe(true)
  })
})

describe("the draft", () => {
  const draft = draftOf(presetLayout("standard", 58, 40, { sale: "" }, null))

  it("gives back the layout it was made of", () => {
    expect(layoutOf(draft)).toEqual(
      presetLayout("standard", 58, 40, { sale: "" }, null)
    )
  })

  it("moves and shrinks the elements into a smaller label", () => {
    const smaller = resizeLabel(draft, 30, 20)
    expect(smaller.widthMm).toBe("30.00")
    expect(inside(smaller)).toBe(true)
  })

  it("finds what the server would refuse, by element", () => {
    const text = newElement("TEXT", 58, 40, "{article}")
    const shape = newElement("LINE", 58, 40, "")
    if (text.type !== "TEXT" || shape.type !== "SHAPE")
      throw new Error("Unexpected element kinds.")
    // A line with no border and no fill draws nothing.
    const line = { ...shape, filled: false }
    const bad: Draft = {
      widthMm: "130.00",
      heightMm: "40.00",
      items: [
        { key: "t", element: text },
        { key: "l", element: line },
        { key: "e", element: { ...text, text: "  " } },
      ],
    }
    expect(Object.fromEntries(draftErrors(bad))).toEqual({
      "": "OUT_OF_RANGE",
      t: "INVALID_VALUE",
      l: "INVALID_VALUE",
      e: "REQUIRED",
    })
  })
})

describe("element actions", () => {
  const draft = draftOf(presetLayout("standard", 58, 40, { sale: "" }, null))
  const keys = (d: Draft) => d.items.map((item) => item.key)
  const [name, price, barcode] = keys(draft) as [string, string, string]

  it("reorders in drawing order: the last one is on top", () => {
    expect(keys(applyAction(draft, name, "front").draft)).toEqual([
      price,
      barcode,
      name,
    ])
    expect(keys(applyAction(draft, barcode, "back").draft)).toEqual([
      barcode,
      name,
      price,
    ])
    expect(keys(applyAction(draft, name, "forward").draft)).toEqual([
      price,
      name,
      barcode,
    ])
  })

  it("duplicates next to the original, a little lower and to the right, and selects the copy", () => {
    const result = applyAction(draft, price, "duplicate")
    expect(result.draft.items).toHaveLength(4)
    const copy = result.draft.items[2]
    expect(copy?.key).toBe(result.selected)
    const original = boxOf(
      draft.items[1]?.element ?? newElement("TEXT", 58, 40, "")
    )
    expect(
      boxOf(copy?.element ?? newElement("TEXT", 58, 40, "")).y
    ).toBeGreaterThan(original.y)
  })

  it("selects the next element after a delete", () => {
    const result = applyAction(draft, name, "delete")
    expect(keys(result.draft)).toEqual([price, barcode])
    expect(result.selected).toBe(price)
  })

  it("centres an element across the label", () => {
    const centred = applyAction(draft, barcode, "centerX").draft.items[2]
      ?.element
    const b = boxOf(centred ?? newElement("TEXT", 58, 40, ""))
    expect(b.x + b.w / 2).toBeCloseTo(29)
  })

  it("allows no more than 40 elements and 3 images", () => {
    const image = newElement("IMAGE", 58, 40, "", "data:image/png;base64,AA==")
    const images: Draft = {
      ...draft,
      items: [1, 2, 3].map((i) => ({ key: `i${String(i)}`, element: image })),
    }
    expect(canAdd(images, true)).toBe(false)
    expect(canAdd(images, false)).toBe(true)
  })
})
