/**
 * Millimetres travel as decimal strings with two digits ("12.50", TradeNet `[Millimeters]`). They are geometry, not
 * money: the editor drags and snaps them as numbers, and they go back as strings rounded to 0.01 mm.
 */
export function mm(value: string): number {
  // eslint-disable-next-line no-restricted-syntax -- millimetres of a label layout are geometry, not money.
  return Number.parseFloat(value)
}

export function mmText(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2)
}
