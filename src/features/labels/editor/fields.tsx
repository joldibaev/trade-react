import { useId, useState, type ReactNode } from "react"

import type { FieldCode } from "@/api/errors"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useT } from "@/i18n/i18n"
import { parseDecimalInput } from "@/lib/decimal"

import { mm } from "../mm"

/**
 * A number of the layout (millimetres, points). The text is the person's while it is wrong ("12,", "130"): it stays
 * with its error under it, and the element keeps its last good value until the text is right.
 */
export function NumberField({
  label,
  value,
  min,
  max,
  scale = 2,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  /** Fraction digits allowed: 2 for millimetres, 0 for points. */
  scale?: number
  onChange: (value: number) => void
}) {
  const t = useT()
  const id = useId()
  const shown = String(Math.round(value * 100) / 100).replace(".", ",")
  const [text, setText] = useState(shown)
  const [last, setLast] = useState(value)
  if (value !== last) {
    setLast(value)
    setText(shown)
  }
  const parsed = parseDecimalInput(text, scale)
  const number = parsed === null ? null : mm(parsed)
  const error: FieldCode | null =
    number === null
      ? "INVALID_VALUE"
      : number < min || number > max
        ? "OUT_OF_RANGE"
        : null
  return (
    <Field data-invalid={error !== null}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        className="text-right tabular-nums"
        value={text}
        aria-invalid={error !== null}
        aria-describedby={error ? `${id}-error` : undefined}
        // Enter in a property must not save the whole template (the editor is one form).
        onKeyDown={(event) => {
          if (event.key === "Enter") event.preventDefault()
        }}
        onChange={(event) => {
          setText(event.target.value)
          const next = parseDecimalInput(event.target.value, scale)
          if (next === null) return
          const n = mm(next)
          if (n >= min && n <= max) {
            setLast(n)
            onChange(n)
          }
        }}
      />
      {error && (
        <FieldError
          id={`${id}-error`}
          errors={[
            {
              message:
                error === "OUT_OF_RANGE"
                  ? `${t.labelEditor.range} ${String(min).replace(".", ",")}–${String(max).replace(".", ",")}`
                  : t.fields[error],
            },
          ]}
        />
      )}
    </Field>
  )
}

export function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  const id = useId()
  return (
    <Field orientation="horizontal">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(next) => {
          onChange(next)
        }}
      />
      <FieldLabel htmlFor={id} className="font-normal">
        {label}
      </FieldLabel>
    </Field>
  )
}

/** A titled group of controls in the properties panel. */
export function Section({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  )
}
