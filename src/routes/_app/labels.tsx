import { createFileRoute } from "@tanstack/react-router"

import { LabelsPage } from "@/features/labels/labels-page"

export const Route = createFileRoute("/_app/labels")({
  component: LabelsPage,
})
