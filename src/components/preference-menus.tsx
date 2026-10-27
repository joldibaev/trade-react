import { LanguagesIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react"

import { useTheme, themes, type Theme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  languageInfo,
  languages,
  useLanguage,
  useT,
  type Language,
} from "@/i18n/i18n"

/** The language of the interface, for this browser. On the sign-in page and in the menu. */
export function LanguageMenu() {
  const t = useT()
  const { language, setLanguage } = useLanguage()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
        <LanguagesIcon data-icon="inline-start" aria-hidden />
        <span className="sr-only">{t.common.language}:</span>
        {languageInfo[language].name}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t.common.language}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={language}
            onValueChange={(value: Language) => {
              void setLanguage(value)
            }}
          >
            {languages.map((code) => (
              <DropdownMenuRadioItem
                key={code}
                value={code}
                lang={languageInfo[code].tag}
              >
                {languageInfo[code].name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const themeIcons = {
  system: MonitorIcon,
  light: SunIcon,
  dark: MoonIcon,
} satisfies Record<Theme, unknown>

/** Light, dark or as the system says, for this browser. */
export function ThemeMenu() {
  const t = useT()
  const { theme, setTheme } = useTheme()
  const Icon = themeIcons[theme]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
        <Icon data-icon="inline-start" aria-hidden />
        <span className="sr-only">{t.common.theme}:</span>
        {t.theme[theme]}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t.common.theme}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={theme}
            onValueChange={(value: Theme) => {
              setTheme(value)
            }}
          >
            {themes.map((code) => (
              <DropdownMenuRadioItem key={code} value={code}>
                {t.theme[code]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
