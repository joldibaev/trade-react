import { limits } from "./draft"

export type ImageResult =
  | { ok: true; src: string }
  | { ok: false; reason: "type" | "tooBig" | "unreadable" | "broken" }

const asDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      // readAsDataURL always yields a string.
      if (typeof reader.result === "string") resolve(reader.result)
      else reject(new Error("The image could not be read."))
    }
    reader.onerror = () => {
      reject(new Error("The image could not be read."))
    }
    reader.readAsDataURL(file)
  })

/** TradeNet checks only the type, size and file signature, so a damaged file with a valid header must fail here. */
async function decodes(src: string): Promise<boolean> {
  const image = new Image()
  image.src = src
  try {
    await image.decode()
    return true
  } catch {
    return false
  }
}

/**
 * A logo for a label, kept in the template as a data URL of at most 48,000 characters (TradeNet `LabelLimits`). A
 * bigger picture is drawn smaller, halving its size up to five times, rather than refused outright: a label printer
 * has 8 dots per millimetre, so a 200-pixel logo is already 25 mm wide.
 */
export async function readImage(file: File): Promise<ImageResult> {
  if (file.type !== "image/png" && file.type !== "image/jpeg")
    return { ok: false, reason: "type" }
  let src: string
  try {
    src = await asDataUrl(file)
  } catch {
    return { ok: false, reason: "unreadable" }
  }
  if (src.length <= limits.imageMaxLength)
    return (await decodes(src))
      ? { ok: true, src }
      : { ok: false, reason: "broken" }
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return { ok: false, reason: "broken" }
  }
  let width = bitmap.width
  let height = bitmap.height
  for (let attempt = 0; attempt < 5; attempt++) {
    width = Math.max(1, Math.round(width / 2))
    height = Math.max(1, Math.round(height / 2))
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext("2d")
    if (!context) break
    // White under a transparent logo: a thermal printer prints black on white anyway.
    context.fillStyle = "white"
    context.fillRect(0, 0, width, height)
    context.drawImage(bitmap, 0, 0, width, height)
    const smaller = canvas.toDataURL(file.type)
    if (smaller.length <= limits.imageMaxLength)
      return { ok: true, src: smaller }
  }
  return { ok: false, reason: "tooBig" }
}
