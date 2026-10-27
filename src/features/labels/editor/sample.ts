import type { PriceType } from "@/features/prices/prices-api"
import type { Product } from "@/features/products/products-query"
import type { Messages } from "@/i18n/messages/ru"

import { labelDataOf, labelPrice, type LabelData } from "../label-data"

/**
 * The product the editor shows until a real one is picked (trade4's sample): the default type's price is lower than
 * the others, so a sale template shows a real discount.
 */
export function sampleProduct(
  t: Messages,
  priceTypes: readonly PriceType[]
): Pick<Product, "name" | "code" | "prices"> {
  const first =
    priceTypes.find((type) => type.isDefault)?.id ?? priceTypes[0]?.id
  return {
    name: t.labelEditor.sample.name,
    code: 12320,
    prices: priceTypes.map((type) => ({
      priceTypeId: type.id,
      price: type.id === first ? samplePrice : "21790.00",
    })),
  }
}

export const sampleBarcode = "2013175842038"

/** The editor's label data: the sample or a picked product, with the price type chosen for the preview. */
export function sampleData(
  t: Messages,
  options: {
    product: Product | null
    priceTypeId: string | null
    priceTypes: readonly PriceType[]
    category: string
  }
): LabelData {
  const product = options.product ?? sampleProduct(t, options.priceTypes)
  const data = labelDataOf(product, {
    priceTypeId: options.priceTypeId,
    priceTypes: options.priceTypes,
    category: options.product
      ? options.category
      : t.labelEditor.sample.category,
    barcode: options.product
      ? (options.product.barcodes[0]?.value ?? null)
      : sampleBarcode,
    currency: t.labels.currency,
  })
  if (options.product) return data
  // With no price types yet (a new install) the sample still shows a price, so a price element is visible to place.
  return {
    ...data,
    values: {
      ...data.values,
      price: data.values.price || labelPrice(samplePrice),
    },
    price: (id) => data.price(id) ?? samplePrice,
  }
}

const samplePrice = "18790.00"
