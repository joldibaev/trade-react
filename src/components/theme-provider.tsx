import { createContext, use, useEffect, useState, type ReactNode } from "react"

export const themes = ["system", "light", "dark"] as const
export type Theme = (typeof themes)[number]

// Same key as the inline script in index.html, which sets the class before the first paint (no white flash at night).
const storageKey = "cosmos.theme"
const darkQuery = "(prefers-color-scheme: dark)"

function storedTheme(): Theme {
  try {
    const value = localStorage.getItem(storageKey)
    return themes.includes(value as Theme) ? (value as Theme) : "system"
  } catch {
    return "system"
  }
}

function applyTheme(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia(darkQuery).matches)
  document.documentElement.classList.toggle("dark", dark)
}

const ThemeContext = createContext<{
  theme: Theme
  setTheme: (theme: Theme) => void
} | null>(null)

/** Light, dark, or as the system says. The choice belongs to the browser, so the sign-in page has it too. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState(storedTheme)

  useEffect(() => {
    applyTheme(theme)
    if (theme !== "system") return
    const query = window.matchMedia(darkQuery)
    const follow = () => {
      applyTheme("system")
    }
    query.addEventListener("change", follow)
    return () => {
      query.removeEventListener("change", follow)
    }
  }, [theme])

  function setTheme(next: Theme) {
    try {
      localStorage.setItem(storageKey, next)
    } catch {
      // Blocked storage: the choice lasts until the tab closes.
    }
    setThemeState(next)
  }

  return <ThemeContext value={{ theme, setTheme }}>{children}</ThemeContext>
}

export function useTheme() {
  const value = use(ThemeContext)
  if (!value) throw new Error("useTheme needs <ThemeProvider> above it.")
  return value
}
