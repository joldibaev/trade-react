import {
  drawLabel,
  fitLabelText,
  labelPageStyles,
  labelWarnings,
  type LabelWarning,
} from "./label"
import { printInFrame } from "@/features/printing/print-frame"

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
 * Prints labels through the browser's print dialog, where the person picks the label printer: one label per page, the
 * page size from the driver.
 */
export function printLabels(
  layout: LabelLayout,
  labels: readonly LabelData[]
): Promise<void> {
  return printInFrame(labelDocument, (target) => {
    drawLabels(target, layout, labels)
  })
}
