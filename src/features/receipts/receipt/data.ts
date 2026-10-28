import { formatDecimal } from "@/lib/decimal"
import { formatPhone } from "@/lib/phone"

/** One sold line. Money, quantities and prices are the API's exact decimal strings; `discount` is "0.00" for none. */
export type ReceiptLine = {
  name: string
  quantity: string
  price: string
  amount: string
  discount: string
}

/** One payment. `received` and `change` exist only for cash, where the till asks for the money handed over. */
export type ReceiptPayment = {
  method: string
  amount: string
  received: string | null
  change: string | null
}

/**
 * Everything a receipt prints, ready to read: the till (or the editor's sample) fills it from a sale. `date` and
 * `time` are already written in the shop's time.
 */
export type ReceiptData = {
  storeName: string
  storeAddress: string
  /** E.164, as TradeNet sends it. */
  storePhone: string | null
  number: string
  date: string
  time: string
  cashbox: string | null
  lines: ReceiptLine[]
  subtotal: string
  discount: string
  total: string
  payments: ReceiptPayment[]
}

/** The words a receipt prints around the sale's data; the language is the caller's. */
export type ReceiptTexts = {
  number: string
  date: string
  cashbox: string
  subtotal: string
  discount: string
  total: string
  received: string
  change: string
  itemName: string
  quantity: string
  amount: string
  notFiscal: string
}

/** The names a text or a QR code may use, `{number}` and so on (TradeNet receipts.md). The cashier is never one. */
export const receiptVariables = [
  "storeName",
  "storeAddress",
  "storePhone",
  "number",
  "date",
  "time",
  "cashbox",
  "total",
] as const

export type ReceiptVariable = (typeof receiptVariables)[number]

const variablePattern = /\{([A-Za-z]+)\}/g

const isVariable = (name: string): name is ReceiptVariable =>
  (receiptVariables as readonly string[]).includes(name)

/** The `{names}` of a text that are not variables: TradeNet refuses them (`INVALID_VALUE`), a typo is caught here. */
export function unknownVariables(text: string): string[] {
  // The server reads the NFC form: a Kelvin sign in "{Kelvin}" is a K.
  return [...text.normalize("NFC").matchAll(variablePattern)]
    .map((match) => match[1] ?? "")
    .filter((name) => !isVariable(name))
}

/** How a sale reads in a text: `{number}` is "№1042", the total is "12 500,00". */
export function textValues(
  data: ReceiptData,
  numberSign: string
): Record<ReceiptVariable, string> {
  return {
    storeName: data.storeName,
    storeAddress: data.storeAddress,
    storePhone: data.storePhone === null ? "" : formatPhone(data.storePhone),
    number: `${numberSign}${data.number}`,
    date: data.date,
    time: data.time,
    cashbox: data.cashbox ?? "",
    total: formatDecimal(data.total),
  }
}

/** How a sale goes into a link: the number and the total are the raw values, not "№1042" or "12 500,00". */
function linkValues(
  data: ReceiptData,
  numberSign: string
): Record<ReceiptVariable, string> {
  return {
    ...textValues(data, numberSign),
    number: data.number,
    total: data.total,
  }
}

/** Fills the variables of a text; a `{name}` that is not one stays as written. */
export function fillVariables(
  text: string,
  values: Record<ReceiptVariable, string>
): string {
  return text
    .normalize("NFC")
    .replace(variablePattern, (whole, name: string) =>
      isVariable(name) ? values[name] : whole
    )
}

/**
 * The value a QR code encodes. In a link the filled values are URL-encoded, so a shop name with `&` or a space cannot
 * break it; any other text keeps them as printed.
 */
export function qrValue(
  template: string,
  data: ReceiptData,
  numberSign: string
): string {
  if (!/^https?:\/\//i.test(template))
    return fillVariables(template, textValues(data, numberSign))
  const values = linkValues(data, numberSign)
  return fillVariables(
    template,
    Object.fromEntries(
      receiptVariables.map((name) => [name, encodeURIComponent(values[name])])
    ) as Record<ReceiptVariable, string>
  )
}
