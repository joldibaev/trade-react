import { createFileRoute } from "@tanstack/react-router"

import { parseActiveStatus } from "@/components/page"
import type { UserFilters } from "@/features/access/access-api"
import { UsersPage } from "@/features/access/users-page"

const text = (value: unknown) =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : undefined

export const Route = createFileRoute("/_app/_admin/users/")({
  validateSearch: (search: Record<string, unknown>): UserFilters => {
    const filters: UserFilters = {}
    const searchText = text(search.search)
    if (searchText) filters.search = searchText
    const groupId = text(search.groupId)
    if (groupId) filters.groupId = groupId
    const status = parseActiveStatus(search.status)
    if (status) filters.status = status
    return filters
  },
  component: function Users() {
    return <UsersPage filters={Route.useSearch()} />
  },
})
