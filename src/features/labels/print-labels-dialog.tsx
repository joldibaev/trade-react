import { PrinterIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import type { Product } from "@/features/products/products-query"
import { useT } from "@/i18n/i18n"

import { LabelPreview } from "./label-preview"
import {
  CopiesInput,
  JobProblem,
  PriceTypeSelect,
  TemplateSelect,
  useLabelJob,
  useLabelSettings,
} from "./print-job"

/**
 * Labels of one product from its card: the barcode (the primary one first), the price type, the copies, and a
 * preview that is the printed drawing. Printing reads the product again, so the price is today's.
 */
export function PrintLabelsDialog({
  product,
  open,
  onOpenChange,
}: {
  product: Product
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const labels = useLabelSettings()
  const job = useLabelJob()
  const [barcode, setBarcode] = useState(product.barcodes[0]?.value ?? null)
  const [copies, setCopies] = useState(1)
  const data = labels.dataFor(product, barcode)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t.common.close} className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t.labels.title}</DialogTitle>
          <DialogDescription>{product.name}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-end gap-3">
          <Field className="w-full sm:w-56">
            <FieldLabel htmlFor="label-barcode">{t.labels.barcode}</FieldLabel>
            <Select
              value={barcode ?? ""}
              items={product.barcodes.map((b, i) => ({
                value: b.value,
                label: i === 0 ? `${b.value} (${t.products.primary})` : b.value,
              }))}
              onValueChange={(value) => {
                if (value) setBarcode(value)
              }}
            >
              <SelectTrigger id="label-barcode" className="w-full">
                <SelectValue placeholder={t.labels.noBarcodes} />
              </SelectTrigger>
              <SelectContent>
                {product.barcodes.map((b, i) => (
                  <SelectItem key={b.value} value={b.value}>
                    {i === 0 ? `${b.value} (${t.products.primary})` : b.value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <TemplateSelect choice={labels.template} />
          <PriceTypeSelect choice={labels.priceType} />
          <CopiesInput
            id="label-copies"
            label={t.labels.copies}
            value={copies}
            onChange={setCopies}
          />
        </div>
        {labels.template.templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t.labels.noTemplatesHint}
          </p>
        ) : (
          <LabelPreview layout={labels.layout} data={data} />
        )}
        <JobProblem job={job} />
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t.common.close}
          </DialogClose>
          <Button
            disabled={job.printing || labels.settings === null}
            onClick={() => {
              if (labels.settings)
                job.print([{ product, barcode, copies }], labels.settings)
            }}
          >
            {job.printing ? (
              <Spinner data-icon="inline-start" aria-hidden />
            ) : (
              <PrinterIcon data-icon="inline-start" aria-hidden />
            )}
            {t.labels.print}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
