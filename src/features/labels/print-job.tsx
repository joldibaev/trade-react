import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CircleAlertIcon } from "lucide-react"
import { useMemo, useState } from "react"

import { ProblemAlert } from "@/components/problem-alert"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { categoriesQuery } from "@/features/catalog/categories-api"
import { priceTypesQuery } from "@/features/prices/prices-api"
import type { Product } from "@/features/products/products-query"
import { useT } from "@/i18n/i18n"
import { trimDecimal } from "@/lib/decimal"

import type { LabelData } from "./label-data"
import {
  labelDataFor,
  maxLabelsPerJob,
  prepareLabels,
  type JobRefusal,
  type JobSettings,
  type LabelLine,
} from "./prepare"
import { printLabels } from "./print-frame"
import { templateQuery, templatesQuery } from "./templates-api"

function remembered(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** A choice this computer remembers (price type, template): a per-browser convenience, never shared data. */
function useRememberedChoice<T extends { id: string }>(
  key: string,
  options: readonly T[],
  fallback: (options: readonly T[]) => T | undefined
) {
  const [chosen, setChosen] = useState<string | null>(() => remembered(key))
  const value =
    options.find((option) => option.id === chosen)?.id ??
    fallback(options)?.id ??
    null
  return {
    value,
    choose: (id: string) => {
      setChosen(id)
      try {
        localStorage.setItem(key, id)
      } catch {
        // Private windows may refuse storage; the choice still holds on this page.
      }
    },
  }
}

/**
 * The price type labels show: the last one chosen on this computer while it is active, else the default type (the one
 * a receipt starts with). Only active types are offered.
 */
export function usePriceTypeChoice() {
  const types = useQuery(priceTypesQuery)
  const active = (types.data ?? []).filter((type) => type.isActive)
  const choice = useRememberedChoice(
    "cosmos.labels.priceType",
    active,
    (options) => options.find((type) => type.isDefault) ?? options[0]
  )
  return { types: active, query: types, ...choice }
}

/** The template labels print with: the last one used on this computer while it is active, else the first active. */
export function useTemplateChoice() {
  const list = useQuery(templatesQuery)
  const active = (list.data ?? []).filter((template) => template.isActive)
  const choice = useRememberedChoice(
    "cosmos.labels.template",
    active,
    (options) => options[0]
  )
  const template = useQuery({
    ...templateQuery(choice.value ?? ""),
    enabled: choice.value !== null,
  })
  return { templates: active, list, template, ...choice }
}

export function TemplateSelect({
  choice,
}: {
  choice: ReturnType<typeof useTemplateChoice>
}) {
  const t = useT()
  const sizeOf = (item: (typeof choice.templates)[number]) =>
    `${item.name} (${trimDecimal(item.widthMm)}×${trimDecimal(item.heightMm)})`
  return (
    <Field className="w-full sm:w-64">
      <FieldLabel htmlFor="label-template">{t.labels.template}</FieldLabel>
      <Select
        value={choice.value ?? ""}
        items={choice.templates.map((item) => ({
          value: item.id,
          label: sizeOf(item),
        }))}
        onValueChange={(value) => {
          if (value) choice.choose(value)
        }}
      >
        <SelectTrigger id="label-template" className="w-full">
          <SelectValue placeholder={t.labels.noTemplates} />
        </SelectTrigger>
        <SelectContent>
          {choice.templates.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {sizeOf(item)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

/**
 * Everything a print screen needs besides its lines: the chosen template (its card) and price type, and how to make
 * a product's label data for the preview (printing reads it all again).
 */
export function useLabelSettings() {
  const t = useT()
  const template = useTemplateChoice()
  const priceType = usePriceTypeChoice()
  const categories = useQuery(categoriesQuery).data
  const byId = useMemo(
    () => new Map((categories ?? []).map((c) => [c.id, c])),
    [categories]
  )
  const settings: JobSettings | null =
    template.value && priceType.value
      ? {
          templateId: template.value,
          priceTypeId: priceType.value,
          currency: t.labels.currency,
        }
      : null
  return {
    template,
    priceType,
    settings,
    layout: template.template.data?.layout ?? null,
    priceTypeName:
      priceType.types.find((type) => type.id === priceType.value)?.name ?? "",
    dataFor: (product: Product, barcode: string | null): LabelData | null =>
      settings
        ? labelDataFor(product, settings, barcode, priceType.types, byId)
        : null,
  }
}

export function PriceTypeSelect({
  choice,
}: {
  choice: ReturnType<typeof usePriceTypeChoice>
}) {
  const t = useT()
  return (
    <Field className="w-full sm:w-56">
      <FieldLabel htmlFor="label-price-type">{t.labels.priceType}</FieldLabel>
      <Select
        value={choice.value ?? ""}
        items={choice.types.map((type) => ({
          value: type.id,
          label: type.name,
        }))}
        onValueChange={(value) => {
          if (value) choice.choose(value)
        }}
      >
        <SelectTrigger id="label-price-type" className="w-full">
          <SelectValue placeholder={t.labels.noPriceTypes} />
        </SelectTrigger>
        <SelectContent>
          {choice.types.map((type) => (
            <SelectItem key={type.id} value={type.id}>
              {type.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

/**
 * How many labels of a line: 1 to 1000. The text is the person's while typing (an emptied field keeps the last good
 * number); a change from outside (one more scan of the same product) shows at once.
 */
export function CopiesInput({
  id,
  label,
  value,
  onChange,
  hideLabel,
}: {
  id: string
  label: string
  value: number
  onChange: (copies: number) => void
  hideLabel?: boolean
}) {
  const [text, setText] = useState(String(value))
  const [shownValue, setShownValue] = useState(value)
  if (value !== shownValue) {
    setShownValue(value)
    setText(String(value))
  }
  return (
    <Field className="w-24">
      <FieldLabel htmlFor={id} className={hideLabel ? "sr-only" : ""}>
        {label}
      </FieldLabel>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={1}
        max={maxLabelsPerJob}
        step={1}
        value={text}
        className="text-right tabular-nums"
        onChange={(event) => {
          setText(event.target.value)
          const copies = event.target.valueAsNumber
          if (Number.isInteger(copies) && copies >= 1) {
            const kept = Math.min(copies, maxLabelsPerJob)
            setShownValue(kept)
            onChange(kept)
          }
        }}
      />
    </Field>
  )
}

/** Reads the products again, checks every line, then opens the print dialog with one label per page. */
export function useLabelJob() {
  const queryClient = useQueryClient()
  const [refusal, setRefusal] = useState<JobRefusal | null>(null)
  const mutation = useMutation({
    mutationFn: async ({
      lines,
      settings,
    }: {
      lines: readonly LabelLine[]
      settings: JobSettings
    }) => {
      setRefusal(null)
      const job = await prepareLabels(queryClient, lines, settings)
      if ("refusal" in job) {
        setRefusal(job.refusal)
        return
      }
      await printLabels(job.layout, job.labels)
    },
  })
  return {
    print: (lines: readonly LabelLine[], settings: JobSettings) => {
      mutation.mutate({ lines, settings })
    },
    printing: mutation.isPending,
    /** The print dialog was opened for the last job (whether paper came out, the browser cannot tell). */
    sent: mutation.isSuccess && refusal === null,
    refusal,
    error: mutation.error,
  }
}

/** Why the job did not print, naming the line to correct. */
export function JobProblem({ job }: { job: ReturnType<typeof useLabelJob> }) {
  const t = useT()
  if (job.error)
    return <ProblemAlert title={t.labels.printFailed} error={job.error} />
  const refusal = job.refusal
  if (!refusal) return null
  let text: string
  switch (refusal.reason) {
    case "empty":
      text = t.labels.refusals.empty
      break
    case "templateGone":
      text = t.labels.refusals.templateGone
      break
    case "tooMany":
      text = `${t.labels.refusals.tooMany} ${String(maxLabelsPerJob)}: ${String(refusal.total)}`
      break
    default:
      text = `${t.labels.line} ${String(refusal.line)}, «${refusal.name}»: ${t.labels.refusals[refusal.reason]}${refusal.priceType ? ` «${refusal.priceType}»` : ""}`
  }
  return (
    <Alert variant="destructive">
      <CircleAlertIcon aria-hidden />
      <AlertTitle>{t.labels.printFailed}</AlertTitle>
      <AlertDescription>{text}</AlertDescription>
    </Alert>
  )
}
