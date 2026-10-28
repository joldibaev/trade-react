import { useCallback, useEffect, useRef, useState } from "react"

import type { ReceiptData, ReceiptTexts } from "../receipt/data"
import type { ReceiptLayout } from "../receipt/layout"
import {
  drawReceipt,
  receiptDocument,
  type ReceiptIssue,
} from "../receipt/render"

const pxPerMm = 96 / 25.4

/**
 * Draws the receipt in its own frame, the whole roll as the paper comes out, exactly as it prints (the same
 * drawing, in a page without the app's styles), and reports what will not print as drawn. The frame grows with the
 * receipt. `layout`, `data` and `texts` must keep their identity between renders, or the frame redraws forever.
 */
export function useReceiptFrame(
  layout: ReceiptLayout,
  data: ReceiptData,
  texts: ReceiptTexts
) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [issues, setIssues] = useState<ReceiptIssue[]>([])
  const [height, setHeight] = useState(0)

  const draw = useCallback(() => {
    const target = frame.current?.contentDocument
    if (!target) return undefined
    // The frame is sized to the receipt; rounding must not add scroll bars over it.
    target.documentElement.style.overflow = "hidden"
    const drawn = drawReceipt(target, layout, data, texts, { roll: true })
    target.body.replaceChildren(drawn.root)
    setIssues((current) =>
      JSON.stringify(current) === JSON.stringify(drawn.issues)
        ? current
        : drawn.issues
    )
    // A picture arrives after the drawing and changes the receipt's height: measure again when each one has loaded.
    const measure = () => {
      setHeight(Math.ceil(drawn.root.getBoundingClientRect().height))
    }
    measure()
    const images = [...drawn.root.querySelectorAll("img")]
    for (const image of images) {
      image.addEventListener("load", measure)
      image.addEventListener("error", measure)
    }
    return () => {
      for (const image of images) {
        image.removeEventListener("load", measure)
        image.removeEventListener("error", measure)
      }
    }
  }, [layout, data, texts])

  useEffect(() => {
    if (loaded) return draw()
    return undefined
  }, [loaded, draw])

  return {
    issues,
    frameProps: {
      ref: frame,
      srcDoc: receiptDocument,
      onLoad: () => {
        setLoaded(true)
      },
      style: {
        width: layout.paperWidthMm * pxPerMm,
        height,
      },
    },
  }
}
