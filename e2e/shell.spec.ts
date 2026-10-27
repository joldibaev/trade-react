import { expect, test } from "@playwright/test"

import { admin, mockProducts, mockSession } from "./support/api"
import { categoryTree, mockCategories } from "./support/catalog"

test.beforeEach(async ({ page }) => {
  await mockSession(page, admin)
  await mockCategories(page, categoryTree())
  await mockProducts(page, { total: 50 })
})

test("the list fills the screen and scrolls inside its table, not the page", async ({
  page,
}) => {
  await page.goto("/products")
  await expect(
    page.getByRole("cell", { name: "Товар 1", exact: true })
  ).toBeVisible()

  const pageScrolls = await page.evaluate(
    () => document.documentElement.scrollHeight > window.innerHeight
  )
  expect(pageScrolls).toBe(false)
  // A details page may scroll inside the layout; a list page must not, its table does.
  const mainScrolls = await page
    .locator("main")
    .evaluate((main) => main.scrollHeight > main.clientHeight)
  expect(mainScrolls).toBe(false)
})

test("on a phone the menu is a sheet behind a button", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "phone layout only")
  await page.goto("/products")

  await expect(page.getByRole("link", { name: "Товары" })).toBeHidden()
  await page.getByRole("button", { name: "Открыть меню" }).click()
  await expect(page.getByRole("dialog", { name: "Разделы" })).toBeVisible()
  await page.getByRole("link", { name: "Товары" }).click()
  await expect(page.getByRole("dialog", { name: "Разделы" })).toBeHidden()
})
