import { expect, test } from "@playwright/test"

import { admin, mockProducts, mockSession, problem } from "./support/api"

test("sends a signed-out person to sign-in and back to the page they asked for", async ({
  page,
}) => {
  await mockSession(page, null)
  await mockProducts(page, { total: 5 })
  await page.route("**/api/auth/login", async (route) => {
    const body = route.request().postDataJSON() as { password: string }
    if (body.password !== "admin-dev-password")
      return problem(route, 401, "INVALID_CREDENTIALS")
    return route.fulfill({ json: admin })
  })

  await page.goto("/products?search=1")
  await expect(page).toHaveURL(/\/login\?redirect=/)

  await page.getByRole("button", { name: "Войти" }).click()
  await expect(page.getByText("Заполните поле.").first()).toBeVisible()
  await expect(page.getByLabel("Логин")).toBeFocused()

  await page.getByLabel("Логин").fill("admin")
  await page.getByLabel("Пароль").fill("wrong")
  await page.getByRole("button", { name: "Войти" }).click()
  await expect(page.getByText("Неверный логин или пароль.")).toBeVisible()

  await page.getByLabel("Пароль").fill("admin-dev-password")
  await page.getByRole("button", { name: "Войти" }).click()
  await expect(page).toHaveURL(/\/products\?search=1$/)
  await expect(page.getByRole("heading", { name: "Товары" })).toBeVisible()
})

test("an ended session in the middle of work leads to sign-in", async ({
  page,
}) => {
  await mockSession(page, admin)
  await page.route("**/api/products?**", (route) =>
    problem(route, 401, "UNAUTHENTICATED")
  )

  await page.goto("/products")

  await expect(page).toHaveURL(/\/login\?redirect=%2Fproducts/)
  await expect(page.getByRole("heading", { name: "Вход" })).toBeVisible()
})

test("switches the language for this browser, the sign-in page included", async ({
  page,
}) => {
  await mockSession(page, null)
  await page.goto("/login")

  await page.getByRole("button", { name: /Язык/ }).click()
  await page.getByRole("menuitemradio", { name: "Oʻzbekcha" }).click()

  await expect(page.getByRole("heading", { name: "Kirish" })).toBeVisible()
  await expect(page.locator("html")).toHaveAttribute("lang", "uz-Latn")
  await page.reload()
  await expect(page.getByRole("heading", { name: "Kirish" })).toBeVisible()
})
