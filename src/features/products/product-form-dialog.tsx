import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useSelector } from "@tanstack/react-form"
import { PlusIcon, Trash2Icon, WandSparklesIcon } from "lucide-react"
import { useMemo, useState } from "react"

import { problemWith, type FieldCode } from "@/api/errors"
import {
  FormChecksProvider,
  useFormChecks,
} from "@/components/form/form-checks"
import { allOf, decimal, required, useAppForm } from "@/components/form/form"
import { FormDialog, useRefusal } from "@/components/form/form-dialog"
import { ProblemAlert } from "@/components/problem-alert"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { FieldDescription, FieldLegend, FieldSet } from "@/components/ui/field"
import { categoriesQuery } from "@/features/catalog/categories-api"
import {
  buildCategoryTree,
  categoryPath,
  flattenTree,
} from "@/features/catalog/category-tree"
import { useT } from "@/i18n/i18n"
import { decimalForInput, parseDecimalInput } from "@/lib/decimal"

import { createProduct, generateBarcode, updateProduct } from "./products-api"
import { productQuery, type Product } from "./products-query"

/** Select values for "nothing": a select item needs a non-empty value. */
const noCategory = "none"
const piece = "piece"

type Values = {
  name: string
  category: string
  isActive: boolean
  packages: { name: string; size: string }[]
  barcodes: { value: string; package: string }[]
}

const valuesOf = (
  product: Product | undefined,
  categoryId?: string
): Values => ({
  name: product?.name ?? "",
  category: (product ? product.categoryId : categoryId) ?? noCategory,
  isActive: product?.isActive ?? true,
  packages: (product?.packages ?? []).map((p) => ({
    name: p.name,
    size: decimalForInput(p.size),
  })),
  barcodes: (product?.barcodes ?? []).map((b) => ({
    value: b.value,
    package: b.package ?? piece,
  })),
})

/** The lists as the API takes them; also how an edit tells whether they changed. */
function toRequest(value: Values) {
  return {
    name: value.name.trim(),
    categoryId: value.category === noCategory ? null : value.category,
    packages: value.packages.map((p) => ({
      name: p.name.trim(),
      size: parseDecimalInput(p.size, 3) ?? p.size,
    })),
    barcodes: value.barcodes.map((b) => ({
      value: b.value.trim(),
      package: b.package === piece ? null : b.package,
    })),
  }
}

/** The barcodes that name a package the product no longer has, as field codes. */
function unknownPackages(value: Values): Record<string, FieldCode> {
  const names = new Set(value.packages.map((p) => p.name.trim()))
  const fields: Record<string, FieldCode> = {}
  value.barcodes.forEach((barcode, index) => {
    if (barcode.package !== piece && !names.has(barcode.package))
      fields[`barcodes[${String(index)}].package`] = "INVALID_VALUE"
  })
  return fields
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/**
 * A product with its packages and barcodes. The lists are sent whole (they replace what was there), and only when
 * they changed. A barcode may name one of the product's packages; the first barcode is the primary one.
 */
export function ProductFormDialog({
  product,
  defaultCategoryId,
  open,
  onOpenChange,
  onSaved,
}: {
  product?: Product
  defaultCategoryId?: string | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (product: Product) => void
}) {
  const t = useT()
  const queryClient = useQueryClient()
  const refusal = useRefusal()
  const checks = useFormChecks()
  const [base, setBase] = useState(product)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<unknown>(null)
  const categories = useQuery(categoriesQuery).data

  const categoryOptions = useMemo(() => {
    const list = categories ?? []
    const byId = new Map(list.map((c) => [c.id, c]))
    return [
      { value: noCategory, label: t.products.noCategory },
      ...flattenTree(buildCategoryTree(list)).map((node) => ({
        value: node.id,
        label: categoryPath(node.id, byId),
      })),
    ]
  }, [categories, t])

  const form = useAppForm({
    defaultValues: valuesOf(base, defaultCategoryId),
    onSubmit: async ({ value, formApi }) => {
      refusal.clear()
      // A barcode may only name a package the product still has; the server's 400 PACKAGE_NOT_FOUND would not say
      // which barcode.
      if (checks.refuse(unknownPackages(value))) return
      const request = toRequest(value)
      try {
        let saved: Product
        if (base) {
          const before = toRequest(valuesOf(base))
          saved = await updateProduct(queryClient, base, {
            ...(request.name !== before.name && { name: request.name }),
            ...(request.categoryId !== before.categoryId && {
              category: { id: request.categoryId },
            }),
            ...(value.isActive !== base.isActive && {
              isActive: value.isActive,
            }),
            ...(!same(request.packages, before.packages) && {
              packages: request.packages,
            }),
            ...(!same(request.barcodes, before.barcodes) && {
              barcodes: request.barcodes,
            }),
          })
        } else saved = await createProduct(queryClient, request)
        onOpenChange(false)
        onSaved?.(saved)
      } catch (error) {
        // The taken barcode is marked on its line; the alert says whose it is.
        const taken = problemWith(error, "BARCODE_TAKEN")?.barcode
        const line = value.barcodes.findIndex((b) => b.value.trim() === taken)
        if (line >= 0)
          checks.refuse({
            [`barcodes[${String(line)}].value`]: "BARCODE_TAKEN",
          })
        refusal.show(formApi, error)
      }
    },
  })

  const packageNames = useSelector(form.store, (state) =>
    state.values.packages.map((p) => p.name.trim()).filter(Boolean)
  )
  const chosenPackages = useSelector(form.store, (state) =>
    state.values.barcodes.map((b) => b.package)
  )
  const packageOptions = [
    { value: piece, label: t.products.piece },
    ...[...new Set(packageNames)].map((name) => ({ value: name, label: name })),
    // A package removed or renamed while a barcode still names it stays in the list, marked: otherwise the select
    // would quietly fall back to "piece", and a box scan would count as one piece.
    ...[...new Set(chosenPackages)]
      .filter((name) => name !== piece && !packageNames.includes(name))
      .map((name) => ({
        value: name,
        label: `${name} (${t.products.packageGone})`,
      })),
  ]

  return (
    <FormDialog
      wide
      open={open}
      onOpenChange={onOpenChange}
      title={product ? t.products.editTitle : t.products.createTitle}
      refusal={refusal.refusal}
      refusalTitle={t.common.saveFailed}
      refusalDetails={<TakenBy error={refusal.refusal} />}
      onReload={() => {
        if (!base) return
        void queryClient
          .query({ ...productQuery(base.id), staleTime: 0 })
          .then((fresh) => {
            setBase(fresh)
            form.reset(valuesOf(fresh))
            refusal.clear()
          })
      }}
      formRef={refusal.formRef}
      onSubmit={() => form.handleSubmit()}
      submit={
        <form.AppForm>
          <form.SubmitButton
            label={product ? t.common.save : t.common.create}
          />
        </form.AppForm>
      }
    >
      <FormChecksProvider value={checks}>
        <form.AppField
          name="name"
          validators={{ onChange: required, onBlur: required }}
        >
          {(field) => <field.TextField label={t.products.name} required />}
        </form.AppField>
        <form.AppField name="category">
          {(field) => (
            <field.SelectField
              label={t.products.category}
              options={categoryOptions}
            />
          )}
        </form.AppField>
        {product && (
          <form.AppField name="isActive">
            {(field) => (
              <field.SwitchField
                label={t.products.active}
                description={t.products.activeHint}
              />
            )}
          </form.AppField>
        )}

        <form.AppField name="packages" mode="array">
          {(list) => (
            <FieldSet>
              <FieldLegend variant="label">{t.products.packages}</FieldLegend>
              <FieldDescription>{t.products.packagesHint}</FieldDescription>
              {list.state.value.map((_, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[1fr_7rem_auto] items-end gap-2"
                >
                  <form.AppField
                    name={`packages[${index}].name`}
                    validators={{ onChange: required, onBlur: required }}
                  >
                    {(field) => (
                      <field.TextField
                        label={t.products.packageName}
                        required
                      />
                    )}
                  </form.AppField>
                  <form.AppField
                    name={`packages[${index}].size`}
                    validators={{
                      onChange: allOf(required, decimal(3)),
                      onBlur: allOf(required, decimal(3)),
                    }}
                  >
                    {(field) => (
                      <field.DecimalField label={t.products.packageSize} />
                    )}
                  </form.AppField>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`${t.products.removePackage} ${String(index + 1)}`}
                    onClick={() => {
                      list.removeValue(index)
                    }}
                  >
                    <Trash2Icon aria-hidden />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                className="self-start"
                onClick={() => {
                  list.pushValue({ name: "", size: "" })
                }}
              >
                <PlusIcon data-icon="inline-start" aria-hidden />
                {t.products.addPackage}
              </Button>
            </FieldSet>
          )}
        </form.AppField>

        <form.AppField name="barcodes" mode="array">
          {(list) => (
            <FieldSet>
              <FieldLegend variant="label">{t.products.barcodes}</FieldLegend>
              <FieldDescription>{t.products.barcodesHint}</FieldDescription>
              {list.state.value.map((_, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[1fr_9rem_auto] items-end gap-2"
                >
                  <form.AppField
                    name={`barcodes[${index}].value`}
                    validators={{ onChange: required, onBlur: required }}
                  >
                    {(field) => (
                      <field.TextField
                        label={t.products.barcode}
                        autoComplete="off"
                        required
                        // A scanner ends with Enter: it must not save the half-filled form.
                        onKeyDown={(event) => {
                          if (event.key === "Enter") event.preventDefault()
                        }}
                      />
                    )}
                  </form.AppField>
                  <form.AppField name={`barcodes[${index}].package`}>
                    {(field) => (
                      <field.SelectField
                        label={t.products.barcodePackage}
                        options={packageOptions}
                      />
                    )}
                  </form.AppField>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`${t.products.removeBarcode} ${String(index + 1)}`}
                    onClick={() => {
                      list.removeValue(index)
                    }}
                  >
                    <Trash2Icon aria-hidden />
                  </Button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    list.pushValue({ value: "", package: piece })
                  }}
                >
                  <PlusIcon data-icon="inline-start" aria-hidden />
                  {t.products.addBarcode}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={generating}
                  onClick={() => {
                    setGenerating(true)
                    setGenerateError(null)
                    generateBarcode()
                      .then((value) => {
                        list.pushValue({ value, package: piece })
                      })
                      .catch((error: unknown) => {
                        setGenerateError(error)
                      })
                      .finally(() => {
                        setGenerating(false)
                      })
                  }}
                >
                  {generating ? (
                    <Spinner data-icon="inline-start" aria-hidden />
                  ) : (
                    <WandSparklesIcon data-icon="inline-start" aria-hidden />
                  )}
                  {t.products.generateBarcode}
                </Button>
              </div>
              {generateError !== null && (
                <ProblemAlert
                  title={t.products.generateFailed}
                  error={generateError}
                />
              )}
            </FieldSet>
          )}
        </form.AppField>
      </FormChecksProvider>
    </FormDialog>
  )
}

/** "4601234567891 уже у товара 10000 «Тетрадь 48 листов»", when the server says whose it is. */
function TakenBy({ error }: { error: unknown }) {
  const t = useT()
  const taken = problemWith(error, "BARCODE_TAKEN")
  if (!taken?.barcode || !taken.product) return null
  return (
    <p>
      {`${taken.barcode} ${t.products.barcodeTakenBy} ${String(taken.product.code)} «${taken.product.name}»`}
    </p>
  )
}
