import { useQuery } from "@tanstack/react-query"
import { useRouteContext } from "@tanstack/react-router"

import type { components } from "@/api/schema"

import { meQuery, type Me } from "./session"

export type Permission = components["schemas"]["Permission"]

/** The signed-in person, on any page inside the signed-in layout. */
export function useMe(): Me {
  const fromLayout = useRouteContext({ from: "/_app" }).me
  // The cache is newer than the layout's copy after the profile is edited or permissions are read again.
  return useQuery(meQuery).data ?? fromLayout
}

/**
 * `can("STORES_MANAGE")`: whether to show a menu item or a button. The server decides anyway (403); hiding only
 * spares people buttons that would refuse them. Checked by permission, never by group name (TradeNet ADR-0009).
 */
export function useCan() {
  const me = useMe()
  return (permission: Permission) => me.permissions.includes(permission)
}

/** Thrown by a route's `beforeLoad` when the person lacks its permission; the route shows "no access" instead. */
export class NoAccessError extends Error {
  constructor() {
    super("No access to this page.")
    this.name = "NoAccessError"
  }
}

/** For `beforeLoad`: a cashier who types /users sees "no access", not a failed request. */
export function requirePermission(me: Me, permission: Permission) {
  if (!me.permissions.includes(permission)) throw new NoAccessError()
}
