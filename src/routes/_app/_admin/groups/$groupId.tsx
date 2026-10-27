import { createFileRoute, useNavigate } from "@tanstack/react-router"

import {
  securityActions,
  type SecurityAction,
} from "@/features/access/access-api"
import { GroupPage } from "@/features/access/groups"

export const Route = createFileRoute("/_app/_admin/groups/$groupId")({
  // The security history's event filter (`?action=LOGIN_FAILED`), so Back and a shared link keep it.
  validateSearch: (
    search: Record<string, unknown>
  ): { action?: SecurityAction } => {
    const action = securityActions.find((a) => a === search.action)
    return action ? { action } : {}
  },
  component: function Page() {
    const { groupId } = Route.useParams()
    const { action } = Route.useSearch()
    const navigate = useNavigate({ from: Route.fullPath })
    return (
      <GroupPage
        groupId={groupId}
        action={action}
        onActionChange={(next) => {
          void navigate({ search: next ? { action: next } : {} })
        }}
      />
    )
  },
})
