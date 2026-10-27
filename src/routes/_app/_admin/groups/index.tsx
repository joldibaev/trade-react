import { createFileRoute } from "@tanstack/react-router"

import { GroupsPage } from "@/features/access/groups"

export const Route = createFileRoute("/_app/_admin/groups/")({
  component: GroupsPage,
})
