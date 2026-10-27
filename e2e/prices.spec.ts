import { expect, test, type Page } from "@playwright/test"

import { admin, mockProducts, mockSession, product, uuid } from "./support/api"
import { mockPriceTypes, mockRevaluations, priceTypes } from "./support/prices"

async function addProducts(page: Page, names: string[]) {
  await page.getByRole("button", { name: "Добавить товары" }).first().click()
  const picker = page.getByRole("dialog", { name: "Добавить товары" })
  for (const name of names) {
    const search = picker.getByRole("searchbox")
    await search.fill(name)
    // Enter searches inside the dialog; it must not save the revaluation around it.
    await search.press("Enter")
    await picker
      .getByRole("button", { name: `Добавить: ${name}`, exact: true })
      .click()
  }
  await picker.getByRole("button", { name: "Закрыть" }).click()
}

test("a type becomes the default; the default cannot be switched off", async ({
  page,
}) => {
  await mockSession(page, admin)
  const patches = await mockPriceTypes(page, priceTypes())
  await page.goto("/price-types")

  await page.getByRole("button", { name: "Действия: Розница" }).click()
  await expect(page.getByRole("menuitem", { name: "Отключить" })).toHaveCount(0)
  await page.keyboard.press("Escape")

  await page.getByRole("button", { name: "Действия: Опт" }).click()
  await page.getByRole("menuitem", { name: "Сделать основным" }).click()
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Сделать основным" })
    .click()
  expect(patches).toEqual([{ version: 1, isDefault: true }])
  await expect(
    page.getByRole("row", { name: /Опт/ }).getByText("Основной")
  ).toBeVisible()
  await expect(
    page.getByRole("row", { name: /Розница/ }).getByText("Основной")
  ).toHaveCount(0)
})

test("a type is deleted after asking; one with prices is refused, the default has no delete", async ({
  page,
}) => {
  await mockSession(page, admin)
  const types = [
    ...priceTypes(),
    {
      id: uuid(4003),
      name: "Акция",
      isActive: true,
      isDefault: false,
      version: 1,
    },
  ]
  const sent = await mockPriceTypes(page, types, [uuid(4002)])
  await page.goto("/price-types")
  const confirm = page.getByRole("alertdialog")

  await page.getByRole("button", { name: "Действия: Розница" }).click()
  await expect(page.getByRole("menuitem", { name: "Удалить" })).toHaveCount(0)
  await page.keyboard.press("Escape")

  await page.getByRole("button", { name: "Действия: Опт" }).click()
  await page.getByRole("menuitem", { name: "Удалить" }).click()
  await confirm.getByRole("button", { name: "Удалить" }).click()
  await expect(
    confirm.getByText(
      "По этому типу уже есть цены. Его можно только отключить."
    )
  ).toBeVisible()
  await confirm.getByRole("button", { name: "Отмена" }).click()

  await page.getByRole("button", { name: "Действия: Акция" }).click()
  await page.getByRole("menuitem", { name: "Удалить" }).click()
  await confirm.getByRole("button", { name: "Удалить" }).click()
  await expect(confirm).toBeHidden()
  await expect(page.getByRole("cell", { name: "Акция" })).toHaveCount(0)
  expect(sent.at(-1)).toEqual({ deleted: uuid(4003), version: "1" })
})

test("a new revaluation sends only the cells that were touched, a removal as null", async ({
  page,
}) => {
  await mockSession(page, admin)
  const types = priceTypes()
  await mockPriceTypes(page, types)
  // Products carry their current prices: the grid's "was" comes from the product the picker found.
  const prices = new Map([
    [`${product(7).id}|${types[1]?.id ?? ""}`, "9000.00"],
  ])
  await mockProducts(page, { total: 30, prices })
  const sent = await mockRevaluations(page, { prices })
  await page.goto("/revaluations/new")
  await addProducts(page, ["Товар 3", "Товар 7"])
  expect(sent).toHaveLength(0)

  // "Was" shows the current price before anything is saved.
  await expect(page.getByRole("row", { name: /Товар 7/ })).toContainText(
    "9 000,00"
  )
  await page.getByLabel("Товар 3, Розница").fill("12 500")
  await page.getByRole("button", { name: "Действия: Товар 7" }).click()
  await page.getByRole("menuitem", { name: "Убрать цену: Опт" }).click()
  await expect(page.getByRole("row", { name: /Товар 7/ })).toContainText(
    "Цена убрана"
  )
  await page.getByRole("button", { name: "Сохранить" }).click()

  await expect(page).toHaveURL(/\/revaluations\/[0-9a-f-]+$/)
  // A draft has no number yet.
  await expect(
    page.getByRole("heading", { name: "Черновик переоценки" })
  ).toBeVisible()
  expect(sent[0]?.body).toEqual({
    comment: null,
    lines: [
      {
        productId: product(3).id,
        priceTypeId: types[0]?.id,
        newPrice: "12500",
      },
      { productId: product(7).id, priceTypeId: types[1]?.id, newPrice: null },
    ],
  })

  await page.goto("/revaluations")
  await expect(page.getByRole("link", { name: "черновик" })).toBeVisible()
})

test("on a phone the product name stays in view while the prices scroll sideways", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "phone layout only")
  await mockSession(page, admin)
  await mockPriceTypes(page, priceTypes())
  await mockProducts(page, { total: 30 })
  await mockRevaluations(page, { prices: new Map() })
  await page.goto("/revaluations/new")
  await addProducts(page, ["Товар 3"])

  const grid = page.getByRole("region", { name: "Товары переоценки" })
  const name = grid.getByRole("cell", { name: "Товар 3", exact: true })
  const lastPrice = grid.getByRole("columnheader", { name: /Опт: стало/ })
  await expect(name).toBeVisible()
  await expect(lastPrice).not.toBeInViewport()

  await grid.evaluate((element) => {
    element.scrollLeft = element.scrollWidth
  })
  // The prices came into view and the product is still at the left edge, over the code that went under it.
  await expect(lastPrice).toBeInViewport()
  await expect(name).toBeInViewport({ ratio: 1 })
  const gridBox = await grid.boundingBox()
  const nameBox = await name.boundingBox()
  expect(Math.abs((nameBox?.x ?? -1) - (gridBox?.x ?? 0))).toBeLessThan(4)
})

test("a wrong price is refused on the screen and nothing is sent", async ({
  page,
}) => {
  await mockSession(page, admin)
  await mockPriceTypes(page, priceTypes())
  await mockProducts(page, { total: 30 })
  const sent = await mockRevaluations(page)
  await page.goto("/revaluations/new")
  await addProducts(page, ["Товар 3"])
  await page.getByLabel("Товар 3, Розница").fill("1,005")
  await page.getByRole("button", { name: "Сохранить" }).click()
  await expect(page.getByText("Не все цены верны")).toBeVisible()
  await expect(page.getByLabel("Товар 3, Розница")).toBeFocused()
  expect(sent).toHaveLength(0)
})

test("posting over a price changed meanwhile shows it and refreshes the old prices", async ({
  page,
}) => {
  await mockSession(page, admin)
  await mockPriceTypes(page, priceTypes())
  await mockProducts(page, { total: 30 })
  const sent = await mockRevaluations(page, {
    changedOnPost: { productIndex: 0, currentPrice: "13000.00" },
  })
  await page.goto("/revaluations/new")
  await addProducts(page, ["Товар 3"])
  await page.getByLabel("Товар 3, Розница").fill("12500")
  await page.getByRole("button", { name: "Сохранить" }).click()
  await expect(
    page.getByRole("heading", { name: "Черновик переоценки" })
  ).toBeVisible()

  await page.getByRole("button", { name: "Провести" }).click()
  const confirm = page.getByRole("alertdialog")
  await confirm.getByRole("button", { name: "Провести" }).click()
  await expect(confirm).toContainText("Товар 3, Розница: сейчас 13 000,00")
  await confirm.getByRole("button", { name: "Обновить старые цены" }).click()
  await expect(confirm).toBeHidden()
  await expect(page.getByRole("row", { name: /Товар 3/ })).toContainText(
    "13 000,00"
  )

  await page.getByRole("button", { name: "Провести" }).click()
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Провести" })
    .click()
  await expect(page.getByText("Проведена").first()).toBeVisible()
  // The number is given at posting.
  await expect(
    page.getByRole("heading", { name: "Переоценка №1" })
  ).toBeVisible()
  expect(sent.map((s) => s.path.split("/").at(-1))).toEqual([
    "revaluations",
    "post",
    "refresh",
    "post",
  ])
})

test("the period filter keeps Tashkent days in the address and sends UTC instants", async ({
  page,
}) => {
  await mockSession(page, admin)
  await mockPriceTypes(page, priceTypes())
  const requests: URL[] = []
  await page.route(/\/api\/revaluations\?/, (route) => {
    requests.push(new URL(route.request().url()))
    return route.fulfill({ json: { items: [], nextCursor: null } })
  })
  await page.goto("/revaluations")
  await page.getByLabel("С", { exact: true }).fill("2026-10-01")
  await page.getByLabel("По", { exact: true }).fill("2026-10-31")
  await expect(page).toHaveURL(
    /from=2026-10-01.*to=2026-10-31|to=2026-10-31.*from=2026-10-01/
  )
  await expect
    .poll(() => requests.at(-1)?.searchParams.get("createdTo"))
    .toBe("2026-10-31T19:00:00.000Z")
  expect(requests.at(-1)?.searchParams.get("createdFrom")).toBe(
    "2026-09-30T19:00:00.000Z"
  )
})
