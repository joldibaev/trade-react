import type { Page } from "@playwright/test"

import type { components } from "../../src/api/schema"
import { admin, cashier, problem } from "./api"

type User = components["schemas"]["UserResponse"]
type Group = components["schemas"]["GroupDetailsResponse"]

export function groups(): Group[] {
  return [
    {
      id: admin.group.id,
      name: "ADMIN",
      builtIn: true,
      permissions: [...admin.permissions],
      users: 1,
      version: 1,
    },
    {
      id: cashier.group.id,
      name: "Кассиры",
      builtIn: false,
      permissions: [],
      users: 1,
      version: 1,
    },
    {
      id: "00000000-0000-7000-8000-000000000031",
      name: "Менеджеры",
      builtIn: false,
      permissions: ["STORES_MANAGE", "CATALOG_MANAGE"],
      users: 0,
      version: 1,
    },
  ]
}

export function users(): User[] {
  const user = (me: typeof admin): User => ({
    id: me.id,
    login: me.login,
    fullName: me.fullName,
    phone: me.phone,
    group: me.group,
    stores: { all: me === admin, storeIds: [] },
    isActive: true,
    createdAt: "2026-10-01T05:00:00Z",
    version: 1,
  })
  return [user(admin), user(cashier)]
}

/**
 * Users, groups, their (empty) security history and the permission list, in memory. Writes are recorded and
 * applied; a write that names the wrong version gets 409, as in TradeNet.
 */
export async function mockAccess(page: Page) {
  const people = users()
  const list = groups()
  const writes: { method: string; path: string; body: unknown }[] = []
  const ended: string[] = []
  const seen: URL[] = []
  const actor = { id: admin.id, fullName: admin.fullName }
  const events = [
    {
      id: 2,
      at: "2026-10-27T05:00:00Z",
      action: "GROUP_UPDATED",
      actor,
      sessionId: null,
      login: null,
      ipAddress: "10.0.0.5",
      reason: "Кассиры правят каталог",
      details: { permissions: { from: [], to: ["CATALOG_MANAGE"] } },
    },
    {
      id: 1,
      at: "2026-10-27T04:00:00Z",
      action: "LOGIN_FAILED",
      actor: null,
      sessionId: null,
      login: "cashier",
      ipAddress: "10.0.0.9",
      reason: null,
      details: null,
    },
  ]
  const userSessions = [
    {
      id: "00000000-0000-7000-8000-000000000201",
      createdAt: "2026-10-26T05:00:00Z",
      lastSeenAt: "2026-10-27T04:30:00Z",
      ipAddress: "10.0.0.9",
      userAgent: "Chrome на Android",
      current: false,
    },
  ]

  await page.route(/\/api\/(users|groups)(\/|\?|$)/, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const [, , kind, id, sub] = url.pathname.split("/")
    const body = request.postDataJSON() as Record<string, unknown> | null
    seen.push(url)
    if (request.method() !== "GET")
      writes.push({ method: request.method(), path: url.pathname, body })

    if (sub === "security-events") {
      const actions = url.searchParams.getAll("action")
      return route.fulfill({
        json: {
          items: events.filter(
            (e) => actions.length === 0 || actions.includes(e.action)
          ),
          nextCursor: null,
        },
      })
    }
    if (sub === "sessions") {
      const sessionId = url.pathname.split("/")[5]
      if (request.method() === "GET")
        return route.fulfill({
          json: {
            items: userSessions.filter((x) => !ended.includes(x.id)),
            nextCursor: null,
          },
        })
      if (sessionId) ended.push(sessionId)
      return route.fulfill({ status: 204 })
    }
    if (kind === "groups" && id === "permissions")
      return route.fulfill({
        json: {
          items: ["STORES_MANAGE", "CATALOG_MANAGE", "PRICES_MANAGE"],
          nextCursor: null,
        },
      })
    const items: { id: string; version: number }[] =
      kind === "users" ? people : list
    if (!id && request.method() === "GET")
      return route.fulfill({
        json: { items: kind === "users" ? people : list, nextCursor: null },
      })
    const target = items.find((item) => item.id === id)
    if (!target)
      return problem(
        route,
        404,
        kind === "users" ? "USER_NOT_FOUND" : "GROUP_NOT_FOUND"
      )
    if (request.method() === "GET") return route.fulfill({ json: target })
    if (body?.version !== target.version)
      return problem(route, 409, "VERSION_CONFLICT")
    const changes: Record<string, unknown> = { ...body }
    delete changes.reason
    delete changes.version
    if (kind === "users" && typeof changes.groupId === "string") {
      const group = list.find((g) => g.id === changes.groupId)
      if (group) (target as User).group = { id: group.id, name: group.name }
      delete changes.groupId
    }
    Object.assign(target, changes, { version: target.version + 1 })
    return route.fulfill({ json: target })
  })
  return { writes, ended, requests: seen }
}

export async function mockSessions(page: Page) {
  const sessions = [
    {
      id: "00000000-0000-7000-8000-000000000101",
      createdAt: "2026-10-27T05:00:00Z",
      lastSeenAt: "2026-10-27T09:00:00Z",
      ipAddress: "10.0.0.5",
      userAgent: "Chrome на Windows",
      current: true,
    },
    {
      id: "00000000-0000-7000-8000-000000000102",
      createdAt: "2026-10-20T05:00:00Z",
      lastSeenAt: "2026-10-26T18:00:00Z",
      ipAddress: "10.0.0.9",
      userAgent: "Safari на iPhone",
      current: false,
    },
  ]
  const ended: string[] = []
  await page.route(/\/api\/auth\/sessions(\/[^?]*)?$/, (route) => {
    const request = route.request()
    if (request.method() === "GET")
      return route.fulfill({
        json: {
          items: sessions.filter((s) => !ended.includes(s.id)),
          nextCursor: null,
        },
      })
    const id = new URL(request.url()).pathname.split("/").at(-1) ?? ""
    if (id === "others")
      ended.push(...sessions.filter((s) => !s.current).map((s) => s.id))
    else ended.push(id)
    return route.fulfill({ status: 204 })
  })
  return ended
}
