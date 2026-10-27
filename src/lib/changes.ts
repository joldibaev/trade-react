/**
 * The fields of `after` that differ from `before`. An edit sends only these, with the `version` it read, so it
 * never overwrites what someone else changed in another field, and the form knows whether a change needs a reason
 * (a new group, a deactivation). Arrays and objects compare by content.
 */
export function changedFields<T extends Record<string, unknown>>(
  before: T,
  after: T
): Partial<T> {
  const changes: Partial<T> = {}
  for (const key of Object.keys(after) as (keyof T)[]) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key]))
      changes[key] = after[key]
  }
  return changes
}
