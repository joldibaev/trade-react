import { createFileRoute, Outlet } from "@tanstack/react-router"

import { requirePermission } from "@/features/auth/permissions"

/** People and groups: only ADMIN (USERS_MANAGE); anyone else who types the address sees "no access". */
export const Route = createFileRoute("/_app/_admin")({
  beforeLoad: ({ context }) => {
    requirePermission(context.me, "USERS_MANAGE")
  },
  component: Outlet,
})
