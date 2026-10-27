import { useEffect, useRef, useState, type PointerEvent } from "react"
import { cn } from "cn"

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { useT } from "@/i18n/i18n"

import type { LabelData } from "../label-data"
import { LabelWarnings, useLabelFrame } from "../label-preview"
import { mm } from "../mm"
import {
  boxOf,
  fitInside,
  layoutOf,
  snap,
  withBox,
  type Box,
  type Draft,
  type DraftItem,
} from "./draft"
import { itemTitle, type ItemAction } from "./items"

const pxPerMm = 96 / 25.4
/** Guides catch a line within this many screen pixels, whatever the zoom. */
const guidePx = 6
/** A press that moves less than this is a click, not a drag. */
const clickSlopPx = 3

type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w"
const handles: readonly Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"]

const handlePosition: Record<Handle, string> = {
  nw: "-left-1.5 -top-1.5 cursor-nwse-resize",
  n: "left-1/2 -top-1.5 -translate-x-1/2 cursor-ns-resize",
  ne: "-right-1.5 -top-1.5 cursor-nesw-resize",
  e: "-right-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize",
  se: "-right-1.5 -bottom-1.5 cursor-nwse-resize",
  s: "left-1/2 -bottom-1.5 -translate-x-1/2 cursor-ns-resize",
  sw: "-left-1.5 -bottom-1.5 cursor-nesw-resize",
  w: "-left-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize",
}

/** Moves a box so one of its three lines meets the nearest target within `threshold` mm; returns the lines met. */
function snapToGuides(
  box: Box,
  others: readonly Box[],
  width: number,
  height: number,
  threshold: number
) {
  const along = (
    start: number,
    size: number,
    targets: number[]
  ): { shift: number; line: number | null } => {
    let best = { shift: 0, line: null as number | null, distance: threshold }
    for (const point of [start, start + size / 2, start + size])
      for (const target of targets) {
        const distance = Math.abs(target - point)
        if (distance < best.distance)
          best = { shift: target - point, line: target, distance }
      }
    return best
  }
  const xs = [
    0,
    width / 2,
    width,
    ...others.flatMap((o) => [o.x, o.x + o.w / 2, o.x + o.w]),
  ]
  const ys = [
    0,
    height / 2,
    height,
    ...others.flatMap((o) => [o.y, o.y + o.h / 2, o.y + o.h]),
  ]
  const x = along(box.x, box.w, xs)
  const y = along(box.y, box.h, ys)
  return {
    box: { ...box, x: box.x + x.shift, y: box.y + y.shift },
    vertical: x.line,
    horizontal: y.line,
  }
}

type Gesture = {
  key: string
  handle: Handle | null
  start: { x: number; y: number }
  box: Box
  moved: boolean
  step: string
}

let gestures = 0

/**
 * The label drawn as it prints (the same drawing, in a frame), with a layer over it to select, drag and resize the
 * elements. Moves and sizes snap to 0.5 mm; a single moved element also snaps to the label's edges and centre and to
 * the other elements, with guide lines shown while dragging.
 */
export function EditorCanvas({
  draft,
  data,
  selected,
  onSelect,
  onChange,
  onAction,
  invalid,
}: {
  draft: Draft
  data: LabelData
  selected: string | null
  onSelect: (key: string | null) => void
  onChange: (draft: Draft, step: string) => void
  onAction: (action: ItemAction) => void
  invalid: ReadonlySet<string>
}) {
  const t = useT()
  const wrapper = useRef<HTMLDivElement>(null)
  const [available, setAvailable] = useState(600)
  // A ref, not state: a move that arrives after the release, before React renders again, must already see no gesture.
  const gestureRef = useRef<Gesture | null>(null)
  const [guides, setGuides] = useState<{ v: number | null; h: number | null }>({
    v: null,
    h: null,
  })
  const width = mm(draft.widthMm)
  const height = mm(draft.heightMm)
  const scale = Math.min(Math.max(available / width, 3), 12)
  const { warnings, frameProps } = useLabelFrame(
    layoutOf(draft),
    data,
    scale / pxPerMm
  )

  useEffect(() => {
    const element = wrapper.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      // The padded box the label sits in: its content width is what the label may take.
      if (entry) setAvailable(entry.contentRect.width)
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, [])

  const begin = (
    event: PointerEvent<HTMLElement>,
    item: DraftItem,
    handle: Handle | null
  ) => {
    if (event.button !== 0) return
    event.stopPropagation()
    onSelect(item.key)
    event.currentTarget.setPointerCapture(event.pointerId)
    gestureRef.current = {
      key: item.key,
      handle,
      start: { x: event.clientX, y: event.clientY },
      box: boxOf(item.element),
      moved: false,
      step: `${handle ? "resize" : "move"}:${String(gestures++)}`,
    }
  }

  const move = (event: PointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current
    if (!gesture) return
    const dxPx = event.clientX - gesture.start.x
    const dyPx = event.clientY - gesture.start.y
    if (!gesture.moved && Math.hypot(dxPx, dyPx) < clickSlopPx) return
    gesture.moved = true
    const dx = dxPx / scale
    const dy = dyPx / scale
    const b = gesture.box
    let next: Box
    let lines: { v: number | null; h: number | null } = { v: null, h: null }
    if (gesture.handle === null) {
      const moved = fitInside(
        { ...b, x: snap(b.x + dx), y: snap(b.y + dy) },
        width,
        height
      )
      const others = draft.items
        .filter((item) => item.key !== gesture.key)
        .map((item) => boxOf(item.element))
      const snapped = snapToGuides(
        moved,
        others,
        width,
        height,
        guidePx / scale
      )
      next = fitInside(snapped.box, width, height)
      lines = { v: snapped.vertical, h: snapped.horizontal }
    } else {
      const h = gesture.handle
      let { x, y, w, h: hh } = b
      // A west or north handle keeps the opposite side where it was.
      if (h.includes("e")) w = snap(b.w + dx)
      if (h.includes("s")) hh = snap(b.h + dy)
      if (h.includes("w")) {
        x = snap(b.x + dx)
        w = b.x + b.w - x
      }
      if (h.includes("n")) {
        y = snap(b.y + dy)
        hh = b.y + b.h - y
      }
      next = fitInside(
        { x, y, w: Math.max(w, 0.5), h: Math.max(hh, 0.5) },
        width,
        height
      )
    }
    setGuides(lines)
    onChange(
      {
        ...draft,
        items: draft.items.map((item) =>
          item.key === gesture.key
            ? { ...item, element: withBox(item.element, next) }
            : item
        ),
      },
      gesture.step
    )
  }

  const end = () => {
    gestureRef.current = null
    setGuides({ v: null, h: null })
  }

  const px = (value: number) => `${String(value * scale)}px`

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div
        ref={wrapper}
        className="max-w-full overflow-auto rounded-md border bg-muted/40 p-3"
      >
        <ContextMenu>
          <ContextMenuTrigger
            className="relative mx-auto block w-fit"
            onPointerDown={(event) => {
              if (event.button === 0) onSelect(null)
            }}
          >
            <iframe
              {...frameProps}
              title={t.labels.preview}
              tabIndex={-1}
              className="pointer-events-none block bg-white shadow-sm"
            />
            {draft.items.map((item, index) => {
              const b = boxOf(item.element)
              const isSelected = item.key === selected
              return (
                <div
                  key={item.key}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  aria-label={itemTitle(t, item.element, index)}
                  className={cn(
                    "absolute cursor-move outline-1 -outline-offset-1 outline-transparent hover:outline-primary/60 focus-visible:outline-2 focus-visible:outline-ring",
                    isSelected && "outline-2 outline-primary",
                    invalid.has(item.key) && "outline-2 outline-destructive"
                  )}
                  style={{
                    left: px(b.x),
                    top: px(b.y),
                    width: px(b.w),
                    height: px(b.h),
                    // A hairline element (a 0.3 mm line) stays easy to grab.
                    minHeight: 6,
                    minWidth: 6,
                  }}
                  onPointerDown={(event) => {
                    begin(event, item, null)
                  }}
                  onPointerMove={move}
                  onPointerUp={end}
                  onPointerCancel={end}
                  onContextMenu={() => {
                    onSelect(item.key)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      onSelect(item.key)
                    }
                  }}
                >
                  {isSelected &&
                    handles.map((handle) => (
                      <span
                        key={handle}
                        aria-hidden
                        className={cn(
                          "absolute size-3 rounded-sm border border-primary bg-background",
                          handlePosition[handle]
                        )}
                        onPointerDown={(event) => {
                          begin(event, item, handle)
                        }}
                        onPointerMove={move}
                        onPointerUp={end}
                        onPointerCancel={end}
                      />
                    ))}
                </div>
              )
            })}
            {guides.v !== null && (
              <span
                aria-hidden
                className="pointer-events-none absolute top-0 bottom-0 w-px bg-sky-500"
                style={{ left: px(guides.v) }}
              />
            )}
            {guides.h !== null && (
              <span
                aria-hidden
                className="pointer-events-none absolute right-0 left-0 h-px bg-sky-500"
                style={{ top: px(guides.h) }}
              />
            )}
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ElementMenu
              selected={selected}
              draft={draft}
              onAction={onAction}
            />
          </ContextMenuContent>
        </ContextMenu>
      </div>
      <LabelWarnings warnings={warnings} />
    </div>
  )
}

/** The canvas's right-click menu: what the layers panel offers, next to the element. */
function ElementMenu({
  selected,
  draft,
  onAction,
}: {
  selected: string | null
  draft: Draft
  onAction: (action: ItemAction) => void
}) {
  const t = useT()
  const index = draft.items.findIndex((item) => item.key === selected)
  const last = draft.items.length - 1
  const item = (action: ItemAction, disabled = false) => (
    <ContextMenuItem
      disabled={selected === null || disabled}
      variant={action === "delete" ? "destructive" : "default"}
      onClick={() => {
        onAction(action)
      }}
    >
      {t.labelEditor.actions[action]}
    </ContextMenuItem>
  )
  return (
    <>
      {item("duplicate")}
      <ContextMenuSeparator />
      {item("front", index === last)}
      {item("forward", index === last)}
      {item("backward", index === 0)}
      {item("back", index === 0)}
      <ContextMenuSeparator />
      {item("centerX")}
      {item("centerY")}
      <ContextMenuSeparator />
      {item("delete")}
    </>
  )
}
