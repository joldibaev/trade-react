import { useQueryClient } from "@tanstack/react-query"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { useT } from "@/i18n/i18n"

import {
  updateCashbox,
  updateStore,
  type Cashbox,
  type Store,
} from "./stores-api"

/**
 * Closes or reopens a store. Nothing is deleted: people bound to it keep its history, its cashboxes stay as they
 * were. A chain decision: offered only to people with all stores (`me.stores.all`); should the access change
 * meanwhile, the server's 403 `ALL_STORES_REQUIRED` shows in the dialog.
 */
export function StoreActivationDialog({
  store,
  open,
  onOpenChange,
}: {
  store: Store
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const queryClient = useQueryClient()
  const deactivating = store.isActive

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`${deactivating ? t.stores.deactivate : t.stores.activate}: ${store.name}`}
      description={
        deactivating ? t.stores.deactivateHint : t.stores.activateHint
      }
      confirmLabel={deactivating ? t.stores.deactivate : t.stores.activate}
      destructive={deactivating}
      failedTitle={t.common.saveFailed}
      action={() =>
        updateStore(queryClient, store, { isActive: !store.isActive })
      }
    />
  )
}

/** Removes a till from use, or brings it back. It stays in the store's list either way. */
export function CashboxActivationDialog({
  cashbox,
  open,
  onOpenChange,
}: {
  cashbox: Cashbox
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const queryClient = useQueryClient()
  const deactivating = cashbox.isActive

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`${deactivating ? t.cashboxes.deactivate : t.cashboxes.activate}: ${cashbox.name}`}
      description={
        deactivating ? t.cashboxes.deactivateHint : t.cashboxes.activateHint
      }
      confirmLabel={
        deactivating ? t.cashboxes.deactivate : t.cashboxes.activate
      }
      destructive={deactivating}
      failedTitle={t.common.saveFailed}
      action={() =>
        updateCashbox(queryClient, cashbox, { isActive: !cashbox.isActive })
      }
    />
  )
}
