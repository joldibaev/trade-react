import { Badge } from "@/components/ui/badge"
import { useT } from "@/i18n/i18n"
import type { Messages } from "@/i18n/messages/ru"

import type { RevaluationStatus } from "./prices-api"

const variants = {
  DRAFT: "outline",
  POSTED: "secondary",
  REVERSED: "destructive",
} as const satisfies Record<RevaluationStatus, string>

/** Черновик, Проведена or Сторнирована: in words, the color only repeats them. */
export function RevaluationStatusBadge({
  status,
}: {
  status: RevaluationStatus
}) {
  const t = useT()
  return (
    <Badge variant={variants[status]}>{t.revaluations.statuses[status]}</Badge>
  )
}

/** A draft has no number yet: the next one is given at posting, so posted documents are numbered without gaps. */
export const revaluationNumber = (t: Messages, number: number | null) =>
  number === null ? t.revaluations.draft : `№${String(number)}`
