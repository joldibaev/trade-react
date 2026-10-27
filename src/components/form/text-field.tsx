import type { ComponentProps } from "react"

import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

import { FieldFeedback, useFieldState } from "./field-state"

type TextFieldProps = {
  label: string
  description?: string
} & Pick<
  ComponentProps<"input">,
  "type" | "autoComplete" | "inputMode" | "autoFocus" | "required" | "onKeyDown"
>

/**
 * A text input bound to a TanStack Form field. Field errors are field codes (`REQUIRED`, ...), translated here,
 * from client validators and from the server's `VALIDATION_ERROR` alike.
 */
export function TextField({
  label,
  description,
  ...inputProps
}: TextFieldProps) {
  const state = useFieldState<string>(description)
  const { field } = state

  return (
    <Field data-invalid={state.invalid}>
      <FieldLabel htmlFor={state.id}>{label}</FieldLabel>
      <Input
        id={state.id}
        name={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(event) => {
          state.change(event.target.value)
        }}
        aria-invalid={state.invalid}
        aria-describedby={state.describedBy}
        {...inputProps}
      />
      <FieldFeedback description={description} state={state} />
    </Field>
  )
}

/** Several lines of text: a comment, the reason for an admin's change. */
export function TextareaField({
  label,
  description,
  required,
}: {
  label: string
  description?: string
  required?: boolean
}) {
  const state = useFieldState<string>(description)
  const { field } = state

  return (
    <Field data-invalid={state.invalid}>
      <FieldLabel htmlFor={state.id}>{label}</FieldLabel>
      <Textarea
        id={state.id}
        name={field.name}
        value={field.state.value}
        rows={3}
        required={required}
        onBlur={field.handleBlur}
        onChange={(event) => {
          state.change(event.target.value)
        }}
        aria-invalid={state.invalid}
        aria-describedby={state.describedBy}
      />
      <FieldFeedback description={description} state={state} />
    </Field>
  )
}
