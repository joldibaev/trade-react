import { createContext, useContext, useMemo, useState } from "react"

import type { FieldCode } from "@/api/errors"

type FormChecks = {
  errors: Readonly<Record<string, FieldCode>>
  clear: (name: string) => void
}

const FormChecksContext = createContext<FormChecks | null>(null)

/**
 * Checks over a whole form, run at the start of `onSubmit`: a grid's prices, a barcode naming a removed package.
 * Their codes live here, in React state, not in TanStack Form's field meta: a row of a virtual table scrolled out of
 * view unmounts its field, and its error must still be there when it scrolls back. Every field component shows its
 * code (`useFieldState`) and drops it when the person edits the field.
 *
 * `const checks = useFormChecks()`; in `onSubmit`, `if (checks.refuse(fields)) return`; wrap the fields in
 * `<FormChecksProvider value={checks}>`.
 */
export function useFormChecks() {
  const [errors, setErrors] = useState<Readonly<Record<string, FieldCode>>>({})
  return useMemo(
    () => ({
      errors,
      /** Shows these codes (and only these); true when there is any, so the submit stops. */
      refuse: (fields: Record<string, FieldCode>) => {
        setErrors(fields)
        return Object.keys(fields).length > 0
      },
      clear: (name: string) => {
        setErrors((current) => {
          if (!(name in current)) return current
          return Object.fromEntries(
            Object.entries(current).filter(([key]) => key !== name)
          )
        })
      },
    }),
    [errors]
  )
}

export const FormChecksProvider = FormChecksContext.Provider

/** The whole-form check's code for one field, if any. */
export function useFormCheck(name: string) {
  const checks = useContext(FormChecksContext)
  return {
    error: checks?.errors[name],
    clear: () => checks?.clear(name),
  }
}
