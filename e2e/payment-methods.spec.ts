import { expect, test } from "@playwright/test"

import { admin, mockSession, uuid } from "./support/api"
import { mockPaymentMethods, paymentMethods } from "./support/payment-methods"

test.beforeEach(async ({ page }) => {
  await mockSession(page, admin)
})

test("a method is created with the cash mark; a taken name is refused in any case", async ({
  page,
}) => {
  const sent = await mockPaymentMethods(page, paymentMethods())
  await page.goto("/payment-methods")
  await expect(
    page
      .getByRole("row", { name: /Наличные/ })
      .getByText("Наличные")
      .nth(1)
  ).toBeVisible()

  await page.getByRole("button", { name: "Новый способ оплаты" }).click()
  const dialog = page.getByRole("dialog", { name: "Новый способ оплаты" })
  await dialog.getByLabel("Название").fill("карта")
  await dialog.getByRole("button", { name: "Создать" }).click()
  await expect(
    dialog.getByText("Способ оплаты с таким названием уже есть.")
  ).toBeVisible()

  await dialog.getByLabel("Название").fill("Click")
  await dialog.getByRole("checkbox", { name: "Наличные" }).check()
  await dialog.getByRole("button", { name: "Создать" }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole("row", { name: /Click.*Наличные/ })).toBeVisible()
  expect(sent.at(-1)).toEqual({
    method: "POST",
    body: { name: "Click", isCash: true },
  })
})

test("an edit over someone else's change keeps the person's text until they reload", async ({
  page,
}) => {
  const methods = paymentMethods()
  const sent = await mockPaymentMethods(page, methods)
  await page.goto("/payment-methods")
  await page.getByRole("button", { name: "Действия: Карта" }).click()
  await page.getByRole("menuitem", { name: "Изменить" }).click()
  const dialog = page.getByRole("dialog", { name: "Изменить способ оплаты" })
  await dialog.getByLabel("Название").fill("Банковская карта")

  // Meanwhile someone else turns the method into cash.
  const target = methods[1]
  if (!target) throw new Error("no method")
  target.isCash = true
  target.version += 1

  await dialog.getByRole("button", { name: "Сохранить" }).click()
  await expect(
    dialog.getByText("Данные изменил кто-то другой. Обновите и повторите.")
  ).toBeVisible()
  await expect(dialog.getByLabel("Название")).toHaveValue("Банковская карта")

  await dialog
    .getByRole("button", { name: "Загрузить актуальные данные" })
    .click()
  await expect(dialog.getByLabel("Название")).toHaveValue("Карта")
  await expect(dialog.getByRole("checkbox", { name: "Наличные" })).toBeChecked()
  await dialog.getByLabel("Название").fill("Банковская карта")
  await dialog.getByRole("button", { name: "Сохранить" }).click()
  await expect(dialog).toBeHidden()
  // Only what changed travels, with the version that was read last.
  expect(sent.at(-1)).toEqual({
    method: "PATCH",
    body: { version: 2, name: "Банковская карта" },
  })
})

test("a method is switched off and on, and deleted after asking", async ({
  page,
}) => {
  const methods = paymentMethods()
  const sent = await mockPaymentMethods(page, methods)
  await page.goto("/payment-methods")
  const confirm = page.getByRole("alertdialog")

  await page.getByRole("button", { name: "Действия: Карта" }).click()
  await page.getByRole("menuitem", { name: "Отключить" }).click()
  await confirm.getByRole("button", { name: "Отключить" }).click()
  await expect(confirm).toBeHidden()
  expect(sent.at(-1)).toEqual({
    method: "PATCH",
    body: { version: 1, isActive: false },
  })
  await expect(page.getByRole("row", { name: /Карта/ })).toContainText(
    "Отключён"
  )

  await page.getByRole("button", { name: "Действия: Карта" }).click()
  await page.getByRole("menuitem", { name: "Включить" }).click()
  await confirm.getByRole("button", { name: "Включить" }).click()
  await expect(page.getByRole("row", { name: /Карта/ })).toContainText(
    "Действует"
  )

  await page.getByRole("button", { name: "Действия: Карта" }).click()
  await page.getByRole("menuitem", { name: "Удалить" }).click()
  await confirm.getByRole("button", { name: "Удалить" }).click()
  await expect(
    page.getByRole("cell", { name: "Карта", exact: true })
  ).toHaveCount(0)
  expect(sent.at(-1)).toEqual({
    method: "DELETE",
    body: { id: uuid(5002), version: "3" },
  })
})

test("without the permission the list is read only", async ({ page }) => {
  await mockSession(page, { ...admin, permissions: ["STORES_MANAGE"] })
  await mockPaymentMethods(page, paymentMethods())
  await page.goto("/payment-methods")
  await expect(
    page.getByRole("cell", { name: "Карта", exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Новый способ оплаты" })
  ).toHaveCount(0)
  await expect(page.getByRole("button", { name: /^Действия/ })).toHaveCount(0)
})
