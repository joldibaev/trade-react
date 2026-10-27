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

test("signing out that fails says so, and works on the next try", async ({
  page,
  isMobile,
}) => {
  let reachable = false
  await page.route("**/api/auth/sessions/current", (route) =>
    reachable ? route.fulfill({ status: 204 }) : route.abort()
  )
  await page.goto("/products")
  if (isMobile) await page.getByRole("button", { name: "Открыть меню" }).click()

  await page.getByRole("button", { name: "Выйти" }).click()
  await expect(page.getByText("Не удалось выйти")).toBeVisible()
  await expect(page.getByText("Нет связи с сервером.")).toBeVisible()
  await expect(page).toHaveURL(/\/products/)

  reachable = true
  await page.getByRole("button", { name: "Выйти" }).click()
  await expect(page).toHaveURL(/\/login/)
})
