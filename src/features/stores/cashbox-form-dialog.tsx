import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import { useAppForm } from "@/components/form/form"
import { FormDialog, useRefusal } from "@/components/form/form-dialog"
import { useT } from "@/i18n/i18n"
import { textRule, textValidator } from "@/lib/text-rules"

import {
  createCashbox,
  storeQuery,
  updateCashbox,
  type Cashbox,
} from "./stores-api"

const createCashboxNameCheck = textValidator(
  textRule("CreateCashboxRequest", "name")
)

/** Open a till in a store, or rename one. A cashbox never moves to another store. */
export function CashboxFormDialog({
  storeId,
  cashbox,
  open,
  onOpenChange,
}: {
  storeId: string
  /** The cashbox to rename; a new one when absent. */
  cashbox?: Cashbox
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const queryClient = useQueryClient()
  const refusal = useRefusal()
  const [base, setBase] = useState(cashbox)

  const form = useAppForm({
    defaultValues: { name: base?.name ?? "" },
    onSubmit: async ({ value, formApi }) => {
      refusal.clear()
      try {
        const name = value.name.trim()
        if (base) await updateCashbox(queryClient, base, { name })
        else await createCashbox(queryClient, storeId, { name })
        onOpenChange(false)
      } catch (error) {
        refusal.show(formApi, error)
      }
    },
  })

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={cashbox ? t.cashboxes.renameTitle : t.cashboxes.createTitle}
      refusal={refusal.refusal}
      refusalTitle={t.common.saveFailed}
      onReload={() => {
        if (!base) return
        void queryClient
          .query({ ...storeQuery(storeId), staleTime: 0 })
          .then((store) => {
            const fresh = store.cashboxes.find((c) => c.id === base.id)
            if (!fresh) return
            setBase(fresh)
            form.reset({ name: fresh.name })
            refusal.clear()
          })
      }}
      formRef={refusal.formRef}
      onSubmit={() => form.handleSubmit()}
      submit={
        <form.AppForm>
          <form.SubmitButton
            label={cashbox ? t.common.save : t.common.create}
          />
        </form.AppForm>
      }
    >
      <form.AppField
        name="name"
        validators={{
          onChange: createCashboxNameCheck,
          onBlur: createCashboxNameCheck,
        }}
      >
        {(field) => (
          <field.TextField
            label={t.cashboxes.name}
            description={t.cashboxes.nameHint}
            required
          />
        )}
      </form.AppField>
    </FormDialog>
  )
}
