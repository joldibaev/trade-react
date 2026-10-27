import { useSyncExternalStore } from "react"

const query = "(max-width: 767px)"

function subscribe(onChange: () => void) {
  const list = window.matchMedia(query)
  list.addEventListener("change", onChange)
  return () => {
    list.removeEventListener("change", onChange)
  }
}

/** True below Tailwind's `md` (768px): the sidebar becomes a sheet. Width-based, never a device check. */
export function useIsMobile() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches)
}
