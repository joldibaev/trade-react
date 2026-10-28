import { ImageUpIcon } from "lucide-react"
import { useRef } from "react"

import { Button } from "@/components/ui/button"
import { useT } from "@/i18n/i18n"

import { readImage } from "./image"

/** Picks a PNG or JPEG for a template (a logo); one the server or the browser would refuse is refused with the reason. */
export function ImagePicker({
  label,
  onImage,
  onError,
  disabled,
}: {
  label: string
  onImage: (src: string) => void
  onError: (message: string) => void
  disabled?: boolean
}) {
  const t = useT()
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => {
          input.current?.click()
        }}
      >
        <ImageUpIcon data-icon="inline-start" aria-hidden />
        {label}
      </Button>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          if (!file) return
          void readImage(file).then((result) => {
            if (result.ok) onImage(result.src)
            else onError(t.printing.imageErrors[result.reason])
          })
        }}
      />
    </>
  )
}
