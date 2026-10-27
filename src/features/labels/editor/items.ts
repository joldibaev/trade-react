import type { Messages } from "@/i18n/messages/ru"

import type { LabelElement } from "../templates-api"
import { mm } from "../mm"
import { boxOf, fitInside, limits, newKey, withBox, type Draft } from "./draft"

export const itemActions = [
  "duplicate",
  "front",
  "forward",
  "backward",
  "back",
  "centerX",
  "centerY",
  "delete",
] as const

export type ItemAction = (typeof itemActions)[number]

/** "Текст: {name}", "Цена", …: how the layers list and screen readers name an element. */
export function itemTitle(t: Messages, element: LabelElement, index: number) {
  const kind =
    element.type === "SHAPE"
      ? mm(element.borderMm) > 0 && !element.filled
        ? t.labelEditor.kinds.FRAME
        : t.labelEditor.kinds.LINE
      : t.labelEditor.kinds[element.type]
  const detail = element.type === "TEXT" ? `: ${element.text.slice(0, 40)}` : ""
  return `${String(index + 1)}. ${kind}${detail}`
}

const imagesIn = (draft: Draft) =>
  draft.items.filter((item) => item.element.type === "IMAGE").length

/** Whether one more element of this kind may go on the label (40 elements, 3 images). */
export function canAdd(draft: Draft, image: boolean) {
  return (
    draft.items.length < limits.maxElements &&
    (!image || imagesIn(draft) < limits.maxImages)
  )
}

/**
 * An action on the element `key`: the new draft and the element selected after it. The order is the drawing order,
 * so "to the front" is the end of the list.
 */
export function applyAction(
  draft: Draft,
  key: string,
  action: ItemAction
): { draft: Draft; selected: string | null } {
  const index = draft.items.findIndex((item) => item.key === key)
  const item = draft.items[index]
  if (!item) return { draft, selected: null }
  const width = mm(draft.widthMm)
  const height = mm(draft.heightMm)
  const others = draft.items.filter((other) => other.key !== key)
  const at = (position: number) => {
    const items = [...others]
    items.splice(Math.max(0, Math.min(position, items.length)), 0, item)
    return { draft: { ...draft, items }, selected: key }
  }
  const moved = (box: ReturnType<typeof boxOf>) => ({
    draft: {
      ...draft,
      items: draft.items.map((other) =>
        other.key === key
          ? { ...other, element: withBox(other.element, box) }
          : other
      ),
    },
    selected: key,
  })
  const box = boxOf(item.element)
  switch (action) {
    case "duplicate": {
      if (!canAdd(draft, item.element.type === "IMAGE"))
        return { draft, selected: key }
      const copy = {
        key: newKey(),
        element: withBox(
          item.element,
          fitInside({ ...box, x: box.x + 2, y: box.y + 2 }, width, height)
        ),
      }
      const items = [...draft.items]
      items.splice(index + 1, 0, copy)
      return { draft: { ...draft, items }, selected: copy.key }
    }
    case "front":
      return at(others.length)
    case "forward":
      return at(index + 1)
    case "backward":
      return at(index - 1)
    case "back":
      return at(0)
    case "centerX":
      return moved({ ...box, x: (width - box.w) / 2 })
    case "centerY":
      return moved({ ...box, y: (height - box.h) / 2 })
    case "delete": {
      // The next element in the drawing order is selected, so several can be deleted one after another.
      const next = others[Math.min(index, others.length - 1)]
      return { draft: { ...draft, items: others }, selected: next?.key ?? null }
    }
  }
}
