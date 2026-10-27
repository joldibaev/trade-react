import {
  drawLabel,
  fitLabelText,
  labelPageStyles,
  labelWarnings,
  type LabelWarning,
} from "./label"
import type { LabelData } from "./label-data"
import type { LabelLayout } from "./templates-api"

/** The empty page labels are drawn into, for the printer and for the preview alike. */
export const labelDocument = `<!doctype html><html><head><meta charset="utf-8"><title>Cosmos</title><style>${labelPageStyles}</style></head><body></body></html>`

/**
 * Draws the labels into `target`'s body, fits their texts, and returns what the preview must warn about (the same
 * for every printed copy of a label, so each kind of warning once).
 */
export function drawLabels(
  target: Document,
  layout: LabelLayout,
  labels: readonly LabelData[]
): LabelWarning[] {
  target.body.replaceChildren()
  const warnings = new Set<LabelWarning>()
  for (const data of labels) {
    const label = drawLabel(target, layout, data)
    target.body.append(label)
    fitLabelText(label)
    for (const warning of labelWarnings(label)) warnings.add(warning)
  }
  return [...warnings]
}

/**
 * Prints labels through the browser's print dialog, where the person picks the label printer. They are drawn into a
 * hidden frame, so the app around them does not print; one label per page, the page size from the driver.
 * Resolves once the dialog was opened: the browser cannot tell whether paper came out.
 */
export function printLabels(
  layout: LabelLayout,
  labels: readonly LabelData[]
): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe")
    frame.setAttribute("aria-hidden", "true")
    frame.tabIndex = -1
    Object.assign(frame.style, {
      position: "fixed",
      width: "0",
      height: "0",
      border: "0",
    })
    frame.srcdoc = labelDocument
    const prepare = async () => {
      const target = frame.contentDocument
      const view = frame.contentWindow
      if (target === null || view === null) {
        frame.remove()
        reject(new Error("The print frame is unavailable."))
        return
      }
      try {
        drawLabels(target, layout, labels)
        // Drawn after the frame's load event, so print() itself would not wait for them; a broken logo stops the job.
        await target.fonts.ready
        await Promise.all([...target.images].map((image) => image.decode()))
        view.addEventListener(
          "afterprint",
          () => {
            frame.remove()
          },
          { once: true }
        )
        view.print()
        resolve()
      } catch (error) {
        frame.remove()
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    }
    frame.addEventListener(
      "load",
      () => {
        void prepare()
      },
      { once: true }
    )
    document.body.append(frame)
  })
}
