import { describe, expect, it } from "vitest"

import {
  ancestorIds,
  branchIds,
  buildCategoryTree,
  categoryPath,
  flattenTree,
  type Category,
} from "./category-tree"

const category = (
  id: string,
  name: string,
  parentId: string | null = null
): Category => ({
  id,
  name,
  parentId,
  version: 1,
})

const list = [
  category("pens", "Ручки", "office"),
  category("toys", "Игрушки"),
  category("office", "Канцелярия"),
  category("books", "Тетради", "office"),
  category("squared", "В клетку", "books"),
  category("lost", "Сирота", "deleted-parent"),
]
const byId = new Map(list.map((c) => [c.id, c]))

describe("category tree", () => {
  it("builds the tree from the flat list, each level by name", () => {
    const flat = flattenTree(buildCategoryTree(list))
    expect(flat.map((n) => `${"-".repeat(n.depth)}${n.name}`)).toEqual([
      "Игрушки",
      "Канцелярия",
      "-Ручки",
      "-Тетради",
      "--В клетку",
      "Сирота",
    ])
  })

  it("names a category by its path", () => {
    expect(categoryPath("squared", byId)).toBe(
      "Канцелярия › Тетради › В клетку"
    )
    expect(categoryPath("toys", byId)).toBe("Игрушки")
  })

  it("knows a branch, where a category may not be moved", () => {
    const office = buildCategoryTree(list).find((n) => n.id === "office")
    if (!office) throw new Error("no office")
    expect(branchIds(office)).toEqual(
      new Set(["office", "pens", "books", "squared"])
    )
  })

  it("lists the ancestors to open, nearest first", () => {
    expect(ancestorIds("squared", byId)).toEqual(["books", "office"])
    expect(ancestorIds("toys", byId)).toEqual([])
  })
})
