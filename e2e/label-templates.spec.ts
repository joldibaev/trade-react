import { expect, test, type Page } from "@playwright/test"

import type { components } from "../src/api/schema"
import {
  admin,
  cashier,
  mockProducts,
  mockSession,
  product,
  productCard,
} from "./support/api"
import { mockCategories, mockProductWrites } from "./support/catalog"
import { labelTemplates, mockLabelTemplates } from "./support/labels"
import { mockPriceTypes, priceTypes } from "./support/prices"

type Me = components["schemas"]["MeResponse"]
type Layout = components["schemas"]["LabelLayout"]

async function setUp(page: Page, me: Me = admin) {
  // Record what would print instead of opening the print dialog (in the print frame too).
  await page.addInitScript(() => {
    window.print = () => {
      const top = window.top as unknown as { printed?: string[] }
      top.printed = [
        ...(top.printed ?? []),
        document.querySelector(".label")?.textContent ?? "",
      ]
    }
  })
  await mockSession(page, me)
  await mockCategories(page, [])
  await mockPriceTypes(page, priceTypes())
  const templates = labelTemplates()
  const sent = await mockLabelTemplates(page, templates)
  return { templates, sent }
}

const printed = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { printed?: string[] }).printed ?? []
  )

const standard = labelTemplates()[1]?.id ?? ""

/** An element in the editor's layers list (the canvas has a box of the same name). */
const layer = (page: Page, name: string) =>
  page.getByRole("listitem").getByRole("button", { name, exact: true })

test("the list switches a template off after asking, and test-prints one on any screen", async ({
  page,
}) => {
  const { sent } = await setUp(page)
  await page.goto("/label-templates")
  await page.getByRole("button", { name: "Действия: Стандарт 58×40" }).click()
  await page.getByRole("menuitem", { name: "Отключить" }).click()
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Отключить" })
    .click()
  await expect(
    page.getByRole("row", { name: /Стандарт 58×40/ }).getByText("Отключён")
  ).toBeVisible()
  expect(sent.at(-1)?.body).toEqual({ version: 1, isActive: false })

  await page.getByRole("button", { name: "Действия: Маленькая 40×30" }).click()
  await page.getByRole("menuitem", { name: "Пробная печать" }).click()
  const dialog = page.getByRole("dialog", {
    name: "Пробная печать: Маленькая 40×30",
  })
  await expect(
    dialog
      .frameLocator('iframe[title="Предпросмотр наклейки"]')
      .locator(".label")
  ).toContainText("Кетчуп")
  await dialog.getByRole("button", { name: "Печать" }).click()
  await expect.poll(async () => (await printed(page)).at(0)).toMatch(/18\s790/)
})

test("the list deletes a template after asking", async ({ page }) => {
  const { sent } = await setUp(page)
  await page.goto("/label-templates")
  await page.getByRole("button", { name: "Действия: Маленькая 40×30" }).click()
  await page.getByRole("menuitem", { name: "Удалить" }).click()
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Удалить" })
    .click()
  await expect(page.getByRole("link", { name: "Маленькая 40×30" })).toHaveCount(
    0
  )
  await expect(page.getByRole("link", { name: "Стандарт 58×40" })).toBeVisible()
  expect(sent.at(-1)).toEqual({
    method: "DELETE",
    body: { id: labelTemplates()[0]?.id, version: "1" },
  })
})

test("without catalog rights the list only test-prints, and the editor says no access", async ({
  page,
}) => {
  await setUp(page, cashier)
  await page.goto("/label-templates")
  await expect(
    page.getByRole("cell", { name: "Стандарт 58×40", exact: true })
  ).toBeVisible()
  await expect(page.getByRole("link", { name: "Стандарт 58×40" })).toHaveCount(
    0
  )
  await expect(page.getByRole("link", { name: "Новый шаблон" })).toHaveCount(0)
  await page.getByRole("button", { name: "Действия: Стандарт 58×40" }).click()
  await expect(page.getByRole("menuitem")).toHaveText(["Пробная печать"])
  await page.goto(`/label-templates/${standard}`)
  await expect(page.getByText("Нет доступа к этому разделу")).toBeVisible()
})

test.describe("the editor", () => {
  test.skip(
    ({ isMobile }) => isMobile,
    "Editing is a wide-screen task; the phone gets the preview and a test print."
  )

  test("refuses an unknown variable at its element, then saves the layout", async ({
    page,
  }) => {
    const { sent } = await setUp(page)
    await page.goto(`/label-templates/${standard}`)
    await page.getByRole("button", { name: "Текст", exact: true }).click()
    const text = page.getByRole("textbox", { name: "Текст" })
    await text.fill("{article}")
    await expect(page.getByText("Таких данных нет: {article}")).toBeVisible()

    await page.getByRole("button", { name: "Сохранить" }).click()
    await expect(page.getByText("Шаблон не сохранён")).toBeVisible()
    expect(sent).toHaveLength(0)

    await text.fill("Код {code}")
    await expect(page.getByText("Получится: Код 12320")).toBeVisible()
    await page.getByRole("button", { name: "Сохранить" }).click()
    await expect.poll(() => sent.length).toBe(1)
    const layout = sent[0]?.body.layout as Layout
    expect(sent[0]?.body.version).toBe(1)
    expect(layout.elements.at(-1)).toMatchObject({
      type: "TEXT",
      text: "Код {code}",
    })
    // Only the layout changed: the name is not sent.
    expect(sent[0]?.body).not.toHaveProperty("name")
  })

  test("undo and redo step through the changes", async ({ page }) => {
    await setUp(page)
    await page.goto(`/label-templates/${standard}`)
    const undo = page.getByRole("button", { name: "Отменить" })
    const redo = page.getByRole("button", { name: "Вернуть" })
    await expect(undo).toBeDisabled()
    await page.getByRole("button", { name: "Рамка", exact: true }).click()
    await expect(layer(page, "4. Рамка")).toBeVisible()
    await undo.click()
    await expect(layer(page, "4. Рамка")).toHaveCount(0)
    await redo.click()
    await expect(layer(page, "4. Рамка")).toBeVisible()
  })

  test("shows the server's refusal at the element it names", async ({
    page,
  }) => {
    await setUp(page)
    await page.route(`**/api/label-templates/${standard}`, (route) =>
      route.request().method() === "PATCH"
        ? route.fulfill({
            status: 400,
            contentType: "application/problem+json",
            json: {
              title: "x",
              status: 400,
              code: "VALIDATION_ERROR",
              traceId: "t",
              errors: {
                "layout.elements[1].style.fontSizePt": ["OUT_OF_RANGE"],
              },
            },
          })
        : route.fallback()
    )
    await page.goto(`/label-templates/${standard}`)
    await page.getByRole("textbox", { name: "Название шаблона" }).fill("Новое")
    await page.getByRole("button", { name: "Сохранить" }).click()
    // The second element, the price, is selected with the server's reason.
    await expect(
      page.getByText(
        "Сервер не принял элемент: Значение вне допустимых границ."
      )
    ).toBeVisible()
    await expect(layer(page, "2. Цена")).toHaveAttribute("aria-pressed", "true")
  })

  test("shows the label with a real product picked as the sample", async ({
    page,
  }) => {
    await setUp(page)
    const retail = priceTypes()[0]?.id ?? ""
    const prices = new Map([[`${product(1).id}|${retail}`, "12500.00"]])
    await mockProducts(page, { total: 3, prices })
    await mockProductWrites(page, [productCard(1, prices)])
    await page.goto(`/label-templates/${standard}`)
    // The first frame is the canvas; the second, the phone's preview, is hidden on a wide screen.
    const canvas = page
      .locator('iframe[title="Предпросмотр наклейки"]')
      .first()
      .contentFrame()
      .locator(".label")
    await expect(canvas).toContainText("Кетчуп")
    await page.getByRole("button", { name: "Взять товар" }).click()
    await page
      .getByRole("dialog", { name: "Взять товар" })
      .getByRole("button", { name: "Добавить: Товар 1" })
      .click()
    // Its name, its price (split: 12 big, 500 small) and its barcode.
    await expect(canvas).toContainText("Товар 1")
    await expect(canvas).toContainText("12500")
    await expect(canvas).toContainText(product(1).barcode ?? "")
    await page.getByRole("button", { name: "Вернуть образец" }).click()
    await expect(canvas).toContainText("Кетчуп")
  })

  test("adds a logo from a file", async ({ page }) => {
    await setUp(page)
    await page.goto(`/label-templates/${standard}`)
    // A 1×1 PNG.
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    )
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: png })
    await expect(layer(page, "4. Картинка")).toBeVisible()
    await expect(
      page
        .frameLocator('iframe[title="Предпросмотр наклейки"]')
        .locator(".label img")
    ).toHaveCount(1)
  })

  test("a new template starts from a preset and opens as itself once saved", async ({
    page,
  }) => {
    const { sent } = await setUp(page)
    await page.goto("/label-templates")
    await page.getByRole("link", { name: "Новый шаблон" }).click()
    await page.getByRole("textbox", { name: "Название шаблона" }).fill("Акция")
    await page.getByRole("button", { name: "Сохранить" }).click()
    await expect(page).toHaveURL(/\/label-templates\/0{8}-/)
    expect(sent[0]?.method).toBe("POST")
    expect((sent[0]?.body.layout as Layout).elements).toHaveLength(3)
  })

  test("a name another template has is refused", async ({ page }) => {
    await setUp(page)
    await page.goto(`/label-templates/${standard}`)
    await page
      .getByRole("textbox", { name: "Название шаблона" })
      .fill("Маленькая 40×30")
    await page.getByRole("button", { name: "Сохранить" }).click()
    await expect(
      page.getByText(
        "Шаблон с таким названием уже есть (может быть, отключённый)."
      )
    ).toBeVisible()
  })
})

test("on a phone the editor page is the preview and a test print", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "The phone layout.")
  await setUp(page)
  await page.goto(`/label-templates/${standard}`)
  await expect(
    page.getByText("Редактор шаблонов работает на широком экране.", {
      exact: false,
    })
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "Сохранить" })).toBeHidden()
  await page.getByRole("button", { name: "Пробная печать" }).click()
  await expect.poll(async () => (await printed(page)).length).toBe(1)
})
