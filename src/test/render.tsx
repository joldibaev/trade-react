import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render } from "@testing-library/react"
import type { ReactNode } from "react"

import { I18nProvider } from "@/i18n/i18n"
import { ru } from "@/i18n/messages/ru"

/** Renders with the providers every screen has: Russian texts and a query client that does not retry. */
export function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <I18nProvider initial={{ language: "ru", messages: ru }}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </I18nProvider>
  )
}
