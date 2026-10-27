/**
 * Phones arrive from TradeNet in E.164 (`"+998901234567"`) and are shown in the groups people dictate them in:
 * `"+998 90 123 45 67"`, with no-break spaces so a narrow column never splits a number. A number of another country,
 * or of an unexpected length, stays as sent.
 */

const layouts = [
  // Uzbekistan: operator code, then 3-2-2.
  /^(\+998)(\d{2})(\d{3})(\d{2})(\d{2})$/,
  // Kazakhstan and Russia: 3-digit code, then 3-2-2.
  /^(\+7)(\d{3})(\d{3})(\d{2})(\d{2})$/,
]

export function formatPhone(phone: string): string {
  for (const layout of layouts) {
    const match = layout.exec(phone)
    if (match) return match.slice(1).join(" ")
  }
  return phone
}
