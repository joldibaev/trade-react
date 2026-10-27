import { expect, test } from "@playwright/test"

import { mockAccess, mockSessions } from "./support/access"
import { admin, cashier, mockSession } from "./support/api"
import { mockStores, store } from "./support/stores"

test("a cashier who types /users sees no access, and no such menu item", async ({
  page,
  isMobile,
}) => {
  await mockSession(page, cashier)
  await mockAccess(page)
  await page.goto("/users")
  await expect(page.getByText("Нет доступа к этому разделу")).toBeVisible()
  if (isMobile) await page.getByRole("button", { name: "Открыть меню" }).click()
  await expect(page.getByRole("link", { name: "Магазины" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Пользователи" })).toHaveCount(0)
})

test("moving a person to another group asks for a reason first", async ({
  page,
}) => {
  await mockSession(page, admin)
  const { writes } = await mockAccess(page)
  await mockStores(page, [store(1, "Юнусабад")])
  await page.goto("/users")
  await page.getByRole("link", { name: cashier.fullName }).click()
  await page.getByRole("button", { name: "Изменить" }).click()

  const dialog = page.getByRole("dialog", { name: "Изменить пользователя" })
  await dialog.getByLabel("Группа").click()
  await page.getByRole("option", { name: "Менеджеры" }).click()
  await expect(
    dialog.getByText("Смена группы завершит все сеансы")
  ).toBeVisible()
  await dialog.getByRole("button", { name: "Сохранить" }).click()
  await expect(dialog.getByText("Заполните поле.")).toBeVisible()
  await expect(dialog.getByLabel("Причина (обязательно)")).toBeFocused()
  expect(writes).toHaveLength(0)

  await dialog.getByLabel("Причина (обязательно)").fill("Повышение")
  await dialog.getByRole("button", { name: "Сохранить" }).click()
  await expect(dialog).toBeHidden()
  expect(writes[0]?.body).toEqual({
    version: 1,
    groupId: "00000000-0000-7000-8000-000000000031",
    reason: "Повышение",
  })
  await expect(page.getByRole("link", { name: "Менеджеры" })).toBeVisible()
})

test("an admin's own page has no way to change their own account", async ({
  page,
}) => {
  await mockSession(page, admin)
  await mockAccess(page)
  await page.goto(`/users/${admin.id}`)
  await expect(
    page.getByRole("heading", { name: admin.fullName })
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "Изменить" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Отключить" })).toHaveCount(0)
  await expect(page.getByRole("link", { name: "Мой профиль" })).toBeVisible()
})

test("a group with people cannot be deleted; new permissions need a reason", async ({
  page,
}) => {
  await mockSession(page, admin)
  const { writes } = await mockAccess(page)
  await page.goto("/groups")
  await page.getByRole("link", { name: "Кассиры" }).click()
  await expect(
    page.getByRole("button", { name: "Удалить группу" })
  ).toBeDisabled()

  await page.getByRole("button", { name: "Изменить" }).click()
  const dialog = page.getByRole("dialog", { name: "Изменить группу" })
  await dialog.getByRole("checkbox", { name: "Каталог товаров" }).click()
  await dialog.getByRole("button", { name: "Сохранить" }).click()
  await expect(dialog.getByText("Заполните поле.")).toBeVisible()
  expect(writes).toHaveLength(0)
  await dialog.getByLabel("Причина").fill("Кассиры правят каталог")
  await dialog.getByRole("button", { name: "Сохранить" }).click()
  await expect(dialog).toBeHidden()
  expect(writes[0]?.body).toEqual({
    version: 1,
    permissions: ["CATALOG_MANAGE"],
    reason: "Кассиры правят каталог",
  })
  await expect(page.getByText("Каталог товаров", { exact: true })).toBeVisible()
})

test("own account: a mistyped new password is caught, other sessions end on request", async ({
  page,
}) => {
  await mockSession(page, cashier)
  const ended = await mockSessions(page)
  await page.goto("/account")

  await page.getByLabel("Текущий пароль").fill("old-password-123456")
  await page.getByLabel("Новый пароль").fill("new-password-1234567")
  await page.getByLabel("Повторите пароль").fill("new-password-1234568")
  await page.getByRole("button", { name: "Сменить пароль" }).click()
  await expect(page.getByText("Пароли не совпадают.")).toBeVisible()

  await expect(
    page.getByRole("cell", { name: "Safari на iPhone", exact: true })
  ).toBeVisible()
  await page.getByRole("button", { name: "Завершить остальные" }).click()
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Завершить остальные" })
    .click()
  await expect(
    page.getByRole("cell", { name: "Safari на iPhone", exact: true })
  ).toHaveCount(0)
  expect(ended).toEqual(["00000000-0000-7000-8000-000000000102"])
})

test("the history speaks plainly, filters by event through the address, and an admin ends one session", async ({
  page,
}) => {
  await mockSession(page, admin)
  const { ended, requests } = await mockAccess(page)
  await page.goto(`/groups/${cashier.group.id}`)
  await expect(
    page.getByRole("cell", { name: "Права: Нет прав → Каталог товаров" })
  ).toBeVisible()
  await expect(
    page.getByRole("cell", { name: admin.fullName, exact: true })
  ).toBeVisible()

  await page.goto(`/users/${cashier.id}`)
  await page.getByRole("combobox", { name: "Событие" }).click()
  await page.getByRole("option", { name: "Неудачный вход" }).click()
  await expect(page).toHaveURL(/action=LOGIN_FAILED/)
  await expect
    .poll(() =>
      requests
        .filter((u) => u.pathname.endsWith("/security-events"))
        .at(-1)
        ?.searchParams.getAll("action")
    )
    .toEqual(["LOGIN_FAILED"])

  await page
    .getByRole("button", { name: "Завершить: Chrome на Android" })
    .click()
  const dialog = page.getByRole("dialog", { name: /^Завершить сеанс/ })
  await dialog.getByLabel("Причина").fill("Потерян телефон")
  await dialog.getByRole("button", { name: "Завершить сеанс" }).click()
  await expect(dialog).toBeHidden()
  expect(ended).toEqual(["00000000-0000-7000-8000-000000000201"])
  const end = requests.find((u) => u.pathname.includes("/sessions/"))
  expect(end?.searchParams.get("reason")).toBe("Потерян телефон")
  await expect(page.getByText("Сейчас он нигде не вошёл.")).toBeVisible()
})
