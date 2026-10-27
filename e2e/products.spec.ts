import { expect, test } from "@playwright/test"

import { admin, mockProducts, mockSession } from "./support/api"
import { categoryTree, mockCategories } from "./support/catalog"

test.beforeEach(async ({ page }) => {
  await mockSession(page, admin)
  await mockCategories(page, categoryTree())
})

test("scrolls through 10,000 products, rendering only the rows in view", async ({
  page,
}) => {
  await mockProducts(page, { total: 10_000 })
  await page.goto("/products")

  const list = page.getByRole("region", { name: "Товары" })
  await expect(
    page.getByRole("cell", { name: "Товар 1", exact: true })
  ).toBeVisible()

  // DataTable positions rows by one fixed height (44px); a style that changes it would make scrolling drift.
  const heights = await page
    .locator("tbody tr[aria-rowindex]")
    .evaluateAll((rows) =>
      rows.map((row) => row.getBoundingClientRect().height)
    )
  expect(new Set(heights)).toEqual(new Set([44]))

  const last = page.getByRole("cell", { name: "Товар 10000", exact: true })
  await expect
    .poll(
      async () => {
        await list.evaluate((element) => {
          element.scrollTop = element.scrollHeight
        })
        return last.isVisible()
      },
      { timeout: 90_000, intervals: [30] }
    )
    .toBe(true)

  expect(await page.locator("tbody tr[aria-rowindex]").count()).toBeLessThan(80)
  await expect(page.getByRole("table")).toHaveAttribute(
    "aria-rowcount",
    "10001"
  )
})

test("keeps loaded rows when the next page fails, and loads it again only on request", async ({
  page,
}) => {
  // 400 is never retried by the query client, so exactly one request reaches the failing page.
  const requests = await mockProducts(page, {
    total: 300,
    failPage: { page: 1, status: 400, code: "BAD_REQUEST" },
  })
  await page.goto("/products")
  const list = page.getByRole("region", { name: "Товары" })
  await expect(
    page.getByRole("cell", { name: "Товар 1", exact: true })
  ).toBeVisible()

  await list.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  await expect(
    page.getByText("Не удалось загрузить следующие строки.")
  ).toBeVisible()
  await expect(
    page.getByRole("cell", { name: "Товар 100", exact: true })
  ).toBeAttached()

  // Scrolling up and down again must not ask for the failed page on its own.
  await list.evaluate((element) => {
    element.scrollTop = 0
  })
  await list.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  await page.waitForTimeout(500)
  expect(
    requests.filter((url) => url.searchParams.get("cursor") === "100")
  ).toHaveLength(1)

  await page.getByRole("button", { name: "Повторить" }).click()
  await expect(
    page.getByRole("cell", { name: "Товар 101", exact: true })
  ).toBeAttached()
  await expect(
    page.getByText("Не удалось загрузить следующие строки.")
  ).toBeHidden()
})

test("coming back to a long list loads its first page, not every page seen before", async ({
  page,
}) => {
  const requests = await mockProducts(page, { total: 1000 })
  await page.goto("/products")
  const list = page.getByRole("region", { name: "Товары" })
  await expect
    .poll(async () => {
      await list.evaluate((element) => {
        element.scrollTop = element.scrollHeight
      })
      return requests.length
    })
    .toBeGreaterThanOrEqual(3)
  // A list still loading a page when its screen closes is kept until that request ends; wait it out.
  await expect(page.getByText("Загружаем ещё…")).toBeHidden()

  await page
    .getByRole("searchbox", { name: "Поиск по названию, коду или штрихкоду" })
    .fill("Товар 7")
  await page.keyboard.press("Enter")
  await expect(
    page.getByRole("cell", { name: "Товар 70", exact: true })
  ).toBeVisible()
  const before = requests.length
  await page.goBack()
  await expect(
    page.getByRole("cell", { name: "Товар 1", exact: true })
  ).toBeVisible()
  await page.waitForTimeout(300)

  const after = requests.slice(before)
  expect(after).toHaveLength(1)
  expect(after[0]?.searchParams.has("cursor")).toBe(false)
})

test("searches through the URL and shows the single page of matches", async ({
  page,
}) => {
  const requests = await mockProducts(page, { total: 500 })
  await page.goto("/products")

  await page
    .getByRole("searchbox", { name: "Поиск по названию, коду или штрихкоду" })
    .fill("Товар 42")
  await page.keyboard.press("Enter")

  await expect(page).toHaveURL(/search=/)
  await expect(
    page.getByRole("cell", { name: "Товар 42", exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole("cell", { name: "Товар 420", exact: true })
  ).toBeVisible()
  expect(requests.at(-1)?.searchParams.get("search")).toBe("Товар 42")
  expect(requests.at(-1)?.searchParams.has("cursor")).toBe(false)
})
