import { BracesIcon } from "lucide-react"
import { useId, useRef } from "react"

import type { FieldCode } from "@/api/errors"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useT } from "@/i18n/i18n"

import { receiptVariables, unknownVariables } from "../receipt/data"
import { limits } from "../receipt/layout"

/**
 * The words under a refused field: what the editor or TradeNet found wrong. A text names the variables it does not
 * know; a range names its bounds.
 */
export function errorText(
  t: ReturnType<typeof useT>,
  code: FieldCode,
  detail: { unknown?: string[]; range?: string; length?: number }
): string {
  if (code === "INVALID_VALUE" && detail.unknown && detail.unknown.length > 0)
    return `${t.receiptEditor.unknownVariables} ${detail.unknown.map((name) => `{${name}}`).join(", ")}`
  if (code === "OUT_OF_RANGE" && detail.length !== undefined)
    return `${t.receiptEditor.tooLong} ${String(detail.length)}`
  if (code === "OUT_OF_RANGE" && detail.range)
    return `${t.printing.range} ${detail.range}`
  return t.fields[code]
}

/**
 * A text with `{variables}`: one line (a QR value) or several (a text block), a menu to insert a variable at the
 * cursor, and what it will print on the sample sale.
 */
export function VariableField({
  label,
  value,
  multiline,
  hint,
  error,
  preview,
  onChange,
}: {
  label: string
  value: string
  multiline: boolean
  hint?: string
  error: FieldCode | undefined
  /** What the value prints on the sample sale (a link's values are encoded, a text's are not). */
  preview: (value: string) => string
  onChange: (value: string) => void
}) {
  const t = useT()
  const id = useId()
  const input = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  const filled = preview(value)
  const maxLength = multiline ? limits.textLength : limits.qrValueLength
  const message = error
    ? errorText(t, error, {
        unknown: unknownVariables(value),
        length: maxLength,
      })
    : null
  const common = {
    id,
    value,
    "aria-invalid": error !== undefined,
    "aria-describedby": `${id}-hint`,
    onChange: (event: { target: { value: string } }) => {
      onChange(event.target.value)
    },
  }
  return (
    <Field data-invalid={error !== undefined}>
      <div className="flex items-end justify-between gap-2">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
            <BracesIcon data-icon="inline-start" aria-hidden />
            {t.receiptEditor.insertVariable}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {receiptVariables.map((name) => (
              <DropdownMenuItem
                key={name}
                onClick={() => {
                  const node = input.current
                  const start = node?.selectionStart ?? value.length
                  const end = node?.selectionEnd ?? value.length
                  onChange(
                    `${value.slice(0, start)}{${name}}${value.slice(end)}`
                  )
                }}
              >
                {`${t.receiptEditor.variables[name]} — {${name}}`}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {multiline ? (
        <Textarea ref={input} rows={3} {...common} />
      ) : (
        <Input
          ref={input}
          autoComplete="off"
          // Enter in a property must not save the whole template (the editor is one form).
          onKeyDown={(event) => {
            if (event.key === "Enter") event.preventDefault()
          }}
          {...common}
        />
      )}
      {message ? (
        <FieldError id={`${id}-hint`} errors={[{ message }]} />
      ) : (
        <FieldDescription id={`${id}-hint`}>
          {[hint, filled !== value && `${t.receiptEditor.willPrint} ${filled}`]
            .filter(Boolean)
            .join(" ")}
        </FieldDescription>
      )}
    </Field>
  )
}

/** A one-line text of a block (a title) with its hint and its refusal. */
export function TextInput({
  label,
  hint,
  value,
  error,
  onChange,
}: {
  label: string
  hint?: string
  value: string
  error: string | null
  onChange: (value: string) => void
}) {
  const id = useId()
  return (
    <Field data-invalid={error !== null}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        autoComplete="off"
        value={value}
        aria-invalid={error !== null}
        aria-describedby={`${id}-hint`}
        // Enter in a property must not save the whole template (the editor is one form).
        onKeyDown={(event) => {
          if (event.key === "Enter") event.preventDefault()
        }}
        onChange={(event) => {
          onChange(event.target.value)
        }}
      />
      {error ? (
        <FieldError id={`${id}-hint`} errors={[{ message: error }]} />
      ) : (
        hint && <FieldDescription id={`${id}-hint`}>{hint}</FieldDescription>
      )}
    </Field>
  )
}
