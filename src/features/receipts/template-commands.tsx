import { useQueryClient } from "@tanstack/react-query"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { useT } from "@/i18n/i18n"

import {
  deleteReceiptTemplate,
  updateReceiptTemplate,
  type ReceiptTemplate,
} from "./templates-api"

type Target = Pick<ReceiptTemplate, "id" | "name" | "version" | "isActive">

/** Switching a template off or on, asked first; the list and the editor both use it. */
export function ActivationConfirm({
  template,
  onClose,
  onDone,
}: {
  template: Target
  onClose: () => void
  onDone?: (updated: ReceiptTemplate) => void
}) {
  const t = useT()
  const queryClient = useQueryClient()
  const off = template.isActive
  return (
    <ConfirmDialog
      open
      onOpenChange={onClose}
      title={`${off ? t.receiptTemplates.deactivate : t.receiptTemplates.activate}: ${template.name}`}
      description={
        off
          ? t.receiptTemplates.deactivateHint
          : t.receiptTemplates.activateHint
      }
      confirmLabel={
        off ? t.receiptTemplates.deactivate : t.receiptTemplates.activate
      }
      destructive={off}
      failedTitle={t.common.saveFailed}
      action={async () => {
        const updated = await updateReceiptTemplate(queryClient, template, {
          isActive: !off,
        })
        onDone?.(updated)
      }}
    />
  )
}

/** Deleting a template, asked first. */
export function DeleteConfirm({
  template,
  onClose,
  onDone,
}: {
  template: Target
  onClose: () => void
  onDone?: () => void
}) {
  const t = useT()
  const queryClient = useQueryClient()
  return (
    <ConfirmDialog
      open
      onOpenChange={onClose}
      title={`${t.receiptTemplates.delete}: ${template.name}`}
      description={t.receiptTemplates.deleteHint}
      confirmLabel={t.receiptTemplates.delete}
      destructive
      failedTitle={t.common.deleteFailed}
      action={async () => {
        await deleteReceiptTemplate(queryClient, template)
        onDone?.()
      }}
    />
  )
}
