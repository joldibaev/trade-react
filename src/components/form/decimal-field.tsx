import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

import { FieldFeedback, useFieldState } from "./field-state"

/**
 * A money, quantity or size input. The value stays the text the person typed ("12 500,5"); the form turns it into
 * the API's string with `parseDecimalInput` on submit and checks it with the `decimal(scale)` validator, so nothing
 * becomes a JS number on the way (src/lib/decimal.ts).
 */
export function DecimalField({
  label,
  description,
  compact,
  placeholder,
}: {
  label: string
  description?: string
  /**
   * In a table row: the column header names the input and the row has a fixed height, so the label and the error
   * text are for screen readers only; the red frame shows the error, and the form's alert says what to fix.
   */
  compact?: boolean
  placeholder?: string
}) {
  const state = useFieldState<string>(description)
  const { field } = state

  return (
    <Field data-invalid={state.invalid}>
      <FieldLabel htmlFor={state.id} className={compact ? "sr-only" : ""}>
        {label}
      </FieldLabel>
      <Input
        id={state.id}
        name={field.name}
        inputMode="decimal"
        autoComplete="off"
        className="text-right tabular-nums"
        placeholder={placeholder}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(event) => {
          state.change(event.target.value)
        }}
        aria-invalid={state.invalid}
        aria-describedby={state.describedBy}
      />
      {compact ? (
        <div className="sr-only">
          <FieldFeedback description={description} state={state} />
        </div>
      ) : (
        <FieldFeedback description={description} state={state} />
      )}
    </Field>
  )
}
