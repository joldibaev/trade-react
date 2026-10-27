import { createFileRoute } from "@tanstack/react-router"

import { requirePermission } from "@/features/auth/permissions"
import { TemplateEditorPage } from "@/features/labels/editor/template-editor-page"

export const Route = createFileRoute("/_app/label-templates/new")({
  // `?from=<id>`: a copy of that template, saved as a new one.
  validateSearch: (search: Record<string, unknown>): { from?: string } =>
    typeof search.from === "string" && search.from !== ""
      ? { from: search.from }
      : {},
  beforeLoad: ({ context }) => {
    requirePermission(context.me, "CATALOG_MANAGE")
  },
  component: function NewTemplate() {
    const { from } = Route.useSearch()
    return <TemplateEditorPage key={from ?? "new"} copyFrom={from} />
  },
})
