import { BracesIcon } from "lucide-react"
import { useId, useRef, useState } from "react"

import type { FieldCode } from "@/api/errors"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { PriceType } from "@/features/prices/prices-api"
import { useT } from "@/i18n/i18n"
import { textError } from "@/lib/text-rules"

import {
  fillVariables,
  labelVariables,
  unknownVariables,
  type LabelData,
} from "../label-data"
import { mm, mmText } from "../mm"
import type { LabelElement, LabelTextStyle } from "../templates-api"
import {
  boxOf,
  fitInside,
  labelTextRule,
  limits,
  withBox,
  type DraftItem,
} from "./draft"
import { CheckField, NumberField, Section } from "@/features/printing/fields"
import { ImagePicker } from "@/features/printing/image-picker"

type Props = {
  item: DraftItem
  labelWidth: number
  labelHeight: number
  priceTypes: readonly PriceType[]
  sample: LabelData
  /** What the server refused about this element, if anything. */
  serverError: FieldCode | null
  /** What the editor's own check finds wrong (a text's error is shown at its field instead). */
  error: FieldCode | null
  onChange: (element: LabelElement, step: string) => void
}

/** The properties of one element: its box, then what its kind has. Every change goes to the draft at once. */
export function PropertiesPanel(props: Props) {
  const t = useT()
  const { item, labelWidth, labelHeight, onChange } = props
  const { element, key } = item
  const box = boxOf(element)
  const setBox = (field: "x" | "y" | "w" | "h", value: number) => {
    onChange(
      withBox(
        element,
        fitInside({ ...box, [field]: value }, labelWidth, labelHeight)
      ),
      `box:${key}:${field}`
    )
  }
  return (
    <div className="flex flex-col gap-5">
      {props.serverError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {`${t.labelEditor.serverRefused} ${t.fields[props.serverError]}`}
          </AlertDescription>
        </Alert>
      ) : (
        props.error &&
        element.type !== "TEXT" && (
          <Alert variant="destructive">
            <AlertDescription>{t.fields[props.error]}</AlertDescription>
          </Alert>
        )
      )}
      <Section title={t.labelEditor.box}>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label={t.labelEditor.x}
            value={box.x}
            min={0}
            max={labelWidth - box.w}
            onChange={(v) => {
              setBox("x", v)
            }}
          />
          <NumberField
            label={t.labelEditor.y}
            value={box.y}
            min={0}
            max={labelHeight - box.h}
            onChange={(v) => {
              setBox("y", v)
            }}
          />
          <NumberField
            label={t.labelEditor.width}
            value={box.w}
            min={0.1}
            max={labelWidth - box.x}
            onChange={(v) => {
              setBox("w", v)
            }}
          />
          <NumberField
            label={t.labelEditor.height}
            value={box.h}
            min={0.1}
            max={labelHeight - box.y}
            onChange={(v) => {
              setBox("h", v)
            }}
          />
        </div>
      </Section>
      <KindProperties {...props} />
    </div>
  )
}

function KindProperties({ item, priceTypes, sample, onChange }: Props) {
  const t = useT()
  const { element, key } = item
  switch (element.type) {
    case "TEXT":
      return (
        <>
          <TextContent
            text={element.text}
            sample={sample}
            onChange={(text) => {
              onChange({ ...element, text }, `text:${key}`)
            }}
          />
          <StyleProperties
            style={element.style}
            onChange={(style, field) => {
              onChange({ ...element, style }, `style:${key}:${field}`)
            }}
          />
        </>
      )
    case "PRICE":
      return (
        <>
          <Section title={t.labelEditor.price}>
            <Field>
              <FieldLabel htmlFor={`${key}-type`}>
                {t.labels.priceType}
              </FieldLabel>
              <Select
                value={element.priceTypeId ?? "chosen"}
                items={[
                  { value: "chosen", label: t.labelEditor.chosenPriceType },
                  ...priceTypes.map((type) => ({
                    value: type.id,
                    label: type.name,
                  })),
                ]}
                onValueChange={(value) => {
                  onChange(
                    {
                      ...element,
                      priceTypeId: !value || value === "chosen" ? null : value,
                    },
                    `price:${key}:type`
                  )
                }}
              >
                <SelectTrigger id={`${key}-type`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="chosen">
                    {t.labelEditor.chosenPriceType}
                  </SelectItem>
                  {priceTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <CheckField
              label={t.labelEditor.split}
              checked={element.split}
              onChange={(split) => {
                onChange({ ...element, split }, `price:${key}:split`)
              }}
            />
            <CheckField
              label={t.labelEditor.currency}
              checked={element.currency}
              onChange={(currency) => {
                onChange({ ...element, currency }, `price:${key}:currency`)
              }}
            />
          </Section>
          <StyleProperties
            style={element.style}
            onChange={(style, field) => {
              onChange({ ...element, style }, `style:${key}:${field}`)
            }}
          />
        </>
      )
    case "BARCODE":
      return (
        <Section title={t.labelEditor.kinds.BARCODE}>
          <CheckField
            label={t.labelEditor.digits}
            checked={element.digits}
            onChange={(digits) => {
              onChange({ ...element, digits }, `barcode:${key}`)
            }}
          />
        </Section>
      )
    case "SHAPE":
      return (
        <Section title={t.labelEditor.shape}>
          <NumberField
            label={t.labelEditor.border}
            value={mm(element.borderMm)}
            min={0}
            max={limits.maxBorderMm}
            onChange={(border) => {
              // A shape with neither border nor fill draws nothing; the server refuses it.
              onChange(
                {
                  ...element,
                  borderMm: mmText(border),
                  filled: border === 0 ? true : element.filled,
                },
                `shape:${key}:border`
              )
            }}
          />
          <CheckField
            label={t.labelEditor.filled}
            checked={element.filled}
            onChange={(filled) => {
              onChange(
                { ...element, filled: filled || mm(element.borderMm) === 0 },
                `shape:${key}:filled`
              )
            }}
          />
        </Section>
      )
    case "IMAGE":
      return (
        <ReplaceImage
          onImage={(src) => {
            onChange({ ...element, src }, `image:${key}`)
          }}
        />
      )
  }
}

/** The text with its variables: a menu inserts `{name}` at the cursor; the sample shows what will print. */
function TextContent({
  text,
  sample,
  onChange,
}: {
  text: string
  sample: LabelData
  onChange: (text: string) => void
}) {
  const t = useT()
  const id = useId()
  const area = useRef<HTMLTextAreaElement>(null)
  const unknown = unknownVariables(text)
  const refused = textError(text, labelTextRule)
  const error = refused
    ? refused === "OUT_OF_RANGE"
      ? `${t.labelEditor.tooLong} ${String(labelTextRule.maxLength)}`
      : t.fields[refused]
    : unknown.length > 0
      ? `${t.labelEditor.unknownVariables} ${unknown.map((name) => `{${name}}`).join(", ")}`
      : null
  const filled = fillVariables(text, sample.values)
  return (
    <Section title={t.labelEditor.kinds.TEXT}>
      <Field data-invalid={error !== null}>
        <div className="flex items-end justify-between gap-2">
          <FieldLabel htmlFor={id}>{t.labelEditor.text}</FieldLabel>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="sm" />}
            >
              <BracesIcon data-icon="inline-start" aria-hidden />
              {t.labelEditor.insertVariable}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {labelVariables.map((name) => (
                <DropdownMenuItem
                  key={name}
                  onClick={() => {
                    const node = area.current
                    const start = node?.selectionStart ?? text.length
                    const end = node?.selectionEnd ?? text.length
                    onChange(
                      `${text.slice(0, start)}{${name}}${text.slice(end)}`
                    )
                  }}
                >
                  {`${t.labelEditor.variables[name]} — {${name}}`}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Textarea
          ref={area}
          id={id}
          rows={3}
          value={text}
          aria-invalid={error !== null}
          aria-describedby={`${id}-hint`}
          onChange={(event) => {
            onChange(event.target.value)
          }}
        />
        {error ? (
          <FieldError id={`${id}-hint`} errors={[{ message: error }]} />
        ) : (
          filled !== text && (
            <FieldDescription id={`${id}-hint`}>
              {`${t.labelEditor.willPrint} ${filled}`}
            </FieldDescription>
          )
        )}
      </Field>
    </Section>
  )
}

function StyleProperties({
  style,
  onChange,
}: {
  style: LabelTextStyle
  onChange: (style: LabelTextStyle, field: string) => void
}) {
  const t = useT()
  const id = useId()
  const set = <K extends keyof LabelTextStyle>(
    field: K,
    value: LabelTextStyle[K]
  ) => {
    onChange({ ...style, [field]: value }, field)
  }
  const flags = [
    "bold",
    "italic",
    "underline",
    "strike",
    "fit",
    "inverted",
  ] as const
  return (
    <Section title={t.labelEditor.style}>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor={`${id}-font`}>{t.labelEditor.font}</FieldLabel>
          <Select
            value={style.font}
            items={(["SANS", "SERIF", "MONO"] as const).map((font) => ({
              value: font,
              label: t.labelEditor.fonts[font],
            }))}
            onValueChange={(font) => {
              if (font) set("font", font)
            }}
          >
            <SelectTrigger id={`${id}-font`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["SANS", "SERIF", "MONO"] as const).map((font) => (
                <SelectItem key={font} value={font}>
                  {t.labelEditor.fonts[font]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <NumberField
          label={t.labelEditor.fontSize}
          value={style.fontSizePt}
          min={limits.minFontPt}
          max={limits.maxFontPt}
          scale={0}
          onChange={(size) => {
            set("fontSizePt", size)
          }}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {flags.map((flag) => (
          <CheckField
            key={flag}
            label={t.labelEditor.flags[flag]}
            checked={style[flag]}
            onChange={(value) => {
              set(flag, value)
            }}
          />
        ))}
      </div>
      <ToggleGroup
        variant="outline"
        aria-label={t.labelEditor.align}
        value={[style.align]}
        onValueChange={(values: string[]) => {
          const next = (["START", "CENTER", "END"] as const).find(
            (a) => a === values[0]
          )
          if (next) set("align", next)
        }}
      >
        {(["START", "CENTER", "END"] as const).map((align) => (
          <ToggleGroupItem key={align} value={align}>
            {t.labelEditor.aligns[align]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <ToggleGroup
        variant="outline"
        aria-label={t.labelEditor.verticalAlign}
        value={[style.verticalAlign]}
        onValueChange={(values: string[]) => {
          const next = (["TOP", "MIDDLE", "BOTTOM"] as const).find(
            (a) => a === values[0]
          )
          if (next) set("verticalAlign", next)
        }}
      >
        {(["TOP", "MIDDLE", "BOTTOM"] as const).map((align) => (
          <ToggleGroupItem key={align} value={align}>
            {t.labelEditor.verticalAligns[align]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </Section>
  )
}

function ReplaceImage({ onImage }: { onImage: (src: string) => void }) {
  const t = useT()
  const [error, setError] = useState<string | null>(null)
  return (
    <Section title={t.labelEditor.kinds.IMAGE}>
      <ImagePicker
        label={t.labelEditor.replaceImage}
        onImage={(src) => {
          setError(null)
          onImage(src)
        }}
        onError={setError}
      />
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <p className="text-sm text-muted-foreground">{t.labelEditor.imageHint}</p>
    </Section>
  )
}
