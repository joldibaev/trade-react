import { ReactQueryDevtools } from "@tanstack/react-query-devtools"

/**
 * The TanStack Query inspector (cached requests and their state), loaded only by `npm run dev` (__root.tsx).
 * The router's devtools are left out: their corner button covered the sidebar's sign-out.
 */
export default function Devtools() {
  return <ReactQueryDevtools buttonPosition="bottom-right" />
}
