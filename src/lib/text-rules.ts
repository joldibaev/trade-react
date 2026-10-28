import type { FieldCode } from "@/api/errors"

/**
 * TradeNet's `TextAttribute`, rule for rule, so a form refuses what the server refuses and nothing more: no control or
 * format characters, no space at either end (a line break inside is allowed only in a multiline text), counted after
 * Unicode NFC (a pasted "й" in two code points is one character).
 */
const singleLine = /^[^\p{Cc}\p{Cf}\s]([^\p{Cc}\p{Cf}]*[^\p{Cc}\p{Cf}\s])?$/u
const multiLine =
  /^[^\p{Cc}\p{Cf}\s](([^\p{Cc}\p{Cf}]|\n)*[^\p{Cc}\p{Cf}\s])?$/u

/** The length the server measures: characters of the NFC form. */
export function textLength(value: string): number {
  return value.normalize("NFC").length
}

/** The code TradeNet would answer for this text, or nothing. Empty (or only spaces) is `REQUIRED`. */
export function textError(
  value: string,
  options: { max: number; multiline?: boolean }
): FieldCode | undefined {
  if (value.trim() === "") return "REQUIRED"
  const text = value.normalize("NFC")
  if (text.length > options.max) return "OUT_OF_RANGE"
  return (options.multiline ? multiLine : singleLine).test(text)
    ? undefined
    : "INVALID_FORMAT"
}

/** A client validator for a name of up to 100 characters (stores, payment methods, templates): sent trimmed. */
export function nameError({ value }: { value: string }): FieldCode | undefined {
  return textError(value.trim(), { max: 100 })
}
