import {
  ArrowDownIcon,
  ArrowUpIcon,
  BarcodeIcon,
  CopyIcon,
  FrameIcon,
  MinusIcon,
  TagIcon,
  Trash2Icon,
  TypeIcon,
} from "lucide-react"
import { useId, useState } from "react"
import { cn } from "cn"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useT } from "@/i18n/i18n"

import { mm } from "../mm"
import {
  labelSizes,
  limits,
  presetNames,
  type Draft,
  type ElementKind,
  type PresetName,
} from "./draft"
import { NumberField, Section } from "@/features/printing/fields"
import { canAdd, itemTitle, type ItemAction } from "./items"
import { ImagePicker } from "@/features/printing/image-picker"

const kindIcons = {
  TEXT: TypeIcon,
  PRICE: TagIcon,
  BARCODE: BarcodeIcon,
  FRAME: FrameIcon,
  LINE: MinusIcon,
} as const

/** What can go on the label, and what is on it, in drawing order (the last one is on top). */
export function ElementsPanel({
  draft,
  selected,
  onSelect,
  onAdd,
  onAction,
  invalid,
}: {
  draft: Draft
  selected: string | null
  onSelect: (key: string) => void
  onAdd: (kind: ElementKind, image?: string) => void
  onAction: (action: ItemAction) => void
  invalid: ReadonlySet<string>
}) {
  const t = useT()
  const [imageError, setImageError] = useState<string | null>(null)
  const index = draft.items.findIndex((item) => item.key === selected)
  const tools: {
    action: ItemAction
    icon: typeof CopyIcon
    disabled: boolean
  }[] = [
    { action: "duplicate", icon: CopyIcon, disabled: false },
    {
      action: "forward",
      icon: ArrowUpIcon,
      disabled: index === draft.items.length - 1,
    },
    { action: "backward", icon: ArrowDownIcon, disabled: index === 0 },
    { action: "delete", icon: Trash2Icon, disabled: false },
  ]
  return (
    <div className="flex flex-col gap-5">
      <Section title={t.labelEditor.add}>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(kindIcons) as (keyof typeof kindIcons)[]).map(
            (kind) => {
              const Icon = kindIcons[kind]
              return (
                <Button
                  key={kind}
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  disabled={!canAdd(draft, false)}
                  onClick={() => {
                    onAdd(kind)
                  }}
                >
                  <Icon data-icon="inline-start" aria-hidden />
                  {t.labelEditor.kinds[kind]}
                </Button>
              )
            }
          )}
          <ImagePicker
            label={t.labelEditor.kinds.IMAGE}
            disabled={!canAdd(draft, true)}
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
        {draft.items.length >= limits.maxElements && (
          <p className="text-sm text-muted-foreground">
            {t.labelEditor.tooMany}
          </p>
        )}
      </Section>
      <Section title={t.labelEditor.layers}>
        {draft.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t.labelEditor.noElements}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {draft.items.map((item, i) => (
              <li key={item.key}>
                <Button
                  variant={item.key === selected ? "secondary" : "ghost"}
                  size="sm"
                  aria-pressed={item.key === selected}
                  className={cn(
                    "w-full justify-start truncate",
                    invalid.has(item.key) && "text-destructive"
                  )}
                  onClick={() => {
                    onSelect(item.key)
                  }}
                >
                  <span className="truncate">
                    {itemTitle(t, item.element, i)}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        )}
        {selected !== null && (
          <div className="flex flex-wrap gap-1">
            {tools.map(({ action, icon: Icon, disabled }) => (
              <Button
                key={action}
                variant="outline"
                size="icon-sm"
                disabled={disabled}
                aria-label={t.labelEditor.actions[action]}
                title={t.labelEditor.actions[action]}
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

/** With nothing selected: the label's size, and a preset to start from. */
export function LabelPanel({
  draft,
  onResize,
  onPreset,
}: {
  draft: Draft
  onResize: (width: number, height: number) => void
  onPreset: (preset: PresetName) => void
}) {
  const t = useT()
  const id = useId()
  const [preset, setPreset] = useState<PresetName>("standard")
  const width = mm(draft.widthMm)
  const height = mm(draft.heightMm)
  const roll =
    labelSizes.find(([w, h]) => w === width && h === height)?.join("x") ??
    "custom"
  const rollLabel = (value: string) =>
    value === "custom"
      ? t.labelEditor.customSize
      : `${value.replace("x", " × ")} ${t.labelEditor.mm}`
  return (
    <div className="flex flex-col gap-5">
      <Section title={t.labelEditor.label}>
        <Field>
          <FieldLabel htmlFor={`${id}-roll`}>{t.labelEditor.roll}</FieldLabel>
          <Select
            value={roll}
            items={[...labelSizes.map((s) => s.join("x")), "custom"].map(
              (value) => ({ value, label: rollLabel(value) })
            )}
            onValueChange={(value) => {
              const size = labelSizes.find((s) => s.join("x") === value)
              if (size) onResize(size[0], size[1])
            }}
          >
            <SelectTrigger id={`${id}-roll`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[...labelSizes.map((s) => s.join("x")), "custom"].map(
                (value) => (
                  <SelectItem
                    key={value}
                    value={value}
                    disabled={value === "custom"}
                  >
                    {rollLabel(value)}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label={t.labelEditor.width}
            value={width}
            min={limits.minSizeMm}
            max={limits.maxSizeMm}
            onChange={(w) => {
              onResize(w, height)
            }}
          />
          <NumberField
            label={t.labelEditor.height}
            value={height}
            min={limits.minSizeMm}
            max={limits.maxSizeMm}
            onChange={(h) => {
              onResize(width, h)
            }}
          />
        </div>
        <FieldDescription>{t.labelEditor.sizeHint}</FieldDescription>
      </Section>
      <Section title={t.labelEditor.preset}>
        <Field>
          <FieldLabel htmlFor={`${id}-preset`}>
            {t.labelEditor.startFrom}
          </FieldLabel>
          <Select
            value={preset}
            items={presetNames.map((name) => ({
              value: name,
              label: t.labelEditor.presets[name],
            }))}
            onValueChange={(value) => {
              const next = presetNames.find((name) => name === value)
              if (next) setPreset(next)
            }}
          >
            <SelectTrigger id={`${id}-preset`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {presetNames.map((name) => (
                <SelectItem key={name} value={name}>
                  {t.labelEditor.presets[name]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Button
          variant="outline"
          className="self-start"
          onClick={() => {
            onPreset(preset)
          }}
        >
          {t.labelEditor.applyPreset}
        </Button>
        <FieldDescription>{t.labelEditor.presetHint}</FieldDescription>
      </Section>
    </div>
  )
}
