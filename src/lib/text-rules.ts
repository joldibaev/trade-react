import type { FieldCode } from "@/api/errors"
import { textRules, type TextRule } from "@/api/text-rules.gen"

/**
 * The text rules TradeNet publishes in its OpenAPI document (`npm run api` writes them to `text-rules.gen.ts`): a form
 * refuses what the server refuses and nothing more, with no copy of a limit or a pattern written by hand. Semantics
 * (TradeNet `docs/platform/json-and-numbers.md`): the length is that of the NFC form in UTF-16 units, the pattern is run
 * with the `u` flag on the NFC form, and a field that takes "" to remove a value has the empty text inside its pattern.
 */
export type { TextRule }

/** The rule of one field, by the request schema and the property: `textRule("CreateStoreRequest", "name")`. */
export function textRule<
  S extends keyof typeof textRules,
  P extends keyof (typeof textRules)[S],
>(schema: S, property: P): (typeof textRules)[S][P] {
  return textRules[schema][property]
}

/** The length the server measures: characters of the NFC form. */
export function textLength(value: string): number {
  return value.normalize("NFC").length
}

/** The longest text the rule allows. A field that has no length rule has no limit worth checking, so this throws. */
export function maxLength(rule: TextRule): number {
  if (rule.maxLength === undefined)
    throw new Error("The API publishes no maximum length for this field.")
  return rule.maxLength
}

/**
 * The code TradeNet would answer for this text, or nothing. `required` (the default) makes an empty text `REQUIRED`;
 * a field the form sends as null when it is empty passes `required: false`. A field whose pattern takes "" (a store's
 * phone, a revaluation's comment) accepts it either way. The text is judged as it stands: a form that sends it trimmed
 * judges it trimmed (`textValidator` does).
 */
export function textError(
  value: string,
  rule: TextRule,
  options: { required?: boolean } = {}
): FieldCode | undefined {
  const text = value.normalize("NFC")
  const required = options.required ?? true
  if (text === "") {
    if (rule.pattern?.test("")) return undefined
    return required ? "REQUIRED" : undefined
  }
  // Only spaces is nothing typed, for a field that needs something; otherwise the pattern judges it.
  if (
    required &&
    text.trim() === "" &&
    rule.pattern &&
    !rule.pattern.test(text)
  )
    return "REQUIRED"
  if (rule.maxLength !== undefined && text.length > rule.maxLength)
    return "OUT_OF_RANGE"
  // Only a new password has a minimum, and its code says so.
  if (rule.minLength !== undefined && text.length < rule.minLength)
    return "PASSWORD_TOO_SHORT"
  if (rule.pattern && !rule.pattern.test(text)) return "INVALID_FORMAT"
  return undefined
}

/**
 * A client validator for a text field, from the rule the API publishes. The text is judged trimmed, as forms send it
 * (a password is never trimmed: pass `trim: false`).
 */
export function textValidator(
  rule: TextRule,
  options: { required?: boolean; trim?: boolean } = {}
) {
  return ({ value }: { value: string }): FieldCode | undefined =>
    textError((options.trim ?? true) ? value.trim() : value, rule, options)
}
