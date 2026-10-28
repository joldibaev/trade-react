import { printInFrame } from "@/features/printing/print-frame"

import type { ReceiptData, ReceiptTexts } from "./data"
import type { ReceiptLayout } from "./layout"
import { drawReceipt, receiptDocument, type ReceiptIssue } from "./render"

/** A print job that would give a receipt nobody can scan: it stops before paper is spent. */
export class ReceiptQrError extends Error {
  readonly kind: "qrTooLong" | "qrTooSmall"
  /** Which QR code, counting the QR blocks of the template from 1. */
  readonly qrNumber: number

  constructor(kind: "qrTooLong" | "qrTooSmall", qrNumber: number) {
    super(
      `QR code ${String(qrNumber)} of the receipt cannot be printed (${kind}).`
    )
    this.name = "ReceiptQrError"
    this.kind = kind
    this.qrNumber = qrNumber
  }
}

/** The place of the QR block at `index` among the template's QR blocks, from 1. */
export function qrNumber(layout: ReceiptLayout, index: number): number {
  return layout.blocks.slice(0, index + 1).filter((b) => b.type === "QR").length
}

/** The issue that stops a print job, if there is one. */
export function blockingIssue(
  issues: readonly ReceiptIssue[]
): ReceiptIssue | undefined {
  return issues.find((issue) => issue.kind !== "barcodeDigitsOnly")
}

/**
 * Prints one receipt through the browser's print dialog, where the person picks the receipt printer; the paper comes
 * from the driver (docs/printing.md). Rejects with `ReceiptQrError` when a QR code of the receipt does not fit or would
 * be too small to scan.
 */
export function printReceipt(
  layout: ReceiptLayout,
  data: ReceiptData,
  texts: ReceiptTexts
): Promise<void> {
  return printInFrame(receiptDocument, (target) => {
    const { root, issues } = drawReceipt(target, layout, data, texts)
    const blocking = blockingIssue(issues)
    if (blocking?.kind === "qrTooLong" || blocking?.kind === "qrTooSmall")
      throw new ReceiptQrError(blocking.kind, qrNumber(layout, blocking.index))
    target.body.replaceChildren(root)
  })
}
