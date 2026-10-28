import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"

import { problemWith, type FieldCode } from "@/api/errors"
import {
  FormChecksProvider,
  useFormChecks,
} from "@/components/form/form-checks"
import { useAppForm } from "@/components/form/form"
import { FormDialog, useRefusal } from "@/components/form/form-dialog"
import { priceTypesQuery } from "@/features/prices/prices-api"
import { useT } from "@/i18n/i18n"
import { textRule, textValidator } from "@/lib/text-rules"

import {
  counterpartyQuery,
  createCounterparty,
  updateCounterparty,
  type Counterparty,
} from "./counterparties-api"
import {
  formFieldOf,
  noPriceType,
  toChanges,
  toCreateRequest,
  valuesOf,
} from "./counterparty-form"

const createCounterpartyNameCheck = textValidator(
  textRule("CreateCounterpartyRequest", "name")
)
const createCounterpartyPhoneCheck = textValidator(
  textRule("CreateCounterpartyRequest", "phone"),
  { required: false }
)
const createCounterpartyTaxIdCheck = textValidator(
  textRule("CreateCounterpartyRequest", "taxId"),
  { required: false }
)
const createCounterpartyAddressCheck = textValidator(
  textRule("CreateCounterpartyRequest", "address"),
  { required: false }
)
const createCounterpartyNoteCheck = textValidator(
  textRule("CreateCounterpartyRequest", "note"),
  { required: false }
)

/** Supplier, customer or both: TradeNet refuses a counterparty that is neither. */
const someRole = ({ value }: { value: string[] }): FieldCode | undefined =>
  value.length === 0 ? "REQUIRED" : undefined

/** A new counterparty, or a change to one. Deactivating and deleting are row actions, as for price types. */
export function CounterpartyFormDialog({
  counterparty,
  open,
  onOpenChange,
}: {
  /** The counterparty to edit; a new one when absent. */
  counterparty?: Counterparty
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const queryClient = useQueryClient()
  const refusal = useRefusal()
  const checks = useFormChecks()
  // What the form started from; a version conflict replaces it with what is saved now.
  const [base, setBase] = useState(counterparty)
  const priceTypes = useQuery(priceTypesQuery).data

  const priceTypeOptions = useMemo(() => {
    const list = priceTypes ?? []
    const current = list.find((p) => p.id === base?.priceTypeId)
    return [
      { value: noPriceType, label: t.counterparties.noPriceType },
      ...list
        .filter((p) => p.isActive)
        .map((p) => ({ value: p.id, label: p.name })),
      // A type deactivated after it was chosen stays on the card (the till ignores it); without it here the select
      // would show nothing, as if no type were chosen.
      ...(current && !current.isActive
        ? [
            {
              value: current.id,
              label: `${current.name} (${t.priceTypes.inactive})`,
            },
          ]
        : []),
    ]
  }, [priceTypes, base?.priceTypeId, t])

  const form = useAppForm({
    defaultValues: valuesOf(base),
    onSubmit: async ({ value, formApi }) => {
      refusal.clear()
      checks.refuse({})
      try {
        if (base)
          await updateCounterparty(queryClient, base, toChanges(base, value))
        else await createCounterparty(queryClient, toCreateRequest(value))
        onOpenChange(false)
      } catch (error) {
        // The taken tax id is marked on its field; the alert says whose it is.
        if (problemWith(error, "COUNTERPARTY_TAX_ID_TAKEN"))
          checks.refuse({ taxId: "COUNTERPARTY_TAX_ID_TAKEN" })
        refusal.show(formApi, error, formFieldOf)
      }
    },
  })

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        counterparty ? t.counterparties.editTitle : t.counterparties.createTitle
      }
      refusal={refusal.refusal}
      refusalTitle={t.common.saveFailed}
      refusalDetails={<TaxIdTakenBy error={refusal.refusal} />}
      onReload={() => {
        if (!base) return
        void queryClient
          .query({ ...counterpartyQuery(base.id), staleTime: 0 })
          .then((fresh) => {
            setBase(fresh)
            form.reset(valuesOf(fresh))
            refusal.clear()
            checks.refuse({})
          })
      }}
      formRef={refusal.formRef}
      onSubmit={() => form.handleSubmit()}
      submit={
        <form.AppForm>
          <form.SubmitButton
            label={counterparty ? t.common.save : t.common.create}
          />
        </form.AppForm>
      }
    >
      <FormChecksProvider value={checks}>
        <form.AppField
          name="name"
          validators={{
            onChange: createCounterpartyNameCheck,
            onBlur: createCounterpartyNameCheck,
          }}
        >
          {(field) => (
            <field.TextField
              label={t.counterparties.name}
              description={t.counterparties.nameHint}
              required
            />
          )}
        </form.AppField>
        <form.AppField
          name="roles"
          validators={{ onChange: someRole, onBlur: someRole }}
        >
          {(field) => (
            <field.CheckboxListField
              legend={t.counterparties.role}
              description={t.counterparties.roleHint}
              options={[
                { value: "supplier", label: t.counterparties.supplier },
                { value: "customer", label: t.counterparties.customer },
              ]}
            />
          )}
        </form.AppField>
        <form.AppField name="priceType">
          {(field) => (
            <field.SelectField
              label={t.counterparties.priceType}
              description={t.counterparties.priceTypeHint}
              options={priceTypeOptions}
            />
          )}
        </form.AppField>
        <form.AppField
          name="phone"
          validators={{
            onChange: createCounterpartyPhoneCheck,
            onBlur: createCounterpartyPhoneCheck,
          }}
        >
          {(field) => (
            <field.TextField
              label={t.counterparties.phone}
              description={t.common.phoneHint}
              type="tel"
              autoComplete="tel"
            />
          )}
        </form.AppField>
        <form.AppField
          name="taxId"
          validators={{
            onChange: createCounterpartyTaxIdCheck,
            onBlur: createCounterpartyTaxIdCheck,
          }}
        >
          {(field) => (
            <field.TextField
              label={t.counterparties.taxId}
              description={t.counterparties.taxIdHint}
              inputMode="numeric"
              autoComplete="off"
            />
          )}
        </form.AppField>
        <form.AppField
          name="address"
          validators={{
            onChange: createCounterpartyAddressCheck,
            onBlur: createCounterpartyAddressCheck,
          }}
        >
          {(field) => (
            <field.TextField
              label={t.counterparties.address}
              autoComplete="street-address"
            />
          )}
        </form.AppField>
        <form.AppField
          name="note"
          validators={{
            onChange: createCounterpartyNoteCheck,
            onBlur: createCounterpartyNoteCheck,
          }}
        >
          {(field) => <field.TextareaField label={t.counterparties.note} />}
        </form.AppField>
      </FormChecksProvider>
    </FormDialog>
  )
}

/** "305123456 уже указан у контрагента «ООО Paper Line»"; nothing when TradeNet could not name the holder. */
function TaxIdTakenBy({ error }: { error: unknown }) {
  const t = useT()
  const taken = problemWith(error, "COUNTERPARTY_TAX_ID_TAKEN")
  if (!taken?.taxId || !taken.counterparty) return null
  return (
    <p>
      {`${taken.taxId} ${t.counterparties.taxIdTakenBy} «${taken.counterparty.name}»`}
    </p>
  )
}
