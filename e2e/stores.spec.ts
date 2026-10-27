import { expect, test } from "@playwright/test"

import { admin, cashier, manager, mockSession } from "./support/api"
import { mockStores, store } from "./support/stores"

const chain = () => [
  store(1, "Склад"),
  store(2, "Чиланзар", ["Касса 1", "Касса 2"]),
  store(3, "Юнусабад", ["Касса 1"]),
]

test("an admin opens a store and lands on its page", async ({ page }) => {
  await mockSession(page, admin)
  await mockStores(page, chain())
  await page.goto("/stores")
  await expect(
    page.getByRole("cell", { name: "Чиланзар", exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole("cell", { name: "2 / 2", exact: true })
  ).toBeVisible()

  await page.getByRole("button", { name: "Новый магазин" }).click()
  const dialog = page.getByRole("dialog", { name: "Новый магазин" })
  await dialog.getByRole("button", { name: "Создать" }).click()
  // Refused on the client: the error is under the field and the field has focus.
  await expect(dialog.getByText("Заполните поле.")).toBeVisible()
  await expect(dialog.getByLabel("Название")).toBeFocused()

  await dialog.getByLabel("Название").fill("Сергели")
  await dialog.getByLabel("Телефон").fill("+998712000103")
  await dialog.getByRole("button", { name: "Создать" }).click()

  await expect(page).toHaveURL(/\/stores\/[0-9a-f-]+$/)
  await expect(page.getByRole("heading", { name: "Сергели" })).toBeVisible()
  await expect(page.getByText("+998712000103")).toBeVisible()
})

test("cashboxes: a taken name is refused, a new one appears, one is switched off", async ({
  page,
}) => {
  await mockSession(page, admin)
  const stores = await mockStores(page, chain())
  await page.goto(`/stores/${stores[1]?.id ?? ""}`)
  await expect(
    page.getByRole("cell", { name: "Касса 2", exact: true })
  ).toBeVisible()

  await page.getByRole("button", { name: "Добавить кассу" }).click()
  const dialog = page.getByRole("dialog", { name: "Новая касса" })
  await dialog.getByLabel("Название кассы").fill("касса 1")
  await dialog.getByRole("button", { name: "Создать" }).click()
  await expect(
    dialog.getByText("Касса с таким названием уже есть.")
  ).toBeVisible()
  await dialog.getByLabel("Название кассы").fill("Касса 3")
  await dialog.getByRole("button", { name: "Создать" }).click()
  await expect(dialog).toBeHidden()
  await expect(
    page.getByRole("cell", { name: "Касса 3", exact: true })
  ).toBeVisible()

  await page.getByRole("button", { name: "Действия: Касса 1" }).click()
  await page.getByRole("menuitem", { name: "Отключить кассу" }).click()
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Отключить кассу" })
    .click()
  await expect(
    page.getByRole("row", { name: /Касса 1/ }).getByText("Отключена")
  ).toBeVisible()
})

test("a store with a cashbox is not deleted; without it, it is, and its page closes", async ({
  page,
}) => {
  await mockSession(page, admin)
  const stores = await mockStores(page, chain())
  await page.goto(`/stores/${stores[2]?.id ?? ""}`)
  const confirm = page.getByRole("alertdialog")

  await page.getByRole("button", { name: "Удалить магазин" }).click()
  await confirm.getByRole("button", { name: "Удалить магазин" }).click()
  await expect(
    confirm.getByText(
      "У магазина есть кассы. Сначала удалите их или закройте магазин."
    )
  ).toBeVisible()
  await confirm.getByRole("button", { name: "Отмена" }).click()

  await page.getByRole("button", { name: "Действия: Касса 1" }).click()
  await page.getByRole("menuitem", { name: "Удалить кассу" }).click()
  await confirm.getByRole("button", { name: "Удалить кассу" }).click()
  await expect(page.getByText("Касс нет.")).toBeVisible()

  await page.getByRole("button", { name: "Удалить магазин" }).click()
  await confirm.getByRole("button", { name: "Удалить магазин" }).click()
  await expect(page).toHaveURL(/\/stores$/)
  await expect(
    page.getByRole("cell", { name: "Чиланзар", exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole("cell", { name: "Юнусабад", exact: true })
  ).toHaveCount(0)
})

test("an edit over someone else's change keeps the person's text until they reload", async ({
  page,
}) => {
  await mockSession(page, admin)
  const stores = await mockStores(page, chain())
  await page.goto("/stores")
  await page.getByRole("button", { name: "Действия: Юнусабад" }).click()
  await page.getByRole("menuitem", { name: "Изменить" }).click()
  const dialog = page.getByRole("dialog", { name: "Изменить магазин" })
  await dialog.getByLabel("Адрес").fill("Мой адрес")

  // Meanwhile someone else renames the store.
  const target = stores[2]
  if (!target) throw new Error("no store")
  target.name = "Юнусабад-2"
  target.version += 1

  await dialog.getByRole("button", { name: "Сохранить" }).click()
  await expect(
    dialog.getByText("Данные изменил кто-то другой. Обновите и повторите.")
  ).toBeVisible()
  await expect(dialog.getByLabel("Адрес")).toHaveValue("Мой адрес")

  await dialog
    .getByRole("button", { name: "Загрузить актуальные данные" })
    .click()
  await expect(dialog.getByLabel("Название")).toHaveValue("Юнусабад-2")
  await dialog.getByLabel("Адрес").fill("Мой адрес")
  await dialog.getByRole("button", { name: "Сохранить" }).click()
  await expect(dialog).toBeHidden()
  await expect(
    page.getByRole("cell", { name: "Мой адрес", exact: true })
  ).toBeVisible()
})

test("a manager bound to some stores edits them but neither opens nor closes a store", async ({
  page,
}) => {
  await mockSession(page, manager)
  await mockStores(page, chain())
  await page.goto("/stores")
  await expect(
    page.getByRole("cell", { name: "Юнусабад", exact: true })
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "Новый магазин" })).toHaveCount(
    0
  )
  await page.getByRole("button", { name: "Действия: Юнусабад" }).click()
  await expect(page.getByRole("menuitem", { name: "Изменить" })).toBeVisible()
  await expect(
    page.getByRole("menuitem", { name: "Закрыть магазин" })
  ).toHaveCount(0)
  await expect(
    page.getByRole("menuitem", { name: "Удалить магазин" })
  ).toHaveCount(0)
})

test("a cashier sees the stores but no way to change them", async ({
  page,
}) => {
  await mockSession(page, cashier)
  await mockStores(page, chain())
  await page.goto("/stores")
  await expect(
    page.getByRole("cell", { name: "Чиланзар", exact: true })
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "Новый магазин" })).toHaveCount(
    0
  )
  await expect(page.getByRole("button", { name: /^Действия:/ })).toHaveCount(0)
})

test("the status filter lives in the address", async ({ page }) => {
  await mockSession(page, admin)
  const stores = chain()
  const closed = stores[0]
  if (closed) closed.isActive = false
  await mockStores(page, stores)
  await page.goto("/stores")
  await page.getByRole("button", { name: "Неактивные" }).click()
  await expect(page).toHaveURL(/status=inactive/)
  await expect(
    page.getByRole("cell", { name: "Склад", exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole("cell", { name: "Чиланзар", exact: true })
  ).toHaveCount(0)

  await page.goBack()
  await expect(
    page.getByRole("cell", { name: "Чиланзар", exact: true })
  ).toBeVisible()
})
