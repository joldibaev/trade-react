import { Badge } from "@/components/ui/badge"
import { useT } from "@/i18n/i18n"

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
