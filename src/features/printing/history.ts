import { useCallback, useState } from "react"

const depth = 100

type History<T> = {
  past: T[]
  present: T
  future: T[]
  lastStep: string | null
}

/**
 * Undo and redo of the editor's draft, up to 100 steps. A step is a run of changes with the same name: one drag, one
 * resize, typing in one field. Any other change starts a new step. No hotkeys (owner rule): buttons only.
 */
export function useHistory<T>(initial: T) {
  const [history, setHistory] = useState<History<T>>({
    past: [],
    present: initial,
    future: [],
    lastStep: null,
  })

  const change = useCallback((next: T, step: string | null = null) => {
    setHistory((current) => {
      if (Object.is(next, current.present)) return current
      // The same named step goes on: the draft changes, the undo point stays where the step began.
      if (step !== null && step === current.lastStep)
        return { ...current, present: next, future: [] }
      return {
        past: [...current.past, current.present].slice(-depth),
        present: next,
        future: [],
        lastStep: step,
      }
    })
  }, [])

  const undo = useCallback(() => {
    setHistory((current) => {
      const previous = current.past.at(-1)
      if (previous === undefined) return current
      return {
        past: current.past.slice(0, -1),
        present: previous,
        future: [current.present, ...current.future],
        lastStep: null,
      }
    })
  }, [])

  const redo = useCallback(() => {
    setHistory((current) => {
      const [next, ...rest] = current.future
      if (next === undefined) return current
      return {
        past: [...current.past, current.present],
        present: next,
        future: rest,
        lastStep: null,
      }
    })
  }, [])

  /** Starts over from a saved or reloaded state, with no undo past it. */
  const reset = useCallback((next: T) => {
    setHistory({ past: [], present: next, future: [], lastStep: null })
  }, [])

  return {
    draft: history.present,
    change,
    undo,
    redo,
    reset,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  }
}
