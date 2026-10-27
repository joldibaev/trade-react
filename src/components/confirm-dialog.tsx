import { useMutation } from "@tanstack/react-query"
import type { ReactNode } from "react"

import { ProblemAlert } from "@/components/problem-alert"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useT } from "@/i18n/i18n"

type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel: string
  /** A destructive action (delete, storno) gets the red button. */
  destructive?: boolean
  /** Runs on confirm; the dialog closes when it succeeds and shows the refusal when it fails. */
  action: () => Promise<unknown>
  failedTitle: string
  /** What the refusal alert adds (the lines a revaluation stumbled on). */
  refusalDetails?: (error: unknown) => ReactNode
}

/** "Are you sure?" for an action that is not a form: deactivate, delete, post, storno. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  action,
  failedTitle,
  refusalDetails,
}: ConfirmDialogProps) {
  const t = useT()
  const mutation = useMutation({
    mutationFn: action,
    onSuccess: () => {
      onOpenChange(false)
    },
  })

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) mutation.reset()
        onOpenChange(next)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {mutation.isError && (
          <ProblemAlert title={failedTitle} error={mutation.error}>
            {refusalDetails?.(mutation.error)}
          </ProblemAlert>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={mutation.isPending}
            onClick={() => {
              mutation.mutate()
            }}
          >
            {mutation.isPending && (
              <Spinner data-icon="inline-start" aria-hidden />
            )}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
