import { createFileRoute } from "@tanstack/react-router"

import { TemplatesPage } from "@/features/labels/templates-page"

export const Route = createFileRoute("/_app/label-templates/")({
  component: TemplatesPage,
})
