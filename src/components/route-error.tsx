import { LockIcon } from "lucide-react"

import { ProblemAlert } from "@/components/problem-alert"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { NoAccessError } from "@/features/auth/permissions"
import { useT } from "@/i18n/i18n"

/** A page that could not open: "no access" for a missing permission, otherwise the failed request. */
export function RouteError({
  error,
  reset,
}: {
  error: unknown
  reset: () => void
}) {
  const t = useT()
  if (error instanceof NoAccessError)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LockIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle>{t.common.noAccess}</EmptyTitle>
          <EmptyDescription>{t.common.noAccessHint}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  return (
    <ProblemAlert
      title={t.common.pageFailed}
      error={error}
      onRetry={reset}
      className="m-4"
    />
  )
}
