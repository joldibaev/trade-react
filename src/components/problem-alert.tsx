import { CircleAlertIcon } from "lucide-react"
import type { ReactNode } from "react"

import { isApiError } from "@/api/errors"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useT } from "@/i18n/i18n"

type ProblemAlertProps = {
  /** What failed, in words of the screen ("Не удалось загрузить список."). */
  title: string
  error: unknown
  onRetry?: () => void
  /** The retry button's text when it does more than repeat ("Загрузить актуальные данные"). */
  retryLabel?: string
  className?: string
  children?: ReactNode
}

/**
 * A failed request, next to what it broke. The text comes from the catalog by the error's code; the
 * support id (`traceId`) is the one in the API's log line for this request. `children` adds what the code alone
 * cannot say (the lines a revaluation stumbled on).
 */
export function ProblemAlert({
  title,
  error,
  onRetry,
  retryLabel,
  className,
  children,
}: ProblemAlertProps) {
  const t = useT()
  const apiError = isApiError(error) ? error : null

  return (
    <Alert variant="destructive" className={className}>
      <CircleAlertIcon aria-hidden />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p>{t.errors[apiError?.code ?? "UNEXPECTED_RESPONSE"]}</p>
        {children}
        {apiError?.problem && (
          <p className="text-xs">
            {t.common.supportId} {apiError.problem.traceId}
          </p>
        )}
      </AlertDescription>
      {onRetry && (
        <AlertAction>
          <Button variant="outline" size="sm" onClick={onRetry}>
            {retryLabel ?? t.common.retry}
          </Button>
        </AlertAction>
      )}
    </Alert>
  )
}
