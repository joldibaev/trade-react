import type { components } from "@/api/schema"
import { changedFields } from "@/lib/changes"

import type {
  Counterparty,
  CounterpartyChanges,
  CounterpartyRole,
} from "./counterparties-api"

/** The select value for "no price type": a select item needs a non-empty value. */
export const noPriceType = "none"

export type CounterpartyValues = {
  name: string
  /** Supplier, customer or both, as one field: the rule "at least one" is about the two together. */
  roles: CounterpartyRole[]
  priceType: string
  phone: string
  taxId: string
  address: string
  note: string
}

export function valuesOf(
  counterparty: Counterparty | undefined
): CounterpartyValues {
  return {
    name: counterparty?.name ?? "",
    roles: counterparty
      ? [
          ...(counterparty.isSupplier ? ["supplier" as const] : []),
          ...(counterparty.isCustomer ? ["customer" as const] : []),
        ]
      : [],
    priceType: counterparty?.priceTypeId ?? noPriceType,
    phone: counterparty?.phone ?? "",
    taxId: counterparty?.taxId ?? "",
    address: counterparty?.address ?? "",
    note: counterparty?.note ?? "",
  }
}

/** The texts as the API takes them: no spaces around (TradeNet refuses them), line breaks inside a note kept. */
function texts(values: CounterpartyValues) {
  return {
    name: values.name.trim(),
    phone: values.phone.trim(),
    taxId: values.taxId.trim(),
    address: values.address.trim(),
    note: values.note.trim(),
  }
}

const priceTypeIdOf = (value: string) => (value === noPriceType ? null : value)

export function toCreateRequest(
  values: CounterpartyValues
): components["schemas"]["CreateCounterpartyRequest"] {
  const { name, phone, taxId, address, note } = texts(values)
  return {
    name,
    isSupplier: values.roles.includes("supplier"),
    isCustomer: values.roles.includes("customer"),
    priceTypeId: priceTypeIdOf(values.priceType),
    phone: phone || null,
    taxId: taxId || null,
    address: address || null,
    note: note || null,
  }
}

/**
 * Only what the person changed, so an edit never overwrites someone else's change to another field. An emptied
 * text is `""`, which removes it; a removed price type is `{id: null}` (TradeNet counterparties contract).
 */
export function toChanges(
  before: Counterparty,
  values: CounterpartyValues
): CounterpartyChanges {
  const isSupplier = values.roles.includes("supplier")
  const isCustomer = values.roles.includes("customer")
  const priceTypeId = priceTypeIdOf(values.priceType)
  return {
    ...changedFields(texts(valuesOf(before)), texts(values)),
    ...(isSupplier !== before.isSupplier && { isSupplier }),
    ...(isCustomer !== before.isCustomer && { isCustomer }),
    ...(priceTypeId !== before.priceTypeId && {
      priceType: { id: priceTypeId },
    }),
  }
}

/** The server names the rule "at least one role" after `isCustomer`; the form shows it under both checkboxes. */
export function formFieldOf(key: string) {
  return key.toLowerCase() === "iscustomer" ||
    key.toLowerCase() === "issupplier"
    ? "roles"
    : key
}
