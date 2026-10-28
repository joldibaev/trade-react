import type { ReceiptData } from "./data"

/** The made-up shop and goods of the sample sale; they are the editor's words, so the catalog supplies them. */
export type SampleNames = {
  storeName: string
  storeAddress: string
  cashbox: string
  cash: string
  /** A name long enough to wrap on a 58 mm roll. */
  longProduct: string
  weighedProduct: string
  discountedProduct: string
}

/**
 * A made-up sale that shows every part of a receipt in the editor and on a test print: a long name, a weighed
 * product, a line with a discount, and a cash payment with change.
 */
export function sampleReceipt(names: SampleNames): ReceiptData {
  return {
    storeName: names.storeName,
    storeAddress: names.storeAddress,
    storePhone: "+998712000103",
    number: "1042",
    date: "07.10.2026",
    time: "14:32",
    cashbox: names.cashbox,
    lines: [
      {
        name: names.longProduct,
        quantity: "2.000",
        price: "18790.0000",
        amount: "37580.00",
        discount: "0.00",
      },
      {
        name: names.weighedProduct,
        quantity: "0.450",
        price: "96000.0000",
        amount: "43200.00",
        discount: "0.00",
      },
      {
        name: names.discountedProduct,
        quantity: "1.000",
        price: "12500.0000",
        amount: "11500.00",
        discount: "1000.00",
      },
    ],
    subtotal: "93280.00",
    discount: "1000.00",
    total: "92280.00",
    payments: [
      {
        method: names.cash,
        amount: "92280.00",
        received: "100000.00",
        change: "7720.00",
      },
    ],
  }
}
