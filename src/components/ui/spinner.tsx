import { cn } from "cn"
import { Loader2Icon } from "lucide-react"

// Decorative: the text next to it (or a role="status" around it) says what is loading, in the current language.
function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon
      data-slot="spinner"
      aria-hidden
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )
}

export { Spinner }
