import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

import { FieldFeedback, useFieldState } from "./field-state"

export type Option = { value: string; label: string; hint?: string }

/** One of a few known values (a group, a parent category). `""` is "nothing chosen" and shows `placeholder`. */
export function SelectField({
  label,
  options,
  placeholder,
  description,
}: {
  label: string
  options: readonly Option[]
  placeholder?: string
  description?: string
}) {
  const state = useFieldState<string>(description)
  const { field } = state

  return (
    <Field data-invalid={state.invalid}>
      <FieldLabel htmlFor={state.id}>{label}</FieldLabel>
      <Select
        value={field.state.value}
        items={options}
        onValueChange={(value) => {
          state.change(value ?? "")
          field.handleBlur()
        }}
      >
        <SelectTrigger
          id={state.id}
          className="w-full"
          aria-invalid={state.invalid}
          aria-describedby={state.describedBy}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldFeedback description={description} state={state} />
    </Field>
  )
}

/** A yes/no setting that applies on save ("Активен"). */
export function SwitchField({
  label,
  description,
}: {
  label: string
  description?: string
}) {
  const state = useFieldState<boolean>(description)
  const { field } = state

  return (
    <Field orientation="horizontal" data-invalid={state.invalid}>
      <FieldContent>
        <FieldLabel htmlFor={state.id}>{label}</FieldLabel>
        <FieldFeedback description={description} state={state} />
      </FieldContent>
      <Switch
        id={state.id}
        checked={field.state.value}
        onCheckedChange={(checked) => {
          state.change(checked)
        }}
        aria-describedby={state.describedBy}
      />
    </Field>
  )
}

/** Several of a known list (a group's permissions, a person's stores). The value is the chosen values, in list order. */
export function CheckboxListField({
  legend,
  options,
  description,
}: {
  legend: string
  options: readonly Option[]
  description?: string
}) {
  const state = useFieldState<string[]>(description)
  const { field } = state
  const chosen = new Set(field.state.value)

  return (
    <FieldSet data-invalid={state.invalid}>
      <FieldLegend variant="label">{legend}</FieldLegend>
      <FieldFeedback description={description} state={state} />
      {options.map((option) => {
        const id = `${state.id}-${option.value}`
        return (
          <Field key={option.value} orientation="horizontal">
            <Checkbox
              id={id}
              checked={chosen.has(option.value)}
              onCheckedChange={(checked) => {
                state.change(
                  options
                    .map((o) => o.value)
                    .filter((value) =>
                      value === option.value ? checked : chosen.has(value)
                    )
                )
              }}
            />
            <FieldContent>
              <FieldLabel htmlFor={id} className="font-normal">
                {option.label}
              </FieldLabel>
              {option.hint && (
                <FieldDescription>{option.hint}</FieldDescription>
              )}
            </FieldContent>
          </Field>
        )
      })}
    </FieldSet>
  )
}
