import { createFileRoute } from "@tanstack/react-router"

import { StorePage } from "@/features/stores/store-page"

export const Route = createFileRoute("/_app/stores/$storeId")({
  component: function Store() {
    const { storeId } = Route.useParams()
    return <StorePage storeId={storeId} />
  },
})
