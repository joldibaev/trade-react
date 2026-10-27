import { expect, test, type Page } from "@playwright/test"

import { admin, cashier, mockProducts, mockSession } from "./support/api"
import {
  categoryTree,
  mockCategories,
  mockProductWrites,
} from "./support/catalog"

/** The tree is beside the list on a wide screen and behind a button on a phone. */
async function categories(page: Page, isMobile: boolean) {
  if (!isMobile) return page.getByRole("navigation", { name: "Категории" })
  const sheet = page.getByRole("dialog", { name: "Категории" })
  if (!(await sheet.isVisible()))
    await page.getByRole("button", { name: /^Категории:/ }).click()
  return sheet.getByRole("navigation", { name: "Категории" })
}

test("choosing a category filters the list through the address", async ({
  page,
  isMobile,
}) => {
  await mockSession(page, admin)
  await mockCategories(page, categoryTree())
  const requests = await mockProducts(page, { total: 30 })
  await page.goto("/products")
  await expect(
    page.getByRole("cell", { name: "Товар 1", exact: true })
  ).toBeVisible()

  let tree = await categories(page, isMobile)
  await tree.getByRole("button", { name: "Развернуть: Канцелярия" }).click()
  await tree.getByRole("link", { name: "Тетради" }).click()
  await expect(page).toHaveURL(/categoryId=/)
  // On a phone the choice closes the sheet.
  await expect(page.getByRole("dialog", { name: "Категории" })).toBeHidden()
  await expect
    .poll(() => requests.at(-1)?.searchParams.get("categoryId"))
    .toBe(categoryTree()[1]?.id)

  tree = await categories(page, isMobile)
  // The chosen category stays visible: its branch is open and it is marked as the current one.
  await expect(tree.getByRole("link", { name: "Тетради" })).toHaveAttribute(
    "aria-current",
    "page"
  )
  await tree.getByRole("link", { name: "Без категории" }).click()
  await expect
    .poll(() => requests.at(-1)?.searchParams.get("withoutCategory"))
    .toBe("true")
  expect(requests.at(-1)?.searchParams.has("categoryId")).toBe(false)
})

test("categories are added under the chosen one, and a full one is not deleted", async ({
  page,
  isMobile,
}) => {
  await mockSession(page, admin)
  const list = categoryTree()
  const writes = await mockCategories(page, list)
  await mockProducts(page, { total: 5 })
  const office = list[0]
  if (!office) throw new Error("no category")
  await page.goto(`/products?categoryId=${office.id}`)

  let tree = await categories(page, isMobile)
  await tree.getByRole("button", { name: "Новая категория" }).click()
  const dialog = page.getByRole("dialog", { name: "Новая категория" })
  await expect(dialog.getByLabel("Входит в категорию")).toContainText(
    "Канцелярия"
  )
  await dialog.getByLabel("Название").fill("Бумага")
  await dialog.getByRole("button", { name: "Создать" }).click()
  await expect(dialog).toBeHidden()
  expect(writes.find((w) => w.method === "POST")).toEqual({
    method: "POST",
    body: { name: "Бумага", parentId: office.id },
  })

  tree = await categories(page, isMobile)
  await expect(tree.getByRole("link", { name: "Бумага" })).toBeVisible()
  await tree.getByRole("button", { name: "Действия: Канцелярия" }).click()
  await page.getByRole("menuitem", { name: "Удалить категорию" }).click()
  const confirm = page.getByRole("alertdialog")
  await confirm.getByRole("button", { name: "Удалить категорию" }).click()
  await expect(
    confirm.getByText("В категории есть подкатегории или товары", {
      exact: false,
    })
  ).toBeVisible()
})

test("a product is created with a package and a box barcode", async ({
  page,
}) => {
  await mockSession(page, admin)
  await mockCategories(page, categoryTree())
  await mockProducts(page, { total: 5 })
  const sent = await mockProductWrites(page)
  await page.goto("/products")

  await page.getByRole("button", { name: "Новый товар" }).click()
  const dialog = page.getByRole("dialog", { name: "Новый товар" })
  await dialog.getByLabel("Название", { exact: true }).fill("Тетрадь 48 листов")
  await dialog.getByRole("button", { name: "Добавить упаковку" }).click()
  await dialog.getByLabel("Название упаковки").fill("Коробка")
  await dialog.getByLabel("Штук в ней").fill("100")
  await dialog.getByRole("button", { name: "Добавить штрихкод" }).click()
  await dialog.getByLabel("Штрихкод", { exact: true }).fill("4601234567891")
  // A scanner ends with Enter; the half-filled form must not be sent.
  await dialog.getByLabel("Штрихкод", { exact: true }).press("Enter")
  expect(sent).toHaveLength(0)
  await dialog.getByLabel("Что сканируется").click()
  await page.getByRole("option", { name: "Коробка" }).click()
  await dialog.getByRole("button", { name: "Создать" }).click()

  await expect(page).toHaveURL(/\/products\/[0-9a-f-]+$/)
  await expect(
    page.getByRole("heading", { name: "Тетрадь 48 листов" })
  ).toBeVisible()
  expect(sent[0]).toEqual({
    name: "Тетрадь 48 листов",
    categoryId: null,
    packages: [{ name: "Коробка", size: "100" }],
    barcodes: [{ value: "4601234567891", package: "Коробка" }],
  })
})

test("a wrong package size is refused before it is sent", async ({ page }) => {
  await mockSession(page, admin)
  await mockCategories(page, categoryTree())
  await mockProducts(page, { total: 5 })
  const sent = await mockProductWrites(page)
  await page.goto("/products")
  await page.getByRole("button", { name: "Новый товар" }).click()
  const dialog = page.getByRole("dialog", { name: "Новый товар" })
  await dialog.getByLabel("Название", { exact: true }).fill("Ручка")
  await dialog.getByRole("button", { name: "Добавить упаковку" }).click()
  await dialog.getByLabel("Название упаковки").fill("Пачка")
  await dialog.getByLabel("Штук в ней").fill("1,0005")
  await dialog.getByRole("button", { name: "Создать" }).click()
  await expect(dialog.getByText("Неверное значение.")).toBeVisible()
  await expect(dialog.getByLabel("Штук в ней")).toBeFocused()
  expect(sent).toHaveLength(0)
})

test("a cashier reads the catalog but cannot change it", async ({
  page,
  isMobile,
}) => {
  await mockSession(page, cashier)
  await mockCategories(page, categoryTree())
  await mockProducts(page, { total: 5 })
  await page.goto("/products")
  await expect(
    page.getByRole("cell", { name: "Товар 1", exact: true })
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "Новый товар" })).toHaveCount(0)
  const tree = await categories(page, isMobile)
  await expect(tree.getByRole("link", { name: "Канцелярия" })).toBeVisible()
  await expect(
    tree.getByRole("button", { name: "Новая категория" })
  ).toHaveCount(0)
  await expect(tree.getByRole("button", { name: /^Действия:/ })).toHaveCount(0)
})

test("a barcode naming a removed package is stopped before it is sent", async ({
  page,
}) => {
  await mockSession(page, admin)
  await mockCategories(page, categoryTree())
  await mockProducts(page, { total: 5 })
  const sent = await mockProductWrites(page)
  await page.goto("/products")
  await page.getByRole("button", { name: "Новый товар" }).click()
  const dialog = page.getByRole("dialog", { name: "Новый товар" })
  await dialog.getByLabel("Название", { exact: true }).fill("Тетрадь")
  await dialog.getByRole("button", { name: "Добавить упаковку" }).click()
  await dialog.getByLabel("Название упаковки").fill("Коробка")
  await dialog.getByLabel("Штук в ней").fill("100")
  await dialog.getByRole("button", { name: "Добавить штрихкод" }).click()
  await dialog.getByLabel("Штрихкод", { exact: true }).fill("4601234567891")
  await dialog.getByLabel("Что сканируется").click()
  await page.getByRole("option", { name: "Коробка" }).click()
  await dialog.getByRole("button", { name: "Убрать упаковку 1" }).click()
  await dialog.getByRole("button", { name: "Создать" }).click()

  await expect(dialog.getByText("Неверное значение.")).toBeVisible()
  await page.waitForTimeout(500)
  await expect(dialog.getByText("Неверное значение.")).toBeVisible()
  await expect(dialog.getByLabel("Что сканируется")).toBeFocused()
  expect(sent).toHaveLength(0)
})

test("a barcode another product has is marked on its line, with whose it is", async ({
  page,
}) => {
  await mockSession(page, admin)
  await mockCategories(page, categoryTree())
  await mockProducts(page, { total: 5 })
  await mockProductWrites(page, [], {
    "4780000000017": { id: "x", code: 10007, name: "Ручка синяя" },
  })
  await page.goto("/products")
  await page.getByRole("button", { name: "Новый товар" }).click()
  const dialog = page.getByRole("dialog", { name: "Новый товар" })
  await dialog.getByLabel("Название", { exact: true }).fill("Ручка")
  await dialog.getByRole("button", { name: "Добавить штрихкод" }).click()
  await dialog.getByRole("button", { name: "Добавить штрихкод" }).click()
  const barcodes = dialog.getByLabel("Штрихкод", { exact: true })
  await barcodes.nth(0).fill("4780000000024")
  await barcodes.nth(1).fill("4780000000017")
  await dialog.getByRole("button", { name: "Создать" }).click()

  await expect(
    dialog.getByText("4780000000017 уже у товара 10007 «Ручка синяя»")
  ).toBeVisible()
  await expect(barcodes.nth(1)).toHaveAttribute("aria-invalid", "true")
  await expect(barcodes.nth(0)).toHaveAttribute("aria-invalid", "false")
  await expect(dialog.locator('[id="barcodes[1].value-error"]')).toHaveText(
    "Этот штрихкод уже у другого товара."
  )
})
