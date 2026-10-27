import { createContext, use, useState, type ReactNode } from "react"

import { ru, type Messages } from "./messages/ru"

export const languages = ["ru", "uz", "kk"] as const
export type Language = (typeof languages)[number]

// Each language names itself, never translated: a person who cannot read the current one still finds theirs.
// `tag` is the BCP 47 tag for <html lang>: Uzbek is written in Latin script here.
export const languageInfo: Record<Language, { name: string; tag: string }> = {
  ru: { name: "Русский", tag: "ru" },
  uz: { name: "Oʻzbekcha", tag: "uz-Latn" },
  kk: { name: "Қазақша", tag: "kk" },
}

const storageKey = "cosmos.language"

// Russian is bundled as the default; the other catalogs load on first use, so a language costs
// its download only to the people who pick it.
const loaders: Record<Language, () => Promise<Messages>> = {
  ru: () => Promise.resolve(ru),
  uz: () => import("./messages/uz").then((m) => m.uz),
  kk: () => import("./messages/kk").then((m) => m.kk),
}

function isLanguage(value: unknown): value is Language {
  return languages.includes(value as Language)
}

/** The language kept in this browser, or Russian. The choice belongs to the browser, like the theme. */
export function storedLanguage(): Language {
  try {
    const value = localStorage.getItem(storageKey)
    return isLanguage(value) ? value : "ru"
  } catch {
    return "ru"
  }
}

export async function loadLanguage(language: Language) {
  const messages = await loaders[language]()
  document.documentElement.lang = languageInfo[language].tag
  return { language, messages }
}

type I18nState = Awaited<ReturnType<typeof loadLanguage>>
type I18nContextValue = I18nState & {
  setLanguage: (language: Language) => Promise<void>
}

const I18nContext = createContext<I18nContextValue | null>(null)

/** `initial` is loaded before the first render (main.tsx), so no screen ever shows a key or a flash of Russian. */
export function I18nProvider({
  initial,
  children,
}: {
  initial: I18nState
  children: ReactNode
}) {
  const [state, setState] = useState(initial)

  async function setLanguage(language: Language) {
    const next = await loadLanguage(language)
    try {
      localStorage.setItem(storageKey, language)
    } catch {
      // Private mode or blocked storage: the choice lasts until the tab closes.
    }
    setState(next)
  }

  return <I18nContext value={{ ...state, setLanguage }}>{children}</I18nContext>
}

function useI18n() {
  const value = use(I18nContext)
  if (!value)
    throw new Error("useT and useLanguage need <I18nProvider> above them.")
  return value
}

/** The catalog of the current language: `const t = useT()`, then `t.products.title`. */
export function useT(): Messages {
  return useI18n().messages
}

export function useLanguage() {
  const { language, setLanguage } = useI18n()
  return { language, setLanguage }
}
