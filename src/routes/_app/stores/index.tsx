import { createFileRoute } from "@tanstack/react-router"

import { parseActiveStatus, type ActiveStatus } from "@/components/page"
import { StoresPage } from "@/features/stores/stores-page"

export const Route = createFileRoute("/_app/stores/")({
  validateSearch: (
    search: Record<string, unknown>
  ): { status?: ActiveStatus } => {
    const status = parseActiveStatus(search.status)
    return status ? { status } : {}
  },
  component: function Stores() {
    const { status } = Route.useSearch()
    return <StoresPage status={status} />
  },
})
