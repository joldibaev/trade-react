import { QueryClient } from "@tanstack/react-query"
import { describe, expect, it } from "vitest"

import { wholeListOptions } from "./cursor-pages"
import { isApiError } from "./errors"

describe("wholeListOptions", () => {
  it("gives the rows of a list answered whole", async () => {
    const client = new QueryClient()
    const rows = await client.query(
      wholeListOptions(["test", "whole"], () =>
        Promise.resolve({ items: [{ id: "a" }], nextCursor: null })
      )
    )
    expect(rows).toEqual([{ id: "a" }])
  })

  it("refuses a list that started paging instead of showing its first page as all of it", async () => {
    const client = new QueryClient()
    const error: unknown = await client
      .query(
        wholeListOptions(["test", "paged"], () =>
          Promise.resolve({ items: [{ id: "a" }], nextCursor: "next" })
        )
      )
      .catch((e: unknown) => e)
    expect(isApiError(error) && error.code).toBe("UNEXPECTED_RESPONSE")
  })
})
