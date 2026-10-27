import { createFileRoute } from "@tanstack/react-router"

import { RevaluationPage } from "@/features/prices/revaluation-page"

export const Route = createFileRoute("/_app/revaluations/$revaluationId")({
  component: function Revaluation() {
    const { revaluationId } = Route.useParams()
    return <RevaluationPage revaluationId={revaluationId} />
  },
})
