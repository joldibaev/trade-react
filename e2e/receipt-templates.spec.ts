import { expect, test, type Page } from "@playwright/test"

import type { components } from "../src/api/schema"
import { admin, cashier, mockSession } from "./support/api"
import { mockStores, store } from "./support/stores"
import {
  mockReceiptTemplates,
  receiptTemplates,
  standardReceiptLayout,
} from "./support/receipts"

type Me = components["schemas"]["MeResponse"]
type Layout = components["schemas"]["ReceiptLayout"]

async function setUp(
  page: Page,
  me: Me = admin,
  refuse: { next: Record<string, string[]> | null } = { next: null }
) {
  // Record what would print instead of opening the print dialog (in the print frame too).
  await page.addInitScript(() => {
    window.print = () => {
      const top = window.top as unknown as { printed?: string[] }
      top.printed = [
        ...(top.printed ?? []),
        document.querySelector("[data-receipt]")?.textContent ?? "",
      ]
    }
  })
  await mockSession(page, me)
  const templates = receiptTemplates()
  const sent = await mockReceiptTemplates(page, templates, refuse)
  return { templates, sent }
}

const printed = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { printed?: string[] }).printed ?? []
  )

const wide = receiptTemplates()[1]?.id ?? ""

/** A block in the editor's list (the add buttons carry the same names). */
const listed = (page: Page, name: string) =>
  page.getByRole("listitem").getByRole("button", { name })

const receiptIn = (page: Page) =>
  page.frameLocator('iframe[title="Предпросмотр"]').locator("[data-receipt]")

test("the list shows the rolls and offers editing to those who may", async ({
  page,
}) => {
  await setUp(page)
  await page.goto("/receipt-templates")
  const row = page.getByRole("row", { name: /Стандарт 58 мм/ })
  await expect(row).toContainText("58 мм")
  await expect(page.getByRole("row", { name: /Стандарт 80 мм/ })).toContainText(
    "80 мм"
  )
  await page.getByRole("link", { name: "Стандарт 80 мм" }).click()
  await expect(page).toHaveURL(new RegExp(`/receipt-templates/${wide}$`))
})

test("without the permission the list is read only and the editor says no access", async ({
  page,
}) => {
  await setUp(page, cashier)
  await page.goto("/receipt-templates")
  await expect(
    page.getByRole("cell", { name: "Стандарт 58 мм", exact: true })
  ).toBeVisible()
  await expect(page.getByRole("link", { name: "Новый шаблон" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: /^Действия/ })).toHaveCount(0)
  await page.goto(`/receipt-templates/${wide}`)
  await expect(page.getByText("Нет доступа к этому разделу")).toBeVisible()
})

test("a new template starts as the standard receipt and is created with its blocks", async ({
  page,
}) => {
  const { sent } = await setUp(page)
  await page.goto("/receipt-templates")
  await page.getByRole("link", { name: "Новый шаблон" }).click()
  await page.getByRole("textbox", { name: "Название шаблона" }).fill("Акция")
  await page.getByRole("button", { name: "Сохранить" }).click()

  await expect(page).toHaveURL(/\/receipt-templates\/0{8}-/)
  expect(sent[0]?.method).toBe("POST")
  const layout = sent[0]?.body.layout as Layout
  expect(layout.paperWidthMm).toBe(80)
  expect(layout.blocks.map((block) => block.type)).toEqual([
    "STORE",
    "DOCUMENT",
    "ITEMS",
    "TOTALS",
    "PAYMENTS",
    "BARCODE",
    "TEXT",
  ])
})

test("a name another template has is refused, in any case", async ({
  page,
}) => {
  await setUp(page)
  await page.goto(`/receipt-templates/${wide}`)
  await page
    .getByRole("textbox", { name: "Название шаблона" })
    .fill("стандарт 58 мм")
  await page.getByRole("button", { name: "Сохранить" }).click()
  await expect(
    page.getByText(
      "Шаблон чека с таким названием уже есть (может быть, отключённый)."
    )
  ).toBeVisible()
})

test("an edit over someone else's change keeps the person's work until they load the current data", async ({
  page,
}) => {
  const { templates, sent } = await setUp(page)
  await page.goto(`/receipt-templates/${wide}`)
  await page.getByRole("textbox", { name: "Название шаблона" }).fill("Мой")

  // Meanwhile someone else renames the template.
  const target = templates[1]
  if (!target) throw new Error("no template")
  target.name = "Чужой"
  target.version += 1

  await page.getByRole("button", { name: "Сохранить" }).click()
  await expect(
    page.getByText("Данные изменил кто-то другой. Обновите и повторите.")
  ).toBeVisible()
  await expect(
    page.getByRole("textbox", { name: "Название шаблона" })
  ).toHaveValue("Мой")

  await page
    .getByRole("button", { name: "Загрузить актуальные данные" })
    .click()
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Загрузить актуальные данные" })
    .click()
  await expect(
    page.getByRole("textbox", { name: "Название шаблона" })
  ).toHaveValue("Чужой")
  await page.getByRole("textbox", { name: "Название шаблона" }).fill("Мой")
  await page.getByRole("button", { name: "Сохранить" }).click()
  await expect(page.getByRole("heading", { name: "Мой" })).toBeVisible()
  expect(sent.at(-1)).toEqual({
    method: "PATCH",
    body: { version: 2, name: "Мой" },
  })
})

test("a template is switched off and on, and deleted after asking", async ({
  page,
}) => {
  const { sent } = await setUp(page)
  await page.goto("/receipt-templates")
  const confirm = page.getByRole("alertdialog")

  await page.getByRole("button", { name: "Действия: Стандарт 58 мм" }).click()
  await page.getByRole("menuitem", { name: "Отключить" }).click()
  await confirm.getByRole("button", { name: "Отключить" }).click()
  await expect(confirm).toBeHidden()
  expect(sent.at(-1)).toEqual({
    method: "PATCH",
    body: { version: 1, isActive: false },
  })
  await expect(page.getByRole("row", { name: /Стандарт 58 мм/ })).toContainText(
    "Отключён"
  )

  await page.getByRole("button", { name: "Действия: Стандарт 58 мм" }).click()
  await page.getByRole("menuitem", { name: "Включить" }).click()
  await confirm.getByRole("button", { name: "Включить" }).click()
  await expect(
    page.getByRole("row", { name: /Стандарт 58 мм/ })
  ).not.toContainText("Отключён")

  await page.getByRole("button", { name: "Действия: Стандарт 58 мм" }).click()
  await page.getByRole("menuitem", { name: "Удалить" }).click()
  await confirm.getByRole("button", { name: "Удалить" }).click()
  await expect(
    page.getByRole("cell", { name: "Стандарт 58 мм", exact: true })
  ).toHaveCount(0)
  expect(sent.at(-1)?.method).toBe("DELETE")
})

test("the editor deactivates and deletes the template it shows", async ({
  page,
}) => {
  const { sent } = await setUp(page)
  await page.goto(`/receipt-templates/${wide}`)
  const confirm = page.getByRole("alertdialog")
  await page.getByRole("button", { name: "Отключить" }).click()
  await confirm.getByRole("button", { name: "Отключить" }).click()
  await expect(page.getByText("Отключён")).toBeVisible()
  await expect(page.getByRole("button", { name: "Включить" })).toBeVisible()
  expect(sent.at(-1)?.body).toEqual({ version: 1, isActive: false })

  await page.getByRole("button", { name: "Удалить" }).click()
  await confirm.getByRole("button", { name: "Удалить" }).click()
  await expect(page).toHaveURL(/\/receipt-templates$/)
  expect(sent.at(-1)).toEqual({
    method: "DELETE",
    body: { id: wide, version: "2" },
  })
})

test("an unknown variable is refused at its block before anything is sent", async ({
  page,
}) => {
  const { sent } = await setUp(page)
  await page.goto(`/receipt-templates/${wide}`)
  await listed(page, "Текст").click()
  await page.getByLabel("Текст", { exact: true }).fill("Кассир {cashier}")
  await expect(page.getByText("Нет такой переменной: {cashier}")).toBeVisible()

  await page.getByRole("button", { name: "Сохранить" }).click()
  await expect(page.getByText("Шаблон не сохранён")).toBeVisible()
  expect(sent).toHaveLength(0)
})

test("a layout TradeNet refuses shows the field error at the block it names", async ({
  page,
}) => {
  const { sent } = await setUp(page, admin, {
    next: { "layout.blocks[6].text": ["INVALID_VALUE"] },
  })
  await page.goto(`/receipt-templates/${wide}`)
  await page.getByLabel("Размер текста, pt").fill("10")
  await page.getByRole("button", { name: "Сохранить" }).click()

  // The block is opened, with the server's word under its field.
  await expect(page.getByLabel("Текст", { exact: true })).toBeVisible()
  await expect(page.getByText("Неверное значение.")).toBeVisible()
  expect(sent).toHaveLength(1)

  // Editing the refused text takes the server's word back.
  await page.getByLabel("Текст", { exact: true }).fill("Спасибо!")
  await expect(page.getByText("Неверное значение.")).toHaveCount(0)
})

test("blocks are added, moved, duplicated and deleted; the required ones stay", async ({
  page,
}) => {
  const { sent } = await setUp(page)
  await page.goto(`/receipt-templates/${wide}`)
  const blocks = page.getByRole("listitem").getByRole("button", {
    name: /^(Магазин|Номер чека|Товары|Итоги|Оплата|Штрихкод|Текст|QR-код|Разделитель|Картинка)/,
  })
  await expect(blocks).toHaveCount(7)

  // A block of the sale appears once; texts, QR codes and dividers any number of times.
  await expect(
    page.getByRole("button", { name: "Магазин", exact: true }).first()
  ).toBeDisabled()
  await page.getByRole("button", { name: "QR-код", exact: true }).click()
  await expect(blocks).toHaveCount(8)
  await page
    .getByLabel("Что закодировать")
    .fill("https://t.me/cosmos?n={number}")
  await page.getByRole("button", { name: "Выше" }).click()
  await page.getByRole("button", { name: "Выше" }).click()
  await page.getByRole("button", { name: "Дублировать блок" }).click()
  await expect(blocks).toHaveCount(9)

  // A required block cannot be deleted or duplicated.
  await listed(page, "Товары").click()
  await expect(
    page.getByRole("button", { name: "Удалить блок" })
  ).toBeDisabled()
  await expect(
    page.getByRole("button", { name: "Дублировать блок" })
  ).toBeDisabled()

  await listed(page, "QR-код").first().click()
  await page.getByRole("button", { name: "Удалить блок" }).click()
  await page.getByRole("textbox", { name: "Название шаблона" }).fill("Новый")
  await page.getByRole("button", { name: "Сохранить" }).click()
  await expect(page.getByRole("heading", { name: "Новый" })).toBeVisible()
  const layout = sent.at(-1)?.body.layout as Layout
  expect(layout.blocks.map((block) => block.type)).toEqual([
    "STORE",
    "DOCUMENT",
    "ITEMS",
    "TOTALS",
    "PAYMENTS",
    "QR",
    "BARCODE",
    "TEXT",
  ])
})

test("the preview is the sample sale at the roll's width and ends with the not-fiscal line", async ({
  page,
}) => {
  await setUp(page)
  await page.goto(`/receipt-templates/${wide}`)
  const receipt = receiptIn(page)
  await expect(receipt).toContainText("Товарный чек №1042")
  await expect(receipt).toContainText("Итого")
  await expect(receipt).toContainText("Сдача")
  await expect(receipt.locator("[data-notice]")).toHaveText(
    "Не является фискальным чеком"
  )
  // Switching the roll to 58 mm redraws the paper narrower.
  const frame = page.locator('iframe[title="Предпросмотр"]')
  const before = (await frame.boundingBox())?.width ?? 0
  await page.getByRole("button", { name: "58 мм" }).click()
  await expect
    .poll(async () => (await frame.boundingBox())?.width ?? 0)
    .toBeLessThan(before)
})

test("a long product name wraps inside the roll on both widths", async ({
  page,
}) => {
  await setUp(page)
  await page.goto(`/receipt-templates/${wide}`)
  const receipt = receiptIn(page)
  await expect(receipt).toContainText("Кетчуп")
  // The table is the tightest: three columns in 48 mm.
  for (const layout of ["Строками", "Таблицей"]) {
    await listed(page, "Товары").click()
    await page.getByRole("button", { name: layout }).click()
    // Back to the roll's settings: nothing selected.
    await listed(page, "Товары").click()
    for (const roll of ["58 мм", "80 мм"]) {
      await page.getByRole("button", { name: roll }).click()
      await expect(receipt).toBeVisible()
      const overflow = await receipt.evaluate(
        (root) => root.scrollWidth - root.clientWidth
      )
      expect(overflow).toBeLessThanOrEqual(0)
    }
  }
})

test("the receipt paper is never clipped by its card, at 1024 px or 1280 px", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "The phone has its own width.")
  await setUp(page)
  for (const width of [1024, 1280]) {
    await page.setViewportSize({ width, height: 768 })
    await page.goto(`/receipt-templates/${wide}`)
    await expect(receiptIn(page)).toContainText("Итого")
    const frame = page.locator('iframe[title="Предпросмотр"]')
    const card = page.locator('[data-slot="card"]').filter({ has: frame })
    const [frameBox, cardBox] = [
      await frame.boundingBox(),
      await card.boundingBox(),
    ]
    if (!frameBox || !cardBox) throw new Error("no boxes")
    expect(frameBox.x).toBeGreaterThanOrEqual(cardBox.x)
    expect(frameBox.x + frameBox.width).toBeLessThanOrEqual(
      cardBox.x + cardBox.width
    )
    // The receipt inside the frame is whole too: nothing scrolls sideways.
    expect(
      await receiptIn(page).evaluate(
        (root) =>
          root.ownerDocument.documentElement.scrollWidth -
          root.ownerDocument.documentElement.clientWidth
      )
    ).toBeLessThanOrEqual(0)
  }
})

test("a QR code too small to scan is flagged on the sample sale and stops the test print", async ({
  page,
}) => {
  await setUp(page)
  await page.goto(`/receipt-templates/${wide}`)
  await page.getByRole("button", { name: "QR-код", exact: true }).click()
  await page
    .getByLabel("Что закодировать")
    .fill(`https://shop.uz/${"x".repeat(150)}`)
  await page.getByLabel("Размер, мм").fill("15")
  await expect(
    page
      .getByText("QR-код такого размера не прочитается", { exact: false })
      .first()
  ).toBeVisible()

  await page.getByRole("button", { name: "Пробная печать" }).click()
  await expect(
    page.getByText("QR-код такого размера не прочитается", { exact: false })
  ).toHaveCount(3)
  expect(await printed(page)).toHaveLength(0)
})

test("pressing the test print twice opens one print dialog", async ({
  page,
}) => {
  await setUp(page)
  await page.goto(`/receipt-templates/${wide}`)
  await page.getByRole("button", { name: "Пробная печать" }).dblclick()
  await expect.poll(async () => (await printed(page)).length).toBe(1)
  await page.waitForTimeout(500)
  expect(await printed(page)).toHaveLength(1)
  // Once the dialog is closed the button works again.
  await page.getByRole("button", { name: "Пробная печать" }).click()
  await expect.poll(async () => (await printed(page)).length).toBe(2)
})

test("a test print draws the sample sale", async ({ page }) => {
  await setUp(page)
  await page.goto(`/receipt-templates/${wide}`)
  await page.getByRole("button", { name: "Пробная печать" }).click()
  await expect.poll(async () => (await printed(page)).length).toBe(1)
  const text = (await printed(page))[0] ?? ""
  expect(text).toContain("Товарный чек №1042")
  expect(text).toContain("Не является фискальным чеком")
})

test("saving only a new name sends the name and not the layout", async ({
  page,
}) => {
  const { sent } = await setUp(page)
  await page.goto(`/receipt-templates/${wide}`)
  await page
    .getByRole("textbox", { name: "Название шаблона" })
    .fill("Новое имя")
  const request = page.waitForRequest(
    (r) => r.method() === "PATCH" && r.url().includes("/api/receipt-templates/")
  )
  await page.getByRole("button", { name: "Сохранить" }).click()
  expect((await request).postDataJSON()).toEqual({
    version: 1,
    name: "Новое имя",
  })
  await expect(page.getByRole("heading", { name: "Новое имя" })).toBeVisible()
  expect(sent.at(-1)?.body.layout).toBeUndefined()
  expect(standardReceiptLayout(80).blocks).toHaveLength(7)
})

test("a number that cannot be used yet is shown and stops saving", async ({
  page,
}) => {
  const { sent } = await setUp(page)
  await page.goto(`/receipt-templates/${wide}`)
  await page.getByRole("button", { name: "QR-код", exact: true }).click()
  await page.getByLabel("Что закодировать").fill("https://t.me/cosmos")
  await page.getByLabel("Размер, мм").fill("50")
  await expect(page.getByText("Допустимо 15–40")).toBeVisible()

  await page.getByRole("button", { name: "Сохранить" }).click()
  await expect(page.getByText("Шаблон не сохранён")).toBeVisible()
  expect(sent).toHaveLength(0)

  await page.getByLabel("Размер, мм").fill("30")
  await expect(page.getByText("Допустимо 15–40")).toHaveCount(0)
  await page.getByRole("button", { name: "Сохранить" }).click()
  await expect.poll(() => sent.length).toBe(1)
  const layout = sent[0]?.body.layout as Layout
  expect(layout.blocks.at(-1)).toMatchObject({ type: "QR", sizeMm: 30 })
})

test("undo and redo step through the edits of the blocks", async ({ page }) => {
  await setUp(page)
  await page.goto(`/receipt-templates/${wide}`)
  const blocks = page.getByRole("listitem").getByRole("button", {
    name: /^(Магазин|Номер чека|Товары|Итоги|Оплата|Штрихкод|Текст|QR-код|Разделитель|Картинка)/,
  })
  await expect(blocks).toHaveCount(7)
  await page.getByRole("button", { name: "Разделитель", exact: true }).click()
  await expect(blocks).toHaveCount(8)
  await page.getByRole("button", { name: "Отменить" }).click()
  await expect(blocks).toHaveCount(7)
  await page.getByRole("button", { name: "Вернуть", exact: true }).click()
  await expect(blocks).toHaveCount(8)
})

test("a failed background refetch does not throw the edits away", async ({
  page,
}) => {
  const { templates } = await setUp(page)
  let broken = false
  await page.route(/\/api\/receipt-templates\/[^/?]+$/, (route) =>
    broken && route.request().method() === "GET"
      ? route.fulfill({
          status: 404,
          contentType: "application/problem+json",
          json: {
            title: "x",
            status: 404,
            code: "RECEIPT_TEMPLATE_NOT_FOUND",
            traceId: "t",
          },
        })
      : route.fallback()
  )
  await page.goto(`/receipt-templates/${wide}`)
  await page
    .getByRole("textbox", { name: "Название шаблона" })
    .fill("Мои правки")

  // Someone else changes the template; the refused save reads it again, and that read fails.
  const target = templates[1]
  if (!target) throw new Error("no template")
  target.version += 1
  broken = true
  await page.getByRole("button", { name: "Сохранить" }).click()
  await expect(
    page.getByText("Данные изменил кто-то другой. Обновите и повторите.")
  ).toBeVisible()
  await expect(
    page.getByRole("textbox", { name: "Название шаблона" })
  ).toHaveValue("Мои правки")
})

test("a QR code that a real shop's address would break is flagged by name", async ({
  page,
}) => {
  await setUp(page)
  await mockStores(page, [
    store(1, "Чиланзар"),
    { ...store(2, "Юнусабад"), address: "Ташкент, ".repeat(60).trim() },
  ])
  await page.goto(`/receipt-templates/${wide}`)
  await page.getByRole("button", { name: "QR-код", exact: true }).click()
  await page
    .getByLabel("Что закодировать")
    .fill("https://shop.uz/?a={storeAddress}")
  await page.getByLabel("Размер, мм").fill("40")
  const alert = page.getByText(/магазин «Юнусабад»/)
  await expect(alert).toBeVisible()
  await expect(alert).toContainText("QR-код №1")
  await expect(page.getByText(/магазин «Чиланзар»/)).toHaveCount(0)
  // The block is marked in the list too.
  await expect(
    page.getByRole("listitem").getByRole("button", { name: /QR-код/ })
  ).toContainText("есть ошибка")
})

test("an unbroken text wraps inside the roll, in the preview", async ({
  page,
}) => {
  await setUp(page)
  await page.goto(`/receipt-templates/${wide}`)
  await listed(page, "Текст").click()
  await page.getByLabel("Текст", { exact: true }).fill("W".repeat(200))
  const receipt = receiptIn(page)
  await expect(receipt).toContainText("WWWW")
  for (const roll of ["58 мм", "80 мм"]) {
    await listed(page, "Текст").click()
    await page.getByRole("button", { name: roll }).click()
    await expect
      .poll(() =>
        receipt.evaluate((root) => root.scrollWidth - root.clientWidth)
      )
      .toBeLessThanOrEqual(0)
    await listed(page, "Текст").click()
  }
})

test("amounts and names run to a new line instead of off the paper", async ({
  page,
}) => {
  // The renderer itself, in a real browser: a 200-letter cashbox, a huge LARGE total at 14 pt on the 58 mm roll.
  await setUp(page)
  await page.goto("/receipt-templates")
  const overflow = await page.evaluate(async () => {
    // Loaded by the dev server in the page itself, so the real browser lays the receipt out.
    const path = "/src/features/receipts/receipt/render.ts"
    const { drawReceipt } = (await import(/* @vite-ignore */ path)) as {
      drawReceipt: (...args: unknown[]) => { root: HTMLElement }
    }
    const size = "LARGE" as const
    const layout = {
      paperWidthMm: 58,
      fontSizePt: 14,
      blocks: [
        { type: "DOCUMENT", title: "Чек", size, dateTime: true, cashbox: true },
        {
          type: "ITEMS",
          layout: "LINES",
          size,
          nameBold: false,
          lineNumbers: true,
          discounts: true,
        },
        {
          type: "TOTALS",
          subtotal: true,
          discount: true,
          size,
          totalSize: size,
        },
        { type: "PAYMENTS", change: true, size },
      ],
    } as const
    const data = {
      storeName: "Магазин",
      storeAddress: "Адрес",
      storePhone: null,
      number: "1",
      date: "07.10.2026",
      time: "14:32",
      cashbox: "К".repeat(200),
      lines: [
        {
          name: "Т".repeat(120),
          quantity: "12345.000",
          price: "12345678.0000",
          amount: "12345678.00",
          discount: "1234567.00",
        },
      ],
      subtotal: "13580245.00",
      discount: "1234567.00",
      total: "12345678.00",
      payments: [
        {
          method: "Н".repeat(80),
          amount: "12345678.00",
          received: "99999999.00",
          change: "87654321.00",
        },
      ],
    }
    const texts = {
      number: "№",
      date: "Дата",
      cashbox: "Касса",
      subtotal: "Сумма",
      discount: "Скидка",
      total: "Итого",
      received: "Получено",
      change: "Сдача",
      itemName: "Товар",
      quantity: "Кол-во",
      amount: "Сумма",
      notFiscal: "Не является фискальным чеком",
    }
    const { root } = drawReceipt(document, layout, data, texts)
    document.body.append(root)
    const edge = root.getBoundingClientRect().right
    const widest = Math.max(
      ...[...root.querySelectorAll("*")].map(
        (node) => node.getBoundingClientRect().right
      )
    )
    const result = {
      scroll: root.scrollWidth - root.clientWidth,
      past: widest - edge,
    }
    root.remove()
    return result
  })
  expect(overflow.scroll).toBeLessThanOrEqual(0)
  expect(overflow.past).toBeLessThanOrEqual(0.5)
})
