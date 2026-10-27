import { CircleAlertIcon } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { useT } from "@/i18n/i18n"

import type { LabelWarning } from "./label"
import type { LabelData } from "./label-data"
import { mm } from "./mm"
import { drawLabels, labelDocument } from "./print-frame"
import type { LabelLayout } from "./templates-api"

const pxPerMm = 96 / 25.4

/**
 * Draws a label in its own frame, exactly as it prints, magnified by `zoom`, and reports the warnings: what the
 * preview, the editor's canvas and the printer all share.
 */
export function useLabelFrame(
  layout: LabelLayout | null,
  data: LabelData | null,
  zoom: number
) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [warnings, setWarnings] = useState<LabelWarning[]>([])

  const draw = useCallback(() => {
    const target = frame.current?.contentDocument
    if (!target) return
    target.documentElement.style.zoom = String(zoom)
    // The frame is sized to the label; rounding must not add scroll bars over it.
    target.documentElement.style.overflow = "hidden"
    const next = layout && data ? drawLabels(target, layout, [data]) : []
    // Callers build `layout` and `data` per render; an unchanged list keeps its identity, or the redraw never ends.
    setWarnings((current) => (current.join() === next.join() ? current : next))
  }, [layout, data, zoom])

  useEffect(() => {
    if (loaded) draw()
  }, [loaded, draw])

  return {
    warnings,
    frameProps: {
      ref: frame,
      srcDoc: labelDocument,
      onLoad: () => {
        setLoaded(true)
      },
      style: layout
        ? {
            width: mm(layout.widthMm) * pxPerMm * zoom,
            height: mm(layout.heightMm) * pxPerMm * zoom,
          }
        : { width: 0, height: 0 },
    },
  }
}

/** Says what will not print as drawn: a clipped text, a barcode that prints as digits only. */
export function LabelWarnings({ warnings }: { warnings: LabelWarning[] }) {
  const t = useT()
  return warnings.map((warning) => (
    <Alert key={warning}>
      <CircleAlertIcon aria-hidden />
      <AlertDescription>{t.labels.warnings[warning]}</AlertDescription>
    </Alert>
  ))
}

/** A label exactly as it will print, magnified, with its warnings before labels are spent. */
export function LabelPreview({
  layout,
  data,
}: {
  layout: LabelLayout | null
  data: LabelData | null
}) {
  const t = useT()
  const zoom = layout && mm(layout.widthMm) > 60 ? 1 : 1.5
  const { warnings, frameProps } = useLabelFrame(layout, data, zoom)
  return (
    <div className="flex flex-col gap-2">
      <iframe
        {...frameProps}
        title={t.labels.preview}
        className="box-content max-w-full self-start rounded-md border bg-white"
      />
      <LabelWarnings warnings={warnings} />
    </div>
  )
}
