import { createFileRoute } from "@tanstack/react-router"

import { requirePermission } from "@/features/auth/permissions"
import { NewRevaluationPage } from "@/features/prices/revaluation-page"

export const Route = createFileRoute("/_app/revaluations/new")({
  beforeLoad: ({ context }) => {
    requirePermission(context.me, "PRICES_MANAGE")
  },
  component: NewRevaluationPage,
})
