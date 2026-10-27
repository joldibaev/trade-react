import { useSelector } from "@tanstack/react-form"

import type { FieldCode } from "@/api/errors"
import { FieldDescription, FieldError } from "@/components/ui/field"
import { useT } from "@/i18n/i18n"

import { useFormCheck } from "./form-checks"
import { useFieldContext } from "./form-context"

/**
 * What every field component shares: its ids, its error codes and when they show.
 *
 * A server error or a whole-form check (./form-checks.tsx) shows at once; a client error after the person leaves the
 * field or tries to submit, so typing the first letter does not already shout "invalid". Editing clears the first two.
 */
export function useFieldState<T>(description?: string) {
  const field = useFieldContext<T>()
  const submitted = useSelector(
    field.form.store,
    (state) => state.submissionAttempts > 0
  )
  const { meta } = field.state
  const check = useFormCheck(field.name)

  const serverError = meta.errorMap.onServer as FieldCode | undefined
  const clientErrors = (meta.isBlurred || submitted ? meta.errors : []) as (
    FieldCode | undefined
  )[]
  const codes = check.error
    ? [check.error]
    : serverError
      ? [serverError]
      : clientErrors.filter((code) => code !== undefined)
  const invalid = codes.length > 0
  const errorId = `${field.name}-error`
  const descriptionId = `${field.name}-description`

  return {
    field,
    id: field.name,
    codes,
    invalid,
    errorId,
    descriptionId,
    describedBy:
      [invalid && errorId, description && descriptionId]
        .filter(Boolean)
        .join(" ") || undefined,
    /** Sets the value and drops the server's error and the form check's, which were about the old value. */
    change: (value: T) => {
      field.handleChange(value)
      check.clear()
      if (serverError)
        field.setMeta((m) => ({
          ...m,
          errorMap: { ...m.errorMap, onServer: undefined },
        }))
    },
  }
}

type FieldStateView = Pick<
  ReturnType<typeof useFieldState>,
  "codes" | "invalid" | "errorId" | "descriptionId"
>

/** The description and the translated errors under a field, linked to it by `aria-describedby`. */
export function FieldFeedback({
  description,
  state,
}: {
  description?: string | undefined
  state: FieldStateView
}) {
  const t = useT()
  return (
    <>
      {description && (
        <FieldDescription id={state.descriptionId}>
          {description}
        </FieldDescription>
      )}
      {state.invalid && (
        <FieldError
          id={state.errorId}
          errors={state.codes.map((code) => ({ message: t.fields[code] }))}
        />
      )}
    </>
  )
}
