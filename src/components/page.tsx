import { EllipsisVerticalIcon } from "lucide-react"
import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useT } from "@/i18n/i18n"

/** The top of a page: its title, and its actions on the right (below the title on a phone). */
export function PageHeader({
  title,
  children,
  badge,
}: {
  title: string
  badge?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <h1 className="truncate font-heading text-xl font-semibold">{title}</h1>
        {badge}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      )}
    </div>
  )
}

/** "Активен" or "Неактивен": words, not only a color. */
export function ActiveBadge({
  active,
  activeLabel,
  inactiveLabel,
}: {
  active: boolean
  activeLabel: string
  inactiveLabel: string
}) {
  return active ? (
    <Badge variant="secondary">{activeLabel}</Badge>
  ) : (
    <Badge variant="outline">{inactiveLabel}</Badge>
  )
}

export type ActiveStatus = "active" | "inactive"

/** `?status=active|inactive` for a list route; anything else is "all". */
export function parseActiveStatus(value: unknown): ActiveStatus | undefined {
  return value === "active" || value === "inactive" ? value : undefined
}

/** The API's `isActive` filter for a status from the URL. */
export function isActiveFilter(status: ActiveStatus | undefined) {
  return status === undefined ? undefined : status === "active"
}

/** All / active / inactive, the filter of every list whose rows can be deactivated. */
export function ActiveStatusFilter({
  value,
  onChange,
}: {
  value: ActiveStatus | undefined
  onChange: (status: ActiveStatus | undefined) => void
}) {
  const t = useT()
  const options = [
    { value: "all", label: t.common.all },
    { value: "active", label: t.common.activeMany },
    { value: "inactive", label: t.common.inactiveMany },
  ] as const

  return (
    <ToggleGroup
      variant="outline"
      aria-label={t.common.status}
      value={[value ?? "all"]}
      onValueChange={(values: string[]) => {
        const next = values[0]
        // Pressing the chosen item again would leave nothing chosen; the filter always has one.
        if (next === undefined) return
        onChange(parseActiveStatus(next))
      }}
    >
      {options.map((option) => (
        <ToggleGroupItem key={option.value} value={option.value}>
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

export type RowAction = {
  label: string
  onSelect: () => void
  destructive?: boolean
}

/** The "⋮" menu of a table row; renders nothing when the person may do nothing with the row. */
export function RowActions({
  label,
  actions,
}: {
  /** Names the row, so a screen reader hears "Действия: Юнусабад", not ten identical buttons. */
  label: string
  actions: readonly RowAction[]
}) {
  const t = useT()
  if (actions.length === 0) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" />}
        aria-label={`${t.common.actions}: ${label}`}
      >
        <EllipsisVerticalIcon aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.label}
            variant={action.destructive ? "destructive" : "default"}
            onClick={action.onSelect}
          >
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** A label and a value in a details card ("Адрес: ул. Навои, 5"). */
export function DetailsList({
  items,
}: {
  items: readonly { label: string; value: ReactNode }[]
}) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[max-content_1fr]">
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-sm text-muted-foreground">{item.label}</dt>
          <dd className="min-w-0 text-sm break-words">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
