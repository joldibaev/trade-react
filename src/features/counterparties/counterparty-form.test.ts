import { describe, expect, it } from "vitest"

import type { Counterparty } from "./counterparties-api"
import {
  formFieldOf,
  noPriceType,
  toChanges,
  toCreateRequest,
  valuesOf,
} from "./counterparty-form"

const saved: Counterparty = {
  id: "0199b2c4-1d2e-7a00-8000-000000000001",
  name: "Азиз опт",
  isSupplier: false,
  isCustomer: true,
  priceTypeId: "0199a000-0000-7000-8000-000000000002",
  phone: "+998901234567",
  taxId: "123456789",
  address: "Ташкент, Чиланзар 5",
  note: "Звонить после 10:00\nСклад во дворе",
  isActive: true,
  version: 1234,
}

describe("toCreateRequest", () => {
  it("sends empty optional texts and no price type as null, texts trimmed", () => {
    expect(
      toCreateRequest({
        ...valuesOf(undefined),
        name: "  Сарвар канцтовары ",
        roles: ["supplier", "customer"],
        note: " \n",
      })
    ).toEqual({
      name: "Сарвар канцтовары",
      isSupplier: true,
      isCustomer: true,
      priceTypeId: null,
      phone: null,
      taxId: null,
      address: null,
      note: null,
    })
  })
})

describe("toChanges", () => {
  it("sends nothing when nothing changed", () => {
    expect(toChanges(saved, valuesOf(saved))).toEqual({})
  })

  it("sends only the changed fields: an emptied text as an empty string, a removed price type as id null", () => {
    expect(
      toChanges(saved, {
        ...valuesOf(saved),
        roles: ["supplier"],
        priceType: noPriceType,
        note: "",
        address: " Ташкент, Чиланзар 5 ",
      })
    ).toEqual({
      isSupplier: true,
      isCustomer: false,
      priceType: { id: null },
      note: "",
    })
  })

  it("sets a price type the counterparty did not have", () => {
    const without = { ...saved, priceTypeId: null }
    expect(
      toChanges(without, { ...valuesOf(without), priceType: "pt-2" })
    ).toEqual({ priceType: { id: "pt-2" } })
  })

  it("keeps the line breaks inside a note", () => {
    expect(
      toChanges(saved, {
        ...valuesOf(saved),
        note: "Склад во дворе\nВорота 2\n",
      })
    ).toEqual({ note: "Склад во дворе\nВорота 2" })
  })
})

describe("formFieldOf", () => {
  it("puts the server's role rule under the roles field, other keys as they are", () => {
    expect(formFieldOf("isCustomer")).toBe("roles")
    expect(formFieldOf("isSupplier")).toBe("roles")
    expect(formFieldOf("taxId")).toBe("taxId")
  })
})
