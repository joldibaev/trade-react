import type { components } from "@/api/schema"

export type Category = components["schemas"]["CategoryResponse"]

export type CategoryNode = Category & {
  depth: number
  children: CategoryNode[]
}

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, "ru")

/**
 * TradeNet answers every category as one flat list with `parentId` (catalog.md); the screen draws the tree.
 * Each level is sorted by name. A category whose parent is missing (it cannot happen, but data outlives rules)
 * goes to the top instead of disappearing.
 */
export function buildCategoryTree(
  categories: readonly Category[]
): CategoryNode[] {
  const ids = new Set(categories.map((c) => c.id))
  const childrenOf = new Map<string | null, Category[]>()
  for (const category of categories) {
    const parent =
      category.parentId !== null && ids.has(category.parentId)
        ? category.parentId
        : null
    childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), category])
  }
  const build = (parent: string | null, depth: number): CategoryNode[] =>
    (childrenOf.get(parent) ?? []).sort(byName).map((category) => ({
      ...category,
      depth,
      children: build(category.id, depth + 1),
    }))
  return build(null, 0)
}

/** The tree as one list in reading order: a parent, then its children. */
export function flattenTree(nodes: readonly CategoryNode[]): CategoryNode[] {
  return nodes.flatMap((node) => [node, ...flattenTree(node.children)])
}

/** `"Канцелярия › Тетради"`: where a category sits, for a table cell or a choice in a list. */
export function categoryPath(
  id: string,
  byId: ReadonlyMap<string, Category>
): string {
  const names: string[] = []
  const seen = new Set<string>()
  let current = byId.get(id)
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    names.unshift(current.name)
    current = current.parentId === null ? undefined : byId.get(current.parentId)
  }
  return names.join(" › ")
}

/** The ids of a category and of everything under it: where it cannot be moved (409 `CATEGORY_CYCLE`). */
export function branchIds(node: CategoryNode): Set<string> {
  return new Set(flattenTree([node]).map((n) => n.id))
}

/** The ids above a category, nearest first: the branches to open so it is visible. */
export function ancestorIds(
  id: string,
  byId: ReadonlyMap<string, Category>
): string[] {
  const ids: string[] = []
  let parent = byId.get(id)?.parentId ?? null
  while (parent !== null && !ids.includes(parent)) {
    ids.push(parent)
    parent = byId.get(parent)?.parentId ?? null
  }
  return ids
}
