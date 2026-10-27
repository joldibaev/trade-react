import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import { required, useAppForm } from "@/components/form/form"
import { FormDialog, useRefusal } from "@/components/form/form-dialog"
import { useT } from "@/i18n/i18n"
import { changedFields } from "@/lib/changes"

import { createStore, storeQuery, updateStore, type Store } from "./stores-api"

type StoreFormProps = {
  /** The store to edit; a new store when absent. */
  store?: Store
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (store: Store) => void
}

const valuesOf = (store: Store | undefined) => ({
  name: store?.name ?? "",
  address: store?.address ?? "",
  phone: store?.phone ?? "",
})

/** Open a store, or fix its name, address and phone (printed on receipts later). */
export function StoreFormDialog({
  store,
  open,
  onOpenChange,
  onSaved,
}: StoreFormProps) {
  const t = useT()
  const queryClient = useQueryClient()
  const refusal = useRefusal()
  // What the form started from; a version conflict replaces it with what is saved now.
  const [base, setBase] = useState(store)

  const form = useAppForm({
    defaultValues: valuesOf(base),
    onSubmit: async ({ value, formApi }) => {
      refusal.clear()
      try {
        const name = value.name.trim()
        const address = value.address.trim()
        const phone = value.phone.trim()
        const saved = base
          ? await updateStore(
              queryClient,
              base,
              // An empty address or phone removes it (TradeNet stores.md).
              changedFields(valuesOf(base), { name, address, phone })
            )
          : await createStore(queryClient, {
              name,
              address: address || null,
              phone: phone || null,
            })
        onOpenChange(false)
        onSaved?.(saved)
      } catch (error) {
        refusal.show(formApi, error)
      }
    },
  })

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={store ? t.stores.editTitle : t.stores.createTitle}
      refusal={refusal.refusal}
      refusalTitle={t.common.saveFailed}
      onReload={() => {
        if (!base) return
        void queryClient
          .query({ ...storeQuery(base.id), staleTime: 0 })
          .then((fresh) => {
            setBase(fresh)
            form.reset(valuesOf(fresh))
            refusal.clear()
          })
      }}
      formRef={refusal.formRef}
      onSubmit={() => form.handleSubmit()}
      submit={
        <form.AppForm>
          <form.SubmitButton label={store ? t.common.save : t.common.create} />
        </form.AppForm>
      }
    >
      <form.AppField
        name="name"
        validators={{ onChange: required, onBlur: required }}
      >
        {(field) => <field.TextField label={t.stores.name} required />}
      </form.AppField>
      <form.AppField name="address">
        {(field) => (
          <field.TextField
            label={t.stores.address}
            autoComplete="street-address"
          />
        )}
      </form.AppField>
      <form.AppField name="phone">
        {(field) => (
          <field.TextField
            label={t.stores.phone}
            description={t.common.phoneHint}
            type="tel"
            autoComplete="tel"
          />
        )}
      </form.AppField>
    </FormDialog>
  )
}
