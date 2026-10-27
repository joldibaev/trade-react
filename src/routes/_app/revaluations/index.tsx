import { createFileRoute } from "@tanstack/react-router"

import type { RevaluationFilters } from "@/features/prices/prices-api"
import {
  revaluationStatuses,
  RevaluationsPage,
} from "@/features/prices/revaluations-page"
import { isDay } from "@/lib/instant"

export const Route = createFileRoute("/_app/revaluations/")({
  validateSearch: (search: Record<string, unknown>): RevaluationFilters => {
    const filters: RevaluationFilters = {}
    const status = revaluationStatuses.find((s) => s === search.status)
    if (status) filters.status = status
    if (isDay(search.from)) filters.from = search.from
    // A period that ends before it starts would be a 400 (createdTo: OUT_OF_RANGE); the end is dropped instead.
    if (isDay(search.to) && !(filters.from && search.to < filters.from))
      filters.to = search.to
    return filters
  },
  component: function Revaluations() {
    return <RevaluationsPage filters={Route.useSearch()} />
  },
})
