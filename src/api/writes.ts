import type { QueryClient, QueryKey } from "@tanstack/react-query"

import { isApiError } from "./errors"

/**
 * An edit that sent an old `version` (409 `VERSION_CONFLICT`) proves that the data on screen is old: read it again,
 * so the next attempt starts from what is saved. An edit form keeps its own copy and the person's edits until they
 * choose "load current data".
 */
export async function readAgainOnConflict<T>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  write: Promise<T>
): Promise<T> {
  try {
    return await write
  } catch (error) {
    if (isApiError(error) && error.code === "VERSION_CONFLICT")
      void queryClient.invalidateQueries({ queryKey })
    throw error
  }
}
