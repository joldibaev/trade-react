import { createFormHookContexts } from "@tanstack/react-form"

// Separate from form.ts so the field components can read the contexts without an import cycle (it breaks Vite HMR).
export const { fieldContext, formContext, useFieldContext, useFormContext } =
  createFormHookContexts()
