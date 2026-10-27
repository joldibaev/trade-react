import { createFileRoute } from "@tanstack/react-router"

import { ProductPage } from "@/features/products/product-page"

export const Route = createFileRoute("/_app/products/$productId")({
  component: function Product() {
    const { productId } = Route.useParams()
    return <ProductPage productId={productId} />
  },
})
