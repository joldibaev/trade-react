import { useState, type ReactNode } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  CheckField,
  ChoiceField,
  NumberField,
  Section,
} from "@/features/printing/fields"
import { ImagePicker } from "@/features/printing/image-picker"
import { useT } from "@/i18n/i18n"

import {
  fillVariables,
  qrValue,
  textValues,
  type ReceiptData,
} from "../receipt/data"
import {
  limits,
  type BlockOf,
  type ReceiptBlock,
  type ReceiptLayout,
} from "../receipt/layout"
import type { BlockErrors } from "./draft"
import { errorText, TextInput, VariableField } from "./controls"

type Props = {
  block: ReceiptBlock
  /** What the editor or TradeNet found wrong about this block, by field. */
  errors: BlockErrors
  sample: ReceiptData
  onChange: (block: ReceiptBlock) => void
}

const range = (r: { min: number; max: number }) =>
  `${String(r.min)}–${String(r.max)}`

/** The properties of one block: what its type has. Every change goes to the draft at once. */
export function BlockProperties({ block, errors, sample, onChange }: Props) {
  const t = useT()
  const title = t.receiptEditor.kinds[block.type]
  return (
    <div className="flex flex-col gap-5">
      {errors.block && (
        <Alert variant="destructive">
          <AlertDescription>
            {`${t.receiptEditor.serverRefused} ${t.fields[errors.block]}`}
          </AlertDescription>
        </Alert>
      )}
      <Section title={title}>
        {fieldsOf({ block, errors, sample, onChange })}
      </Section>
    </div>
  )
}

function fieldsOf({ block, errors, sample, onChange }: Props): ReactNode {
  switch (block.type) {
    case "TEXT":
      return (
        <TextProperties
          block={block}
          error={errors.text}
          sample={sample}
          onChange={onChange}
        />
      )
    case "IMAGE":
      return (
        <ImageProperties block={block} errors={errors} onChange={onChange} />
      )
    case "STORE":
      return <StoreProperties block={block} onChange={onChange} />
    case "DOCUMENT":
      return (
        <DocumentProperties
          block={block}
          error={errors.title}
          onChange={onChange}
        />
      )
    case "ITEMS":
      return <ItemsProperties block={block} onChange={onChange} />
    case "TOTALS":
      return <TotalsProperties block={block} onChange={onChange} />
    case "PAYMENTS":
      return <PaymentsProperties block={block} onChange={onChange} />
    case "BARCODE":
      return <BarcodeProperties block={block} onChange={onChange} />
    case "QR":
      return (
        <QrProperties
          block={block}
          errors={errors}
          sample={sample}
          onChange={onChange}
        />
      )
    case "DIVIDER":
      return <DividerProperties block={block} onChange={onChange} />
  }
}

function useSizes() {
  const t = useT()
  return t.receiptEditor.sizes
}

function TextProperties({
  block,
  error,
  sample,
  onChange,
}: {
  block: BlockOf<"TEXT">
  error: Props["errors"][string]
  sample: ReceiptData
  onChange: (block: ReceiptBlock) => void
}) {
  const t = useT()
  const sizes = useSizes()
  return (
    <>
      <VariableField
        label={t.receiptEditor.text}
        value={block.text}
        multiline
        error={error}
        preview={(text) =>
          fillVariables(text, textValues(sample, t.receipt.number))
        }
        onChange={(text) => {
          onChange({ ...block, text })
        }}
      />
      <ChoiceField
        label={t.receiptEditor.align}
        value={block.align}
        options={t.receiptEditor.aligns}
        onChange={(align) => {
          onChange({ ...block, align })
        }}
      />
      <ChoiceField
        label={t.receiptEditor.size}
        value={block.size}
        options={sizes}
        onChange={(size) => {
          onChange({ ...block, size })
        }}
      />
      <CheckField
        label={t.receiptEditor.bold}
        checked={block.bold}
        onChange={(bold) => {
          onChange({ ...block, bold })
        }}
      />
    </>
  )
}

function ImageProperties({
  block,
  errors,
  onChange,
}: {
  block: BlockOf<"IMAGE">
  errors: BlockErrors
  onChange: (block: ReceiptBlock) => void
}) {
  const t = useT()
  const [pickError, setPickError] = useState<string | null>(null)
  const srcError =
    pickError ?? (errors.src ? errorText(t, errors.src, {}) : null)
  return (
    <>
      {block.src === "" ? (
        <p className="text-sm text-muted-foreground">
          {t.receiptEditor.noImage}
        </p>
      ) : (
        <img
          src={block.src}
          alt=""
          className="max-h-24 self-start rounded-md border bg-white"
        />
      )}
      <ImagePicker
        label={
          block.src === ""
            ? t.receiptEditor.imagePick
            : t.receiptEditor.replaceImage
        }
        onImage={(src) => {
          setPickError(null)
          onChange({ ...block, src })
        }}
        onError={setPickError}
      />
      {srcError && (
        <Alert variant="destructive">
          <AlertDescription>{srcError}</AlertDescription>
        </Alert>
      )}
      <p className="text-sm text-muted-foreground">
        {t.receiptEditor.imageHint}
      </p>
      <NumberField
        label={t.receiptEditor.imageWidth}
        value={block.widthPercent}
        min={limits.imageWidthPercent.min}
        max={limits.imageWidthPercent.max}
        scale={0}
        error={
          errors.widthPercent
            ? errorText(t, errors.widthPercent, {
                range: range(limits.imageWidthPercent),
              })
            : null
        }
        onChange={(widthPercent) => {
          onChange({ ...block, widthPercent })
        }}
      />
    </>
  )
}

function StoreProperties({
  block,
  onChange,
}: {
  block: BlockOf<"STORE">
  onChange: (block: ReceiptBlock) => void
}) {
  const t = useT()
  const flags = [
    ["name", t.receiptEditor.storeName],
    ["address", t.receiptEditor.storeAddress],
    ["phone", t.receiptEditor.storePhone],
  ] as const
  return (
    <>
      {flags.map(([flag, label]) => (
        <CheckField
          key={flag}
          label={label}
          checked={block[flag]}
          onChange={(value) => {
            onChange({ ...block, [flag]: value })
          }}
        />
      ))}
      <ChoiceField
        label={t.receiptEditor.align}
        value={block.align}
        options={t.receiptEditor.aligns}
        onChange={(align) => {
          onChange({ ...block, align })
        }}
      />
      <ChoiceField
        label={t.receiptEditor.size}
        value={block.size}
        options={t.receiptEditor.sizes}
        onChange={(size) => {
          onChange({ ...block, size })
        }}
      />
    </>
  )
}

function DocumentProperties({
  block,
  error,
  onChange,
}: {
  block: BlockOf<"DOCUMENT">
  error: Props["errors"][string]
  onChange: (block: ReceiptBlock) => void
}) {
  const t = useT()
  return (
    <>
      <TitleField
        value={block.title}
        error={error}
        onChange={(title) => {
          onChange({ ...block, title })
        }}
      />
      <CheckField
        label={t.receiptEditor.dateTime}
        checked={block.dateTime}
        onChange={(dateTime) => {
          onChange({ ...block, dateTime })
        }}
      />
      <CheckField
        label={t.receiptEditor.cashbox}
        checked={block.cashbox}
        onChange={(cashbox) => {
          onChange({ ...block, cashbox })
        }}
      />
      <ChoiceField
        label={t.receiptEditor.size}
        value={block.size}
        options={t.receiptEditor.sizes}
        onChange={(size) => {
          onChange({ ...block, size })
        }}
      />
    </>
  )
}

function ItemsProperties({
  block,
  onChange,
}: {
  block: BlockOf<"ITEMS">
  onChange: (block: ReceiptBlock) => void
}) {
  const t = useT()
  const flags = [
    ["nameBold", t.receiptEditor.nameBold],
    ["lineNumbers", t.receiptEditor.lineNumbers],
    ["discounts", t.receiptEditor.discounts],
  ] as const
  return (
    <>
      <ChoiceField
        label={t.receiptEditor.itemsLayout}
        value={block.layout}
        options={t.receiptEditor.layouts}
        onChange={(layout) => {
          onChange({ ...block, layout })
        }}
      />
      {flags.map(([flag, label]) => (
        <CheckField
          key={flag}
          label={label}
          checked={block[flag]}
          onChange={(value) => {
            onChange({ ...block, [flag]: value })
          }}
        />
      ))}
      <ChoiceField
        label={t.receiptEditor.size}
        value={block.size}
        options={t.receiptEditor.sizes}
        onChange={(size) => {
          onChange({ ...block, size })
        }}
      />
    </>
  )
}

function TotalsProperties({
  block,
  onChange,
}: {
  block: BlockOf<"TOTALS">
  onChange: (block: ReceiptBlock) => void
}) {
  const t = useT()
  return (
    <>
      <CheckField
        label={t.receiptEditor.subtotal}
        checked={block.subtotal}
        onChange={(subtotal) => {
          onChange({ ...block, subtotal })
        }}
      />
      <CheckField
        label={t.receiptEditor.discount}
        checked={block.discount}
        onChange={(discount) => {
          onChange({ ...block, discount })
        }}
      />
      <ChoiceField
        label={t.receiptEditor.size}
        value={block.size}
        options={t.receiptEditor.sizes}
        onChange={(size) => {
          onChange({ ...block, size })
        }}
      />
      <ChoiceField
        label={t.receiptEditor.totalSize}
        value={block.totalSize}
        options={t.receiptEditor.sizes}
        onChange={(totalSize) => {
          onChange({ ...block, totalSize })
        }}
      />
    </>
  )
}

function PaymentsProperties({
  block,
  onChange,
}: {
  block: BlockOf<"PAYMENTS">
  onChange: (block: ReceiptBlock) => void
}) {
  const t = useT()
  return (
    <>
      <CheckField
        label={t.receiptEditor.change}
        checked={block.change}
        onChange={(change) => {
          onChange({ ...block, change })
        }}
      />
      <ChoiceField
        label={t.receiptEditor.size}
        value={block.size}
        options={t.receiptEditor.sizes}
        onChange={(size) => {
          onChange({ ...block, size })
        }}
      />
    </>
  )
}

function BarcodeProperties({
  block,
  onChange,
}: {
  block: BlockOf<"BARCODE">
  onChange: (block: ReceiptBlock) => void
}) {
  const t = useT()
  return (
    <>
      <CheckField
        label={t.receiptEditor.barcodeDigits}
        checked={block.digits}
        onChange={(digits) => {
          onChange({ ...block, digits })
        }}
      />
      <p className="text-sm text-muted-foreground">
        {t.receiptEditor.barcodeHint}
      </p>
    </>
  )
}

function QrProperties({
  block,
  errors,
  sample,
  onChange,
}: {
  block: BlockOf<"QR">
  errors: BlockErrors
  sample: ReceiptData
  onChange: (block: ReceiptBlock) => void
}) {
  const t = useT()
  return (
    <>
      <VariableField
        label={t.receiptEditor.qrValue}
        value={block.value}
        multiline={false}
        hint={t.receiptEditor.qrHint}
        error={errors.value}
        preview={(value) => qrValue(value, sample, t.receipt.number)}
        onChange={(value) => {
          onChange({ ...block, value })
        }}
      />
      <NumberField
        label={t.receiptEditor.qrSize}
        value={block.sizeMm}
        min={limits.qrSizeMm.min}
        max={limits.qrSizeMm.max}
        scale={0}
        error={
          errors.sizeMm
            ? errorText(t, errors.sizeMm, { range: range(limits.qrSizeMm) })
            : null
        }
        onChange={(sizeMm) => {
          onChange({ ...block, sizeMm })
        }}
      />
    </>
  )
}

function DividerProperties({
  block,
  onChange,
}: {
  block: BlockOf<"DIVIDER">
  onChange: (block: ReceiptBlock) => void
}) {
  const t = useT()
  return (
    <ChoiceField
      label={t.receiptEditor.dividerStyle}
      value={block.style}
      options={t.receiptEditor.dividerStyles}
      onChange={(style) => {
        onChange({ ...block, style })
      }}
    />
  )
}

function TitleField({
  value,
  error,
  onChange,
}: {
  value: string
  error: Props["errors"][string]
  onChange: (value: string) => void
}) {
  const t = useT()
  return (
    <TextInput
      label={t.receiptEditor.title}
      hint={t.receiptEditor.titleHint}
      value={value}
      error={error ? errorText(t, error, { length: limits.titleLength }) : null}
      onChange={onChange}
    />
  )
}

/** The roll and the text size: what a receipt as a whole has, shown when no block is selected. */
export function RollProperties({
  layout,
  error,
  onChange,
}: {
  layout: Pick<ReceiptLayout, "paperWidthMm" | "fontSizePt">
  /** The text size's refusal, if any. */
  error: BlockErrors
  onChange: (
    changes: Partial<Pick<ReceiptLayout, "paperWidthMm" | "fontSizePt">>
  ) => void
}) {
  const t = useT()
  return (
    <div className="flex flex-col gap-5">
      <Section title={t.receiptEditor.roll}>
        <ChoiceField
          label={t.receiptEditor.rollWidth}
          value={layout.paperWidthMm === 58 ? "58" : "80"}
          options={{
            "58": `58 ${t.receiptTemplates.mm}`,
            "80": `80 ${t.receiptTemplates.mm}`,
          }}
          onChange={(width) => {
            onChange({ paperWidthMm: width === "58" ? 58 : 80 })
          }}
        />
        <NumberField
          label={t.receiptEditor.fontSize}
          value={layout.fontSizePt}
          min={limits.fontSizePt.min}
          max={limits.fontSizePt.max}
          scale={0}
          error={
            error.fontSizePt
              ? errorText(t, error.fontSizePt, {
                  range: range(limits.fontSizePt),
                })
              : null
          }
          onChange={(fontSizePt) => {
            onChange({ fontSizePt })
          }}
        />
        <p className="text-sm text-muted-foreground">
          {t.receiptEditor.fontHint}
        </p>
        <p className="text-sm text-muted-foreground">
          {t.receiptEditor.fiscalNote}
        </p>
      </Section>
    </div>
  )
}
