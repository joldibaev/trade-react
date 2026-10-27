import { expect, test, type Page } from "@playwright/test"

import {
  admin,
  mockProducts,
  mockSession,
  product,
  productCard,
} from "./support/api"
import { mockCategories, mockProductWrites } from "./support/catalog"
import {
  labelTemplates,
  mockLabelTemplates,
  standardLayout,
} from "./support/labels"
import { mockPriceTypes, priceTypes } from "./support/prices"

type Printed = { labels: number; text: string }

const types = priceTypes()
const retail = types[0]?.id ?? ""
// Product 1: 12 500, product 2: 8 000 and a box barcode, product 3: no retail price.
const prices = new Map([
  [`${product(1).id}|${retail}`, "12500.00"],
  [`${product(2).id}|${retail}`, "8000.00"],
])
const boxBarcode = "4780000000999"

async function setUp(page: Page, templates = labelTemplates()) {
  // In every frame, the print frame included: record what would print instead of opening the print dialog.
  await page.addInitScript(() => {
    window.print = () => {
      const top = window.top as unknown as { printed?: Printed[] }
      top.printed = [
        ...(top.printed ?? []),
        {
          labels: document.querySelectorAll(".label").length,
          text: document.querySelector(".label")?.textContent ?? "",
        },
      ]
    }
  })
  await mockSession(page, admin)
  await mockCategories(page, [])
  await mockPriceTypes(page, types)
  await mockLabelTemplates(page, templates)
  await mockProducts(page, { total: 5, prices })
  // TradeNet finds a product by any of its barcodes; the list item shows only the primary one.
  await page.route(`**/api/products?search=${boxBarcode}*`, (route) =>
    route.fulfill({ json: { items: [product(2, prices)], nextCursor: null } })
  )
  await mockProductWrites(page, [
    productCard(1, prices),
    productCard(2, prices, [boxBarcode]),
    productCard(3, prices),
  ])
  const cardReads: string[] = []
  page.on("request", (request) => {
    if (/\/api\/products\/[0-9a-f-]+$/.test(request.url()))
      cardReads.push(request.url())
  })
  return cardReads
}

const printed = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { printed?: Printed[] }).printed ?? []
  )

async function scan(page: Page, value: string) {
  const input = page.getByRole("searchbox", {
    name: "Отсканируйте штрихкод или введите код",
  })
  await input.fill(value)
  await input.press("Enter")
}

test("scans add lines, a repeated scan adds a copy, one job prints them all with fresh prices", async ({
  page,
}) => {
  const cardReads = await setUp(page)
  await page.goto("/labels")

  await scan(page, product(1).barcode ?? "")
  await expect(
    page.getByRole("cell", { name: "Товар 1", exact: true })
  ).toBeVisible()
  await scan(page, product(1).barcode ?? "")
  await expect(page.getByLabel("Копий: Товар 1")).toHaveValue("2")
  // A box's barcode finds its product and is printed as scanned.
  await scan(page, boxBarcode)
  await expect(
    page.getByRole("cell", { name: "Товар 2", exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole("combobox", { name: "Штрихкод: Товар 2" })
  ).toContainText(boxBarcode)

  const before = cardReads.length
  await page.getByRole("button", { name: "Печать (3)" }).click()
  await expect(
    page.getByText("Отправлено на печать.", { exact: false })
  ).toBeVisible()
  const jobs = await printed(page)
  expect(jobs).toHaveLength(1)
  expect(jobs[0]?.labels).toBe(3)
  expect(jobs[0]?.text).toMatch(/12\s500/)
  // Printing read both products again.
  expect(cardReads.length - before).toBe(2)
  // The list stays for another attempt.
  await expect(
    page.getByRole("cell", { name: "Товар 1", exact: true })
  ).toBeVisible()
})

test("a line without the chosen price stops the job and is named", async ({
  page,
}) => {
  await setUp(page)
  await page.goto("/labels")
  await scan(page, product(1).barcode ?? "")
  await scan(page, product(3).barcode ?? "")
  await expect(
    page.getByRole("cell", { name: "Товар 3", exact: true })
  ).toBeVisible()
  await page.getByRole("button", { name: "Печать (2)" }).click()
  await expect(
    page.getByText("Строка 2, «Товар 3»: нет цены «Розница»")
  ).toBeVisible()
  expect(await printed(page)).toHaveLength(0)
})

test("the product card prints copies of its label, previewed as printed", async ({
  page,
}) => {
  await setUp(page)
  await page.goto(`/products/${product(1).id}`)
  await page.getByRole("button", { name: "Печать наклеек" }).click()
  const dialog = page.getByRole("dialog", { name: "Печать наклеек" })
  const preview = dialog.frameLocator('iframe[title="Предпросмотр наклейки"]')
  await expect(preview.locator(".label")).toContainText("12 500")
  await expect(preview.locator(".label svg")).toBeVisible()
  await dialog.getByLabel("Копий").fill("3")
  await dialog.getByRole("button", { name: "Печать" }).click()
  await expect.poll(async () => (await printed(page)).at(0)?.labels).toBe(3)
})

test("prints with the template chosen, which this computer remembers", async ({
  page,
}) => {
  await setUp(page)
  await page.goto("/labels")
  // The first active template until one is chosen.
  const template = page.getByRole("combobox", { name: "Шаблон" })
  await expect(template).toContainText("Маленькая 40×30")
  await template.click()
  await page.getByRole("option", { name: "Стандарт 58×40 (58×40)" }).click()
  await scan(page, product(1).barcode ?? "")
  // The standard template splits the price: 12 big, 500 small.
  const preview = page.frameLocator('iframe[title="Предпросмотр наклейки"]')
  await expect(preview.locator(".label")).toContainText("12500")

  await page.getByRole("button", { name: "Печать (1)" }).click()
  await expect
    .poll(async () => (await printed(page)).at(0)?.text)
    .toContain("12500")
  await page.reload()
  await expect(page.getByRole("combobox", { name: "Шаблон" })).toContainText(
    "Стандарт 58×40"
  )
})

test("a template switched off since it was chosen stops the job", async ({
  page,
}) => {
  const templates = labelTemplates()
  await setUp(page, templates)
  await page.goto("/labels")
  await scan(page, product(1).barcode ?? "")
  await expect(
    page.getByRole("cell", { name: "Товар 1", exact: true })
  ).toBeVisible()
  // Someone switches the template off in another tab; printing reads it again.
  const first = templates[0]
  if (first) first.isActive = false
  await page.getByRole("button", { name: "Печать (1)" }).click()
  await expect(
    page.getByText("Шаблон не найден или отключён. Выберите другой.")
  ).toBeVisible()
  expect(await printed(page)).toHaveLength(0)
})

test("a barcode too narrow for its bars is shown as digits only, with a warning", async ({
  page,
}) => {
  const templates = labelTemplates()
  const first = templates[0]
  if (first)
    first.layout = standardLayout(40, 30, { split: false, barcodeWidth: 12 })
  await setUp(page, templates)
  await page.goto("/labels")
  await scan(page, product(1).barcode ?? "")
  await expect(
    page.getByText(
      "Штрихкод не помещается на наклейку: напечатаются только цифры."
    )
  ).toBeVisible()
  const preview = page.frameLocator('iframe[title="Предпросмотр наклейки"]')
  await expect(preview.locator(".label svg")).toHaveCount(0)
})
