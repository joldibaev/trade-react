import {
  createContext,
  useContext,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from "react"

import type { FieldCode } from "@/api/errors"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useT } from "@/i18n/i18n"
import { parseDecimalInput } from "@/lib/decimal"

/** The editor's way to learn that a number field holds text it cannot use yet, so saving can wait for the person. */
export const NumberValidityContext = createContext<
  (id: string, invalid: boolean) => void
>(() => undefined)

// Millimetres, points and percents of a layout are geometry, not money.
// eslint-disable-next-line no-restricted-syntax
const toNumber = (text: string) => Number.parseFloat(text)

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
  error: refused,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  /** Fraction digits allowed: 2 for millimetres, 0 for points. */
  scale?: number
  /** What the server or the editor's own check refused about the value that is kept, shown under the field. */
  error?: string | null
  onChange: (value: number) => void
}) {
  const t = useT()
  const id = useId()
  const kept = String(Math.round(value * 100) / 100).replace(".", ",")
  const [text, setText] = useState(kept)
  const [last, setLast] = useState(value)
  if (value !== last) {
    setLast(value)
    setText(kept)
  }
  const parsed = parseDecimalInput(text, scale)
  const number = parsed === null ? null : toNumber(parsed)
  const error: FieldCode | null =
    number === null
      ? "INVALID_VALUE"
      : number < min || number > max
        ? "OUT_OF_RANGE"
        : null
  const report = useContext(NumberValidityContext)
  const invalid = error !== null
  useEffect(() => {
    report(id, invalid)
    return () => {
      report(id, false)
    }
  }, [report, id, invalid])
  const refusal = error === null && refused ? refused : null
  return (
    <Field data-invalid={error !== null || refusal !== null}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        className="text-right tabular-nums"
        value={text}
        aria-invalid={error !== null || refusal !== null}
        aria-describedby={
          error !== null || refusal !== null ? `${id}-error` : undefined
        }
        // Enter in a property must not save the whole template (the editor is one form).
        onKeyDown={(event) => {
          if (event.key === "Enter") event.preventDefault()
        }}
        onChange={(event) => {
          setText(event.target.value)
          const next = parseDecimalInput(event.target.value, scale)
          if (next === null) return
          const n = toNumber(next)
          if (n >= min && n <= max) {
            setLast(n)
            onChange(n)
          }
        }}
      />
      {(error !== null || refusal !== null) && (
        <FieldError
          id={`${id}-error`}
          errors={[
            {
              message:
                refusal ??
                (error === "OUT_OF_RANGE"
                  ? `${t.printing.range} ${String(min).replace(".", ",")}–${String(max).replace(".", ",")}`
                  : error
                    ? t.fields[error]
                    : ""),
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

/** One of a few known values as a row of buttons (an alignment, a size), with a label people can see. */
export function ChoiceField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: Record<T, string>
  onChange: (value: T) => void
}) {
  const id = useId()
  const choices = Object.keys(options) as T[]
  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className="text-sm font-medium">
        {label}
      </span>
      <ToggleGroup
        variant="outline"
        aria-labelledby={id}
        value={[value]}
        onValueChange={(values: string[]) => {
          const next = choices.find((choice) => choice === values[0])
          if (next) onChange(next)
        }}
      >
        {choices.map((choice) => (
          <ToggleGroupItem key={choice} value={choice}>
            {options[choice]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}
