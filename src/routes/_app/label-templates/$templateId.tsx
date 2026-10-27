import { createFileRoute } from "@tanstack/react-router"

import { requirePermission } from "@/features/auth/permissions"
import { TemplateEditorPage } from "@/features/labels/editor/template-editor-page"

export const Route = createFileRoute("/_app/label-templates/$templateId")({
  beforeLoad: ({ context }) => {
    requirePermission(context.me, "CATALOG_MANAGE")
  },
  component: function EditTemplate() {
    const { templateId } = Route.useParams()
    return <TemplateEditorPage key={templateId} templateId={templateId} />
  },
})
