import { expect, test, type Page } from "@playwright/test"

import { admin, cashier, mockSession, uuid } from "./support/api"
import { counterparty, mockCounterparties } from "./support/counterparties"
import { mockPriceTypes, priceTypes } from "./support/prices"

const wholesale = uuid(4002)

const directory = () => [
  counterparty(1, "Азиз опт", {
    isSupplier: false,
    isCustomer: true,
    priceTypeId: wholesale,
    phone: "+998901234567",
    taxId: "123456789",
    note: "Звонить после 10:00\nСклад во дворе",
  }),
  counterparty(2, "Сарвар канцтовары", {
    isSupplier: true,
    isCustomer: true,
  }),
  counterparty(3, "Старый поставщик", {
    isSupplier: true,
    isCustomer: false,
    isActive: false,
  }),
]

/** Signed in as `me`, with the chain's price types (mocked after the session, whose catch-all would answer 404). */
async function signIn(page: Page, me: typeof admin) {
  await mockSession(page, me)
  await mockPriceTypes(page, priceTypes())
}

test("the list shows roles, a readable phone and the price type; filters live in the address", async ({
  page,
}) => {
  await signIn(page, admin)
  const { queries } = await mockCounterparties(page, directory())
  await page.goto("/counterparties")

  const aziz = page.getByRole("row", { name: /Азиз опт/ })
  await expect(
    aziz.getByRole("cell", { name: "Клиент", exact: true })
  ).toBeVisible()
  // Grouped with no-break spaces, as people dictate a number.
  await expect(aziz.getByText(/^\+998\s90\s123\s45\s67$/)).toBeVisible()
  await expect(
    aziz.getByRole("cell", { name: "Опт", exact: true })
  ).toBeVisible()
  await expect(
    page
      .getByRole("row", { name: /Сарвар канцтовары/ })
      .getByRole("cell", { name: "Поставщик, Клиент", exact: true })
  ).toBeVisible()

  await page.getByRole("button", { name: "Поставщики" }).click()
  await expect(page).toHaveURL(/role=supplier/)
  await expect(page.getByRole("row", { name: /Азиз опт/ })).toHaveCount(0)
  await expect(
    page.getByRole("row", { name: /Старый поставщик/ })
  ).toBeVisible()
  expect(queries.at(-1)?.get("role")).toBe("SUPPLIER")

  await page.getByRole("button", { name: "Неактивные" }).click()
  await expect(page).toHaveURL(/status=inactive/)
  await expect(
    page.getByRole("row", { name: /Сарвар канцтовары/ })
  ).toHaveCount(0)
  expect(queries.at(-1)?.get("isActive")).toBe("false")

  await page.goBack()
  await page.goBack()
  await expect(page.getByRole("row", { name: /Азиз опт/ })).toBeVisible()

  const search = page.getByRole("searchbox", {
    name: "Название, телефон или ИНН",
  })
  await search.fill("123456789")
  await search.press("Enter")
  await expect(page).toHaveURL(/search=(%22)?123456789/)
  await expect(
    page.getByRole("row", { name: /Сарвар канцтовары/ })
  ).toHaveCount(0)
  await expect(page.getByRole("row", { name: /Азиз опт/ })).toBeVisible()
  expect(queries.at(-1)?.get("search")).toBe("123456789")
  expect(queries.at(-1)?.has("cursor")).toBe(false)

  // A shared link with bare digits (the router reads them as a number) still searches.
  await page.goto("/counterparties?search=901234567")
  await expect(search).toHaveValue("901234567")
  await expect.poll(() => queries.at(-1)?.get("search")).toBe("901234567")
})

test("a new counterparty needs a role, and the server's field codes show under their fields", async ({
  page,
}) => {
  await signIn(page, admin)
  const { writes } = await mockCounterparties(page, directory())
  await page.goto("/counterparties")

  await page.getByRole("button", { name: "Новый контрагент" }).click()
  const dialog = page.getByRole("dialog", { name: "Новый контрагент" })
  await dialog.getByLabel("Название").fill("Бахром мебель")
  await dialog.getByRole("button", { name: "Создать" }).click()
  // Refused on the client: neither supplier nor client; focus lands on the first box.
  await expect(dialog.getByText("Заполните поле.")).toBeVisible()
  await expect(
    dialog.getByRole("checkbox", { name: "Поставщик" })
  ).toBeFocused()
  expect(writes).toEqual([])

  await dialog.getByRole("checkbox", { name: "Поставщик" }).click()
  await expect(dialog.getByText("Заполните поле.")).toHaveCount(0)
  await dialog.getByLabel("ИНН / ПИНФЛ").fill("12345")
  await dialog.getByRole("button", { name: "Создать" }).click()
  await expect(dialog.getByText("Неверный формат.")).toBeVisible()
  await expect(dialog.getByLabel("ИНН / ПИНФЛ")).toBeFocused()

  await dialog.getByLabel("ИНН / ПИНФЛ").fill("98765432101234")
  await dialog.getByLabel("Телефон").fill("+998712000103")
  await dialog.getByRole("combobox", { name: "Тип цены" }).click()
  await page.getByRole("option", { name: "Опт" }).click()
  await dialog.getByLabel("Примечание").fill("Склад во дворе\nВорота 2")
  await dialog.getByRole("button", { name: "Создать" }).click()
  await expect(dialog).toBeHidden()

  expect(writes.at(-1)?.body).toEqual({
    name: "Бахром мебель",
    isSupplier: true,
    isCustomer: false,
    priceTypeId: wholesale,
    phone: "+998712000103",
    taxId: "98765432101234",
    address: null,
    note: "Склад во дворе\nВорота 2",
  })
  await expect(page.getByRole("row", { name: /Бахром мебель/ })).toBeVisible()
})

test("a taken name is refused by its code", async ({ page }) => {
  await signIn(page, admin)
  await mockCounterparties(page, directory())
  await page.goto("/counterparties")

  await page.getByRole("button", { name: "Новый контрагент" }).click()
  const dialog = page.getByRole("dialog", { name: "Новый контрагент" })
  await dialog.getByLabel("Название").fill("азиз опт")
  await dialog.getByRole("checkbox", { name: "Клиент" }).click()
  await dialog.getByRole("button", { name: "Создать" }).click()
  await expect(
    dialog.getByText(
      "Контрагент с таким названием уже есть (может быть, отключённый)."
    )
  ).toBeVisible()
})

test("an edit sends only the changed fields with its version", async ({
  page,
}) => {
  await signIn(page, admin)
  const { writes } = await mockCounterparties(page, directory())
  await page.goto("/counterparties")

  await page.getByRole("button", { name: "Действия: Азиз опт" }).click()
  await page.getByRole("menuitem", { name: "Изменить" }).click()
  const dialog = page.getByRole("dialog", { name: "Изменить контрагента" })
  await expect(dialog.getByLabel("Примечание")).toHaveValue(
    "Звонить после 10:00\nСклад во дворе"
  )
  await dialog.getByRole("checkbox", { name: "Поставщик" }).click()
  await dialog.getByRole("combobox", { name: "Тип цены" }).click()
  await page.getByRole("option", { name: "Не выбран" }).click()
  await dialog.getByLabel("Примечание").fill("")
  await dialog.getByRole("button", { name: "Сохранить" }).click()
  await expect(dialog).toBeHidden()

  expect(writes).toEqual([
    {
      method: "PATCH",
      path: `/api/counterparties/${uuid(6001)}`,
      body: {
        version: 1,
        isSupplier: true,
        priceType: { id: null },
        note: "",
      },
    },
  ])
  const row = page.getByRole("row", { name: /Азиз опт/ })
  await expect(
    row.getByRole("cell", { name: "Поставщик, Клиент", exact: true })
  ).toBeVisible()
  await expect(row.getByRole("cell", { name: "Опт", exact: true })).toHaveCount(
    0
  )
})

test("deactivating and deleting ask first; a delete sends the version", async ({
  page,
}) => {
  await signIn(page, admin)
  const { writes } = await mockCounterparties(page, directory())
  await page.goto("/counterparties")
  const confirm = page.getByRole("alertdialog")

  await page
    .getByRole("button", { name: "Действия: Сарвар канцтовары" })
    .click()
  await page.getByRole("menuitem", { name: "Отключить" }).click()
  await confirm.getByRole("button", { name: "Отключить" }).click()
  await expect(
    page.getByRole("row", { name: /Сарвар канцтовары/ }).getByText("Неактивен")
  ).toBeVisible()

  await page
    .getByRole("button", { name: "Действия: Сарвар канцтовары" })
    .click()
  await page.getByRole("menuitem", { name: "Удалить" }).click()
  await confirm.getByRole("button", { name: "Удалить" }).click()
  await expect(
    page.getByRole("row", { name: /Сарвар канцтовары/ })
  ).toHaveCount(0)

  expect(writes.map((w) => [w.method, w.path, w.body])).toEqual([
    [
      "PATCH",
      `/api/counterparties/${uuid(6002)}`,
      { version: 1, isActive: false },
    ],
    ["DELETE", `/api/counterparties/${uuid(6002)}?version=2`, {}],
  ])
})

test("a cashier reads the counterparties but has no way to change them", async ({
  page,
}) => {
  await signIn(page, cashier)
  await mockCounterparties(page, directory())
  await page.goto("/counterparties")
  await expect(page.getByRole("row", { name: /Азиз опт/ })).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Новый контрагент" })
  ).toHaveCount(0)
  await expect(page.getByRole("button", { name: /^Действия:/ })).toHaveCount(0)
})

test("an edit over someone else's change keeps the person's text until they reload", async ({
  page,
}) => {
  await signIn(page, admin)
  const list = directory()
  await mockCounterparties(page, list)
  await page.goto("/counterparties")
  await page.getByRole("button", { name: "Действия: Азиз опт" }).click()
  await page.getByRole("menuitem", { name: "Изменить" }).click()
  const dialog = page.getByRole("dialog", { name: "Изменить контрагента" })
  await dialog.getByLabel("Адрес").fill("Ташкент, Юнусабад 7")

  // Meanwhile someone else removes the price type.
  const target = list[0]
  if (!target) throw new Error("no counterparty")
  target.priceTypeId = null
  target.version += 1

  await dialog.getByRole("button", { name: "Сохранить" }).click()
  await expect(
    dialog.getByText("Данные изменил кто-то другой. Обновите и повторите.")
  ).toBeVisible()
  await expect(dialog.getByLabel("Адрес")).toHaveValue("Ташкент, Юнусабад 7")

  await dialog
    .getByRole("button", { name: "Загрузить актуальные данные" })
    .click()
  await expect(
    dialog.getByRole("combobox", { name: "Тип цены" })
  ).toContainText("Не выбран")
  await expect(dialog.getByLabel("Адрес")).toHaveValue("")
  await dialog.getByLabel("Адрес").fill("Ташкент, Юнусабад 7")
  await dialog.getByRole("button", { name: "Сохранить" }).click()
  await expect(dialog).toBeHidden()
  await expect(
    page.getByRole("row", { name: /Азиз опт/ }).getByRole("cell", {
      name: "Опт",
      exact: true,
    })
  ).toHaveCount(0)
})

test("a taken tax id is marked on its field, and the alert names its holder", async ({
  page,
}) => {
  await signIn(page, admin)
  await mockCounterparties(page, directory())
  await page.goto("/counterparties")

  await page
    .getByRole("button", { name: "Действия: Сарвар канцтовары" })
    .click()
  await page.getByRole("menuitem", { name: "Изменить" }).click()
  const dialog = page.getByRole("dialog", { name: "Изменить контрагента" })
  await dialog.getByLabel("ИНН / ПИНФЛ").fill("123456789")
  await dialog.getByRole("button", { name: "Сохранить" }).click()
  await expect(
    dialog.getByText("123456789 уже указан у контрагента «Азиз опт»")
  ).toBeVisible()
  const taxId = dialog.getByLabel("ИНН / ПИНФЛ")
  await expect(taxId).toBeFocused()
  await expect(taxId).toHaveAttribute("aria-invalid", "true")
  // The field's own error, besides the alert's text for the code.
  await expect(
    dialog.getByText("Этот ИНН или ПИНФЛ уже у другого контрагента.")
  ).toHaveCount(2)

  await taxId.fill("305123456")
  await expect(taxId).toHaveAttribute("aria-invalid", "false")
  await dialog.getByRole("button", { name: "Сохранить" }).click()
  await expect(dialog).toBeHidden()
})

test("a price type chosen by counterparties is not deleted; the refusal names them", async ({
  page,
}) => {
  await signIn(page, admin)
  await page.route(/\/api\/price-types\/[^/?]+\?version=/, (route) =>
    route.request().method() === "DELETE"
      ? route.fulfill({
          status: 409,
          contentType: "application/problem+json",
          json: {
            title: "x",
            status: 409,
            code: "PRICE_TYPE_HAS_COUNTERPARTIES",
            traceId: "t",
            counterparties: [
              { id: uuid(6001), name: "Азиз опт" },
              { id: uuid(6002), name: "Сарвар канцтовары" },
            ],
          },
        })
      : route.fallback()
  )
  await page.goto("/price-types")

  await page.getByRole("button", { name: "Действия: Опт" }).click()
  await page.getByRole("menuitem", { name: "Удалить" }).click()
  const confirm = page.getByRole("alertdialog")
  await confirm.getByRole("button", { name: "Удалить" }).click()
  await expect(
    confirm.getByText(
      "Тип цены выбран у контрагентов. Измените их или отключите тип."
    )
  ).toBeVisible()
  await expect(
    confirm.getByText("Тип выбран у контрагентов: Азиз опт, Сарвар канцтовары")
  ).toBeVisible()
})
