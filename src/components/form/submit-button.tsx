import { useSelector } from "@tanstack/react-form"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

import { useFormContext } from "./form-context"

/** The form's submit button: disabled with a spinner while the request runs, so a double click sends once. */
export function SubmitButton({
  label,
  className,
}: {
  label: string
  className?: string
}) {
  const form = useFormContext()
  const submitting = useSelector(form.store, (state) => state.isSubmitting)

  return (
    <Button type="submit" disabled={submitting} className={className}>
      {submitting && <Spinner data-icon="inline-start" aria-hidden />}
      {label}
    </Button>
  )
}
