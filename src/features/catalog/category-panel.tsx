import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { ChevronRightIcon, PlusIcon } from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"
import { cn } from "cn"

import { RowActions } from "@/components/page"
import { ProblemAlert } from "@/components/problem-alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useCan } from "@/features/auth/permissions"
import { useT } from "@/i18n/i18n"

import { categoriesQuery } from "./categories-api"
import { CategoryFormDialog, DeleteCategoryDialog } from "./category-dialogs"
import {
  ancestorIds,
  buildCategoryTree,
  type Category,
  type CategoryNode,
} from "./category-tree"

/** Which part of the catalog the product list shows: everything, one category (with its subcategories), or none. */
export type CategoryChoice = { categoryId?: string; withoutCategory?: true }

type Command =
  | { kind: "create"; parentId: string | null }
  | { kind: "edit"; category: Category }
  | { kind: "delete"; category: CategoryNode }

/**
 * The category tree beside the product list. Every node is a link (Back works, a node opens in a new tab), with
 * a disclosure button for its children; people with `CATALOG_MANAGE` add, rename, move and delete categories here.
 */
export function CategoryPanel({
  selected,
  onNavigate,
}: {
  selected: CategoryChoice
  /** Called after a choice: the phone's sheet closes. */
  onNavigate?: () => void
}) {
  const t = useT()
  const can = useCan()
  const canManage = can("CATALOG_MANAGE")
  const navigate = useNavigate({ from: "/products/" })
  const query = useQuery(categoriesQuery)
  const [command, setCommand] = useState<Command | null>(null)
  const close = () => {
    setCommand(null)
  }

  const { tree, byId } = useMemo(() => {
    const list = query.data ?? []
    return {
      tree: buildCategoryTree(list),
      byId: new Map(list.map((c) => [c.id, c])),
    }
  }, [query.data])

  // The chosen category and the branches leading to it start open: the choice and its subcategories are visible
  // (a new subcategory too). The person's own clicks win.
  const [toggled, setToggled] = useState<ReadonlyMap<string, boolean>>(
    () => new Map()
  )
  const isOpen = (id: string) =>
    toggled.get(id) ??
    (selected.categoryId !== undefined &&
      (selected.categoryId === id ||
        ancestorIds(selected.categoryId, byId).includes(id)))
  const toggle = (id: string) => {
    const next = !isOpen(id)
    setToggled((current) => new Map(current).set(id, next))
  }

  const renderNodes = (nodes: readonly CategoryNode[]): ReactNode => (
    <ul className="flex flex-col">
      {nodes.map((node) => {
        const open = isOpen(node.id)
        return (
          <li key={node.id}>
            <div
              className="group flex items-center gap-0.5"
              style={{ paddingLeft: node.depth * 16 }}
            >
              {node.children.length > 0 ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-expanded={open}
                  aria-label={`${open ? t.categories.collapse : t.categories.expand}: ${node.name}`}
                  onClick={() => {
                    toggle(node.id)
                  }}
                >
                  <ChevronRightIcon
                    aria-hidden
                    className={cn("transition-transform", open && "rotate-90")}
                  />
                </Button>
              ) : (
                <span className="size-8 shrink-0" />
              )}
              <ChoiceLink
                choice={{ categoryId: node.id }}
                current={selected.categoryId === node.id}
                onNavigate={onNavigate}
              >
                {node.name}
              </ChoiceLink>
              {canManage && (
                <RowActions
                  label={node.name}
                  actions={[
                    {
                      label: t.categories.addChild,
                      onSelect: () => {
                        setCommand({ kind: "create", parentId: node.id })
                      },
                    },
                    {
                      label: t.categories.edit,
                      onSelect: () => {
                        setCommand({ kind: "edit", category: node })
                      },
                    },
                    {
                      label: t.categories.delete,
                      destructive: true,
                      onSelect: () => {
                        setCommand({ kind: "delete", category: node })
                      },
                    },
                  ]}
                />
              )}
            </div>
            {open && node.children.length > 0 && renderNodes(node.children)}
          </li>
        )
      })}
    </ul>
  )

  return (
    <nav
      aria-label={t.categories.title}
      className="flex min-h-0 flex-col gap-2"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-sm font-semibold">
          {t.categories.title}
        </h2>
        {canManage && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t.categories.createTitle}
            onClick={() => {
              setCommand({
                kind: "create",
                parentId: selected.categoryId ?? null,
              })
            }}
          >
            <PlusIcon aria-hidden />
          </Button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ChoiceLink
          choice={{}}
          current={!selected.categoryId && !selected.withoutCategory}
          onNavigate={onNavigate}
          className="pl-8"
        >
          {t.categories.all}
        </ChoiceLink>
        {query.isPending ? (
          <div className="flex flex-col gap-2 p-2">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-6 w-1/2" />
          </div>
        ) : query.isError ? (
          <ProblemAlert
            title={t.categories.loadFailed}
            error={query.error}
            onRetry={() => void query.refetch()}
          />
        ) : tree.length === 0 ? (
          <p className="p-2 text-sm text-muted-foreground">
            {canManage ? t.categories.emptyManage : t.categories.empty}
          </p>
        ) : (
          renderNodes(tree)
        )}
        <ChoiceLink
          choice={{ withoutCategory: true }}
          current={selected.withoutCategory === true}
          onNavigate={onNavigate}
          className="pl-8 text-muted-foreground"
        >
          {t.categories.without}
        </ChoiceLink>
      </div>
      {command?.kind === "create" && (
        <CategoryFormDialog
          parentId={command.parentId}
          open
          onOpenChange={close}
        />
      )}
      {command?.kind === "edit" && (
        <CategoryFormDialog
          category={command.category}
          open
          onOpenChange={close}
        />
      )}
      {command?.kind === "delete" && (
        <DeleteCategoryDialog
          category={command.category}
          open
          onOpenChange={close}
          onDeleted={() => {
            // The list was filtered by the category that is gone: show everything instead.
            if (selected.categoryId === command.category.id)
              void navigate({
                search: (prev) => ({ ...prev, categoryId: undefined }),
              })
          }}
        />
      )}
    </nav>
  )
}

/** A link to the product list with another category choice; the search and status filters stay. */
function ChoiceLink({
  choice,
  current,
  onNavigate,
  className,
  children,
}: {
  choice: CategoryChoice
  current: boolean
  onNavigate: (() => void) | undefined
  className?: string
  children: ReactNode
}) {
  return (
    <Link
      from="/products/"
      to="/products"
      search={(prev) => ({
        ...prev,
        categoryId: choice.categoryId,
        withoutCategory: choice.withoutCategory,
      })}
      // The router would call every /products link "active"; which category is chosen is decided here.
      activeOptions={{
        exact: true,
        includeSearch: true,
        explicitUndefined: true,
      }}
      activeProps={{}}
      aria-current={current ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "block min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-sm hover:bg-muted aria-[current=page]:bg-muted aria-[current=page]:font-medium",
        className
      )}
    >
      {children}
    </Link>
  )
}
