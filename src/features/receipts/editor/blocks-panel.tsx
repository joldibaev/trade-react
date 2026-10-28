import {
  ArrowDownIcon,
  ArrowUpIcon,
  CircleAlertIcon,
  CopyIcon,
  Trash2Icon,
} from "lucide-react"
import { useState } from "react"

import type { FieldCode } from "@/api/errors"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Section } from "@/features/printing/fields"
import { ImagePicker } from "@/features/printing/image-picker"
import { useT } from "@/i18n/i18n"

import { blockTypes, limits, type BlockType } from "../receipt/layout"
import {
  canAct,
  canAdd,
  isRequired,
  type BlockAction,
  type Draft,
} from "./draft"
import { errorText } from "./controls"

const tools = [
  { action: "up", icon: ArrowUpIcon },
  { action: "down", icon: ArrowDownIcon },
  { action: "duplicate", icon: CopyIcon },
  { action: "delete", icon: Trash2Icon },
] as const satisfies readonly { action: BlockAction; icon: unknown }[]

/** The blocks of the receipt, top to bottom as they print: add, pick, move, duplicate, delete. */
export function BlocksPanel({
  draft,
  selected,
  invalid,
  flagged,
  layoutError,
  onSelect,
  onAdd,
  onAction,
}: {
  draft: Draft
  selected: string | null
  /** Blocks with an error of the editor's or the server's. */
  invalid: ReadonlySet<string>
  /** Blocks that will not print as drawn (a QR code too small to scan). */
  flagged: ReadonlySet<string>
  /** What is wrong with the list as a whole (a required block missing, too many blocks). */
  layoutError: FieldCode | undefined
  onSelect: (key: string | null) => void
  onAdd: (type: BlockType, image?: string) => void
  onAction: (action: BlockAction) => void
}) {
  const t = useT()
  const [imageError, setImageError] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-5">
      <Section title={t.receiptEditor.addBlock}>
        <div className="grid grid-cols-2 gap-2">
          {blockTypes
            .filter((type) => type !== "IMAGE")
            .map((type) => (
              <Button
                key={type}
                type="button"
                variant="outline"
                size="sm"
                className="justify-start"
                disabled={!canAdd(draft, type)}
                onClick={() => {
                  onAdd(type)
                }}
              >
                {t.receiptEditor.kinds[type]}
              </Button>
            ))}
          <ImagePicker
            label={t.receiptEditor.kinds.IMAGE}
            disabled={!canAdd(draft, "IMAGE")}
            onImage={(src) => {
              setImageError(null)
              onAdd("IMAGE", src)
            }}
            onError={setImageError}
          />
        </div>
        {imageError && (
          <Alert variant="destructive">
            <AlertDescription>{imageError}</AlertDescription>
          </Alert>
        )}
        {draft.blocks.length >= limits.blocks && (
          <p className="text-sm text-muted-foreground">
            {t.receiptEditor.tooMany}
          </p>
        )}
      </Section>
      <Section title={t.receiptEditor.blocks}>
        {layoutError && (
          <Alert variant="destructive">
            <AlertDescription>
              {errorText(t, layoutError, {
                range: `0–${String(limits.blocks)}`,
              })}
            </AlertDescription>
          </Alert>
        )}
        {draft.blocks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t.receiptEditor.noBlocks}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {draft.blocks.map((item) => {
              const active = item.key === selected
              return (
                <li key={item.key}>
                  <Button
                    type="button"
                    variant={active ? "secondary" : "ghost"}
                    size="sm"
                    aria-pressed={active}
                    className="w-full justify-start gap-2"
                    onClick={() => {
                      onSelect(active ? null : item.key)
                    }}
                  >
                    <span className="truncate">
                      {t.receiptEditor.kinds[item.block.type]}
                    </span>
                    {isRequired(item.block.type) && (
                      <span className="text-xs text-muted-foreground">
                        {t.receiptEditor.required}
                      </span>
                    )}
                    {(invalid.has(item.key) || flagged.has(item.key)) && (
                      <>
                        <CircleAlertIcon
                          aria-hidden
                          className="ml-auto text-destructive"
                        />
                        <span className="sr-only">
                          {t.receiptEditor.hasErrors}
                        </span>
                      </>
                    )}
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
        {selected !== null && (
          <div className="flex gap-1">
            {tools.map(({ action, icon: Icon }) => (
              <Button
                key={action}
                type="button"
                variant="outline"
                size="icon"
                aria-label={t.receiptEditor[labelKey[action]]}
                title={t.receiptEditor[labelKey[action]]}
                disabled={!canAct(draft, selected, action)}
                onClick={() => {
                  onAction(action)
                }}
              >
                <Icon aria-hidden />
              </Button>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}

const labelKey = {
  up: "up",
  down: "down",
  duplicate: "duplicate",
  delete: "remove",
} as const
