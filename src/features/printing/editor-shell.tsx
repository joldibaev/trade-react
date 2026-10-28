import { useBlocker } from "@tanstack/react-router"
import type { UseQueryResult } from "@tanstack/react-query"
import type { ReactNode } from "react"

import { isApiError } from "@/api/errors"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { ProblemAlert } from "@/components/problem-alert"
import { Skeleton } from "@/components/ui/skeleton"
import { useT } from "@/i18n/i18n"

/**
 * What both template editors (labels, receipts) share around their own screens.
 *
 * Loading: the editor shows whenever the template is in hand, even when a later refetch fails, or the person's
 * unsaved edits would be swapped for an error. Only a first load without data shows the error.
 */
export function TemplateLoader<T>({
  source,
  query,
  failedTitle,
  children,
}: {
  /** The id to load (the template itself, or the one a copy is made of); none for a new template. */
  source: string | undefined
  query: UseQueryResult<T>
  failedTitle: string
  children: (loaded: T | undefined) => ReactNode
}) {
  if (source === undefined) return children(undefined)
  if (query.data !== undefined) return children(query.data)
  if (query.isError)
    return (
      <ProblemAlert
        title={failedTitle}
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    )
  return <Skeleton className="h-96 w-full" />
}

/** What "unchanged" means: the trimmed name and the layout, as saved. */
export const snapshotOf = (name: string, layout: unknown) =>
  JSON.stringify({ name: name.trim(), layout })

/** Asks before leaving the page (or closing the tab) with unsaved changes. */
export function useLeaveGuard(isDirty: () => boolean) {
  const t = useT()
  useBlocker({
    shouldBlockFn: () => isDirty() && !window.confirm(t.common.leaveUnsaved),
    enableBeforeUnload: isDirty,
  })
}

/**
 * Why a save was refused, above the editor. After someone else's change it offers to load the current data, which
 * replaces the person's edits only once they confirm.
 */
export function SaveRefusal({
  refusal,
  reloading,
  onReloading,
  confirmText,
  failedTitle,
  onReload,
}: {
  refusal: unknown
  reloading: boolean
  onReloading: (reloading: boolean) => void
  /** What the confirmation says about the edits that will be replaced. */
  confirmText: string
  /** The title when loading the current data fails. */
  failedTitle: string
  onReload: () => Promise<void>
}) {
  const t = useT()
  const conflict = isApiError(refusal) && refusal.code === "VERSION_CONFLICT"
  return (
    <>
      {refusal !== null && (
        <ProblemAlert
          title={t.common.saveFailed}
          error={refusal}
          onRetry={
            conflict
              ? () => {
                  onReloading(true)
                }
              : undefined
          }
          retryLabel={t.common.loadCurrent}
        />
      )}
      <ConfirmDialog
        open={reloading}
        onOpenChange={onReloading}
        title={t.common.loadCurrent}
        description={confirmText}
        confirmLabel={t.common.loadCurrent}
        action={onReload}
        failedTitle={failedTitle}
      />
    </>
  )
}
