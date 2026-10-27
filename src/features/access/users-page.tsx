import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { PlusIcon, SearchIcon } from "lucide-react"
import { useMemo, useState } from "react"

import { DataTable } from "@/components/data-table/data-table"
import { dataTableColumns } from "@/components/data-table/columns"
import { useCursorSource } from "@/components/data-table/sources"
import { ActiveBadge, ActiveStatusFilter, PageHeader } from "@/components/page"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useMe } from "@/features/auth/permissions"
import { useT } from "@/i18n/i18n"
import type { Messages } from "@/i18n/messages/ru"

import {
  groupsQuery,
  usersListOptions,
  type User,
  type UserFilters,
} from "./access-api"
import { UserFormDialog } from "./user-dialogs"

const column = dataTableColumns<User>()

export function storeAccessText(t: Messages, stores: User["stores"]) {
  if (stores.all) return t.users.allStores
  if (stores.storeIds.length === 0) return t.users.noStores
  return `${t.users.someStores}: ${String(stores.storeIds.length)}`
}

function userColumns(t: Messages, meId: string) {
  return column.columns([
    column.accessor("fullName", {
      header: t.users.fullName,
      size: 220,
      meta: { grow: true },
      cell: (info) => (
        <span className="flex items-center gap-2">
          <Link
            to="/users/$userId"
            params={{ userId: info.row.original.id }}
            className="truncate font-medium underline-offset-4 hover:underline"
          >
            {info.getValue()}
          </Link>
          {info.row.original.id === meId && (
            <Badge variant="secondary">{t.users.you}</Badge>
          )}
        </span>
      ),
    }),
    column.accessor("login", { header: t.users.login, size: 140 }),
    column.accessor("phone", { header: t.users.phone, size: 150 }),
    column.accessor((row) => row.group.name, {
      id: "group",
      header: t.users.group,
      size: 180,
    }),
    column.accessor("stores", {
      header: t.users.stores,
      size: 150,
      cell: (info) => storeAccessText(t, info.getValue()),
    }),
    column.accessor("isActive", {
      header: t.common.status,
      size: 120,
      cell: (info) => (
        <ActiveBadge
          active={info.getValue()}
          activeLabel={t.users.active}
          inactiveLabel={t.users.inactive}
        />
      ),
    }),
  ])
}

/** Everyone who signs in; only ADMIN sees this page (USERS_MANAGE). Filters live in the URL. */
export function UsersPage({ filters }: { filters: UserFilters }) {
  const t = useT()
  const me = useMe()
  const navigate = useNavigate({ from: "/users/" })
  const [creating, setCreating] = useState(false)
  const groups = useQuery(groupsQuery).data ?? []
  const columns = useMemo(() => userColumns(t, me.id), [t, me.id])
  const source = useCursorSource(useInfiniteQuery(usersListOptions(filters)))
  const allGroups = "all"

  return (
    <>
      <PageHeader title={t.users.title}>
        <Button
          onClick={() => {
            setCreating(true)
          }}
        >
          <PlusIcon data-icon="inline-start" aria-hidden />
          {t.users.create}
        </Button>
      </PageHeader>
      <div className="flex flex-wrap items-center gap-2">
        <UserSearch key={filters.search} initial={filters.search ?? ""} />
        <Select
          value={filters.groupId ?? allGroups}
          items={[
            { value: allGroups, label: t.users.allGroups },
            ...groups.map((g) => ({ value: g.id, label: g.name })),
          ]}
          onValueChange={(value) => {
            void navigate({
              search: (prev) => ({
                ...prev,
                groupId: value && value !== allGroups ? value : undefined,
              }),
            })
          }}
        >
          <SelectTrigger aria-label={t.users.group} className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={allGroups}>{t.users.allGroups}</SelectItem>
            {groups.map((group) => (
              <SelectItem key={group.id} value={group.id}>
                {group.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ActiveStatusFilter
          value={filters.status}
          onChange={(status) => {
            void navigate({ search: (prev) => ({ ...prev, status }) })
          }}
        />
      </div>
      <DataTable
        label={t.users.title}
        columns={columns}
        source={source}
        className="flex-1"
        empty={
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{t.common.nothingFound}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        }
      />
      {creating && (
        <UserFormDialog
          open
          onOpenChange={setCreating}
          onSaved={(user) => {
            void navigate({ to: "/users/$userId", params: { userId: user.id } })
          }}
        />
      )}
    </>
  )
}

function UserSearch({ initial }: { initial: string }) {
  const t = useT()
  const navigate = useNavigate({ from: "/users/" })
  const [value, setValue] = useState(initial)
  return (
    <form
      role="search"
      className="w-full sm:w-72"
      onSubmit={(event) => {
        event.preventDefault()
        const search = value.trim()
        void navigate({
          search: (prev) => ({ ...prev, search: search || undefined }),
        })
      }}
    >
      <InputGroup>
        <InputGroupAddon>
          <SearchIcon aria-hidden />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          aria-label={t.users.search}
          placeholder={t.users.search}
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
          }}
        />
      </InputGroup>
    </form>
  )
}
