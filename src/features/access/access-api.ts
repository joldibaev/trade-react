import { queryOptions, type QueryClient } from "@tanstack/react-query"

import { api, unwrap } from "@/api/client"
import { cursorListOptions } from "@/api/cursor-pages"
import type { components } from "@/api/schema"
import { readAgainOnConflict } from "@/api/writes"
import { isActiveFilter, type ActiveStatus } from "@/components/page"
import { meQuery } from "@/features/auth/session"

export type User = components["schemas"]["UserResponse"]
export type Group = components["schemas"]["GroupDetailsResponse"]
export type Permission = components["schemas"]["Permission"]
export type SecurityEvent = components["schemas"]["SecurityEventResponse"]
export type SecurityAction = components["schemas"]["SecurityAction"]
export type Session = components["schemas"]["SessionResponse"]
export type StoreAccess = components["schemas"]["StoreAccessRequest"]

// ---- Users: only ADMIN (USERS_MANAGE) sees and changes them; nobody changes their own account here (OWN_ACCOUNT).

export type UserFilters = {
  search?: string
  groupId?: string
  status?: ActiveStatus
}

export function usersListOptions({ status, ...filters }: UserFilters) {
  return cursorListOptions(["users", "list", filters, status], (cursor) =>
    unwrap(
      api.GET("/api/users", {
        params: {
          query: {
            ...filters,
            isActive: isActiveFilter(status),
            cursor,
            limit: 100,
          },
        },
      })
    )
  )
}

export function userQuery(id: string) {
  return queryOptions({
    queryKey: ["users", "one", id],
    queryFn: () =>
      unwrap(api.GET("/api/users/{id}", { params: { path: { id } } })),
  })
}

function rememberUser(queryClient: QueryClient, user: User) {
  queryClient.setQueryData(userQuery(user.id).queryKey, user)
  void queryClient.invalidateQueries({ queryKey: ["users", "list"] })
  // The audit has a new row; a group's member count may have changed.
  void queryClient.invalidateQueries({ queryKey: ["security-events"] })
  void queryClient.invalidateQueries({ queryKey: ["groups"] })
  return user
}

export async function createUser(
  queryClient: QueryClient,
  body: components["schemas"]["CreateUserRequest"]
) {
  return rememberUser(
    queryClient,
    await unwrap(api.POST("/api/users", { body }))
  )
}

/** A new group, a deactivation and a password reset end all the person's sessions, and need a reason. */
export async function updateUser(
  queryClient: QueryClient,
  user: Pick<User, "id" | "version">,
  changes: Omit<components["schemas"]["UpdateUserRequest"], "version">
) {
  return rememberUser(
    queryClient,
    await readAgainOnConflict(
      queryClient,
      ["users"],
      unwrap(
        api.PATCH("/api/users/{id}", {
          params: { path: { id: user.id } },
          body: { version: user.version, ...changes },
        })
      )
    )
  )
}

export async function resetPassword(
  queryClient: QueryClient,
  user: Pick<User, "id" | "version">,
  body: { newPassword: string; reason: string }
) {
  return rememberUser(
    queryClient,
    await readAgainOnConflict(
      queryClient,
      ["users"],
      unwrap(
        api.POST("/api/users/{id}/password", {
          params: { path: { id: user.id } },
          body: { version: user.version, ...body },
        })
      )
    )
  )
}

/** Every security action, in the order a filter offers them. */
export const securityActions = [
  "LOGIN_SUCCEEDED",
  "LOGIN_FAILED",
  "LOGOUT",
  "SESSION_ENDED",
  "OTHER_SESSIONS_ENDED",
  "PASSWORD_CHANGED",
  "PROFILE_UPDATED",
  "USER_CREATED",
  "USER_UPDATED",
  "PASSWORD_RESET",
  "GROUP_CREATED",
  "GROUP_UPDATED",
  "GROUP_DELETED",
] as const satisfies readonly SecurityAction[]

/** The security history of a person or of a group, optionally of one action ("only failed sign-ins"). */
export function securityEventsOptions(
  subject: { userId: string } | { groupId: string },
  action: SecurityAction | undefined
) {
  const query = (cursor: string | undefined) => ({
    cursor,
    limit: 100,
    ...(action && { action: [action] }),
  })
  return "userId" in subject
    ? cursorListOptions(
        ["security-events", "user", subject.userId, action],
        (cursor) =>
          unwrap(
            api.GET("/api/users/{id}/security-events", {
              params: { path: { id: subject.userId }, query: query(cursor) },
            })
          )
      )
    : cursorListOptions(
        ["security-events", "group", subject.groupId, action],
        (cursor) =>
          unwrap(
            api.GET("/api/groups/{id}/security-events", {
              params: { path: { id: subject.groupId }, query: query(cursor) },
            })
          )
      )
}

/** Where the person is signed in, for an admin (never one's own: that is /api/auth/sessions). */
export function userSessionsQuery(userId: string) {
  return queryOptions({
    queryKey: ["users", "sessions", userId],
    queryFn: () =>
      unwrap(
        api.GET("/api/users/{id}/sessions", {
          params: { path: { id: userId } },
        })
      ),
  })
}

/** Ends one session of another person (a lost phone): the rest and the password stay. Audited, with the reason. */
export async function endUserSession(
  queryClient: QueryClient,
  userId: string,
  sessionId: string,
  reason: string | null
) {
  await unwrap(
    api.DELETE("/api/users/{id}/sessions/{sessionId}", {
      params: {
        path: { id: userId, sessionId },
        query: reason ? { reason } : {},
      },
    })
  )
  await queryClient.invalidateQueries({
    queryKey: ["users", "sessions", userId],
  })
  void queryClient.invalidateQueries({ queryKey: ["security-events"] })
}

// ---- Groups: the permissions a person has come from their one group (TradeNet ADR-0009).

export const groupsQuery = queryOptions({
  queryKey: ["groups", "list"],
  queryFn: () => unwrap(api.GET("/api/groups")),
})

/** The permissions a group may be given; USERS_MANAGE stays with the built-in ADMIN. */
export const grantablePermissionsQuery = queryOptions({
  queryKey: ["groups", "permissions"],
  queryFn: () => unwrap(api.GET("/api/groups/permissions")),
  staleTime: Infinity,
})

export function groupQuery(id: string) {
  return queryOptions({
    queryKey: ["groups", "one", id],
    queryFn: () =>
      unwrap(api.GET("/api/groups/{id}", { params: { path: { id } } })),
  })
}

function rememberGroup(queryClient: QueryClient, group: Group) {
  queryClient.setQueryData(groupQuery(group.id).queryKey, group)
  void queryClient.invalidateQueries({ queryKey: ["groups", "list"] })
  void queryClient.invalidateQueries({ queryKey: ["security-events"] })
  // A renamed group shows under its new name in the users list.
  void queryClient.invalidateQueries({ queryKey: ["users"] })
  return group
}

export async function createGroup(
  queryClient: QueryClient,
  body: components["schemas"]["CreateGroupRequest"]
) {
  return rememberGroup(
    queryClient,
    await unwrap(api.POST("/api/groups", { body }))
  )
}

/** A rename, or new permissions (which need a reason); members get them on their next click. */
export async function updateGroup(
  queryClient: QueryClient,
  group: Pick<Group, "id" | "version">,
  changes: Omit<components["schemas"]["UpdateGroupRequest"], "version">
) {
  return rememberGroup(
    queryClient,
    await readAgainOnConflict(
      queryClient,
      ["groups"],
      unwrap(
        api.PATCH("/api/groups/{id}", {
          params: { path: { id: group.id } },
          body: { version: group.version, ...changes },
        })
      )
    )
  )
}

/** Only a group nobody is in (deactivated people included) is deleted (409 `GROUP_HAS_USERS`). */
export async function deleteGroup(
  queryClient: QueryClient,
  group: Pick<Group, "id" | "version">
) {
  await readAgainOnConflict(
    queryClient,
    ["groups"],
    unwrap(
      api.DELETE("/api/groups/{id}", {
        params: { path: { id: group.id }, query: { version: group.version } },
      })
    )
  )
  queryClient.removeQueries({ queryKey: groupQuery(group.id).queryKey })
  void queryClient.invalidateQueries({ queryKey: ["groups", "list"] })
}

// ---- Own account: everyone signed in, under /api/auth.

export async function updateProfile(
  queryClient: QueryClient,
  version: number,
  changes: { fullName?: string; phone?: string }
) {
  const me = await readAgainOnConflict(
    queryClient,
    meQuery.queryKey,
    unwrap(api.PATCH("/api/auth/me", { body: { version, ...changes } }))
  )
  queryClient.setQueryData(meQuery.queryKey, me)
  return me
}

/** The other sessions end; this one gets a new token in its cookie (TradeNet authentication.md). */
export async function changePassword(
  queryClient: QueryClient,
  body: components["schemas"]["ChangePasswordRequest"]
) {
  await unwrap(api.POST("/api/auth/password", { body }))
  void queryClient.invalidateQueries({ queryKey: ["auth", "sessions"] })
}

export const sessionsQuery = queryOptions({
  queryKey: ["auth", "sessions"],
  queryFn: () => unwrap(api.GET("/api/auth/sessions")),
})

export async function endSession(queryClient: QueryClient, id: string) {
  await unwrap(
    api.DELETE("/api/auth/sessions/{id}", { params: { path: { id } } })
  )
  await queryClient.invalidateQueries({ queryKey: ["auth", "sessions"] })
}

export async function endOtherSessions(queryClient: QueryClient) {
  await unwrap(api.DELETE("/api/auth/sessions/others"))
  await queryClient.invalidateQueries({ queryKey: ["auth", "sessions"] })
}
