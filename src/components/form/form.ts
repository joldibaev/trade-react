import { createFormHook, type AnyFormApi } from "@tanstack/react-form"

import { isApiError, type FieldCode } from "@/api/errors"
import { parseDecimalInput } from "@/lib/decimal"

import {
  CheckboxField,
  CheckboxListField,
  SelectField,
  SwitchField,
} from "./choice-fields"
import { DecimalField } from "./decimal-field"
import { fieldContext, formContext } from "./form-context"
import { SubmitButton } from "./submit-button"
import { TextareaField, TextField } from "./text-field"

/**
 * The app's forms: `const form = useAppForm({...})`, fields through `<form.AppField name="x">{(f) => <f.TextField .../>}`.
 * A new kind of field (decimal, select, date) is added here once and used by every form.
 */
export const { useAppForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    TextField,
    TextareaField,
    DecimalField,
    SelectField,
    SwitchField,
    CheckboxField,
    CheckboxListField,
  },
  formComponents: { SubmitButton },
})

/** A client validator: the field's code or nothing. */
export function required({ value }: { value: string }): FieldCode | undefined {
  return value.trim() === "" ? "REQUIRED" : undefined
}

/** Several client validators on one field: the first code wins. */
export function allOf<T>(
  ...validators: ((input: { value: T }) => FieldCode | undefined)[]
) {
  return (input: { value: T }): FieldCode | undefined => {
    for (const validate of validators) {
      const code = validate(input)
      if (code) return code
    }
    return undefined
  }
}

/** A client validator for a decimal typed by a person: empty passes (use `required` too), a bad one is a code. */
export function decimal(scale: number) {
  return ({ value }: { value: string }): FieldCode | undefined =>
    value.trim() === "" || parseDecimalInput(value, scale) !== null
      ? undefined
      : "INVALID_VALUE"
}

/**
 * Puts the field codes of a 400 `VALIDATION_ERROR` under the fields they name. The server names fields by their
 * JSON path (`name`, `packages[0].size`), which is how forms name them too; case is ignored. Returns true only when
 * every code found its field: otherwise the caller shows the whole error above the form, so no code is lost.
 */
export function showServerFieldErrors(
  form: AnyFormApi,
  error: unknown,
  /** For a form whose fields are not the request's (a grid sent as flat lines): the server's key to a field name. */
  fieldName: (key: string) => string = (key) => key
): boolean {
  if (!isApiError(error) || error.code !== "VALIDATION_ERROR") return false
  const fieldNames = new Map(
    Object.keys(form.fieldInfo).map((name) => [name.toLowerCase(), name])
  )
  let all = true
  for (const [key, codes] of Object.entries(error.fieldErrors)) {
    const name = fieldNames.get(fieldName(key).toLowerCase())
    if (name === undefined || codes.length === 0) {
      all = false
      continue
    }
    form.setFieldMeta(name, (meta) => ({
      ...meta,
      errorMap: { ...meta.errorMap, onServer: codes[0] },
    }))
  }
  return all
}

/**
 * After a refused submit, focus goes to the first field with an error, so a keyboard or screen reader user lands on
 * it. On the next frame: errors set during the submit are on screen only after React renders them.
 */
export function focusFirstInvalid(formElement: HTMLFormElement | null) {
  requestAnimationFrame(() => {
    formElement?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus()
  })
}
