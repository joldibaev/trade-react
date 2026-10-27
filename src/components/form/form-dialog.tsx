import type { AnyFormApi } from "@tanstack/react-form"
import { useRef, useState, type ReactNode, type RefObject } from "react"
import { cn } from "cn"

import { isApiError } from "@/api/errors"
import { ProblemAlert } from "@/components/problem-alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FieldGroup } from "@/components/ui/field"
import { useT } from "@/i18n/i18n"

import { focusFirstInvalid, showServerFieldErrors } from "./form"

/**
 * A refused submit, the one way every form shows it: field codes under their fields, the rest (a conflict, a name
 * taken, no network) in an alert above them. Focus goes to the first invalid field.
 */
export function useRefusal() {
  const [refusal, setRefusal] = useState<unknown>(null)
  const formRef = useRef<HTMLFormElement>(null)
  return {
    refusal,
    formRef,
    clear: () => {
      setRefusal(null)
    },
    show: (
      form: AnyFormApi,
      error: unknown,
      fieldName?: (key: string) => string
    ) => {
      setRefusal(showServerFieldErrors(form, error, fieldName) ? null : error)
      focusFirstInvalid(formRef.current)
    },
  }
}

type FormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  /** What `useRefusal` holds; shown above the fields with `refusalTitle`. */
  refusal: unknown
  refusalTitle: string
  /** What the refusal's code alone cannot say (whose barcode it is). */
  refusalDetails?: ReactNode
  /**
   * After a 409 `VERSION_CONFLICT`: load what is saved now and start over from it. The person's edits stay on
   * screen until they choose this.
   */
  onReload?: () => void
  formRef: RefObject<HTMLFormElement | null>
  /** `() => form.handleSubmit()`; when it ends with errors, focus goes to the first invalid field. */
  onSubmit: () => Promise<void>
  /** The form's `SubmitButton` (inside `form.AppForm`). */
  submit: ReactNode
  wide?: boolean
  children: ReactNode
}

/** A create or edit form in a dialog: fields scroll inside it on a small screen, the buttons stay at the bottom. */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  refusal,
  refusalTitle,
  refusalDetails,
  onReload,
  formRef,
  onSubmit,
  submit,
  wide,
  children,
}: FormDialogProps) {
  const t = useT()
  const conflict = isApiError(refusal) && refusal.code === "VERSION_CONFLICT"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={t.common.close}
        className={cn(
          "flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0",
          wide ? "sm:max-w-2xl" : "sm:max-w-lg"
        )}
      >
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form
          ref={formRef}
          noValidate
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault()
            // A dialog opened from a page form (a document) sits inside it in React's tree, portal or not.
            event.stopPropagation()
            void onSubmit().then(() => {
              focusFirstInvalid(formRef.current)
            })
          }}
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
            <FieldGroup>
              {refusal !== null && (
                <ProblemAlert
                  title={refusalTitle}
                  error={refusal}
                  onRetry={conflict ? onReload : undefined}
                  retryLabel={t.common.loadCurrent}
                >
                  {refusalDetails}
                </ProblemAlert>
              )}
              {children}
            </FieldGroup>
          </div>
          <DialogFooter className="border-t p-4">
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t.common.cancel}
            </DialogClose>
            {submit}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
