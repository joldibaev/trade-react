import { createFileRoute } from "@tanstack/react-router"

import { requirePermission } from "@/features/auth/permissions"
import { ReceiptTemplateEditorPage } from "@/features/receipts/editor/template-editor-page"

export const Route = createFileRoute("/_app/receipt-templates/$templateId")({
  beforeLoad: ({ context }) => {
    requirePermission(context.me, "TILL_SETTINGS_MANAGE")
  },
  component: function EditReceiptTemplate() {
    const { templateId } = Route.useParams()
    return (
      <ReceiptTemplateEditorPage key={templateId} templateId={templateId} />
    )
  },
})
