import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useBlocker, useNavigate } from "@tanstack/react-router"
import {
  ArrowLeftIcon,
  CircleAlertIcon,
  CopyPlusIcon,
  PrinterIcon,
  Redo2Icon,
  SearchIcon,
  Undo2Icon,
  XIcon,
} from "lucide-react"
import { useMemo, useState } from "react"

import { isApiError, type FieldCode } from "@/api/errors"
import { focusFirstInvalid, required, useAppForm } from "@/components/form/form"
import { useRefusal } from "@/components/form/form-dialog"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { PageHeader } from "@/components/page"
import { ProblemAlert } from "@/components/problem-alert"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { categoriesQuery } from "@/features/catalog/categories-api"
import { categoryPath } from "@/features/catalog/category-tree"
import { ProductPickerDialog } from "@/features/products/product-picker-dialog"
import { productQuery, type Product } from "@/features/products/products-query"
import { useT } from "@/i18n/i18n"

import { LabelPreview } from "../label-preview"
import { mm } from "../mm"
import { printLabels } from "../print-frame"
import { PriceTypeSelect, usePriceTypeChoice } from "../print-job"
import {
  createTemplate,
  templateQuery,
  updateTemplate,
  type LabelLayout,
  type LabelTemplate,
} from "../templates-api"
import { EditorCanvas } from "./editor-canvas"
import {
  draftErrors,
  draftOf,
  layoutOf,
  newElement,
  newKey,
  presetLayout,
  resizeLabel,
  type Draft,
  type ElementKind,
} from "./draft"
import { useHistory } from "./history"
import { applyAction, type ItemAction } from "./items"
import { PropertiesPanel } from "./properties-panel"
import { sampleData } from "./sample"
import { ElementsPanel, LabelPanel } from "./side-panels"

/** An existing template, or a new one (from a preset, or a copy of another with `from`). */
export function TemplateEditorPage({
  templateId,
  copyFrom,
}: {
  templateId?: string
  copyFrom?: string
}) {
  const t = useT()
  const source = templateId ?? copyFrom
  const query = useQuery({
    ...templateQuery(source ?? ""),
    enabled: source !== undefined,
  })
  const priceTypes = usePriceTypeChoice()
  if (source !== undefined && query.isError)
    return (
      <ProblemAlert
        title={t.labelEditor.loadFailed}
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    )
  if ((source !== undefined && !query.data) || priceTypes.query.isPending)
    return <Skeleton className="h-96 w-full" />
  const template = templateId ? query.data : undefined
  const initial: { name: string; layout: LabelLayout } =
    query.data && copyFrom
      ? {
          name: `${query.data.name} ${t.labelEditor.copySuffix}`,
          layout: query.data.layout,
        }
      : query.data
        ? { name: query.data.name, layout: query.data.layout }
        : {
            name: "",
            layout: presetLayout(
              "standard",
              58,
              40,
              { sale: t.labelEditor.saleBanner },
              null
            ),
          }
  return (
    <Editor
      key={template?.id ?? copyFrom ?? "new"}
      template={template}
      initial={initial}
    />
  )
}

const snapshot = (name: string, layout: LabelLayout) =>
  JSON.stringify({ name: name.trim(), layout })

function Editor({
  template,
  initial,
}: {
  template: LabelTemplate | undefined
  initial: { name: string; layout: LabelLayout }
}) {
  const t = useT()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const history = useHistory<Draft>(draftOf(initial.layout))
  const { draft } = history
  const [base, setBase] = useState(template)
  const [saved, setSaved] = useState(
    template ? snapshot(initial.name, initial.layout) : null
  )
  const [selected, setSelected] = useState<string | null>(null)
  const [serverErrors, setServerErrors] = useState<Map<string, FieldCode>>(
    new Map()
  )
  const [blocked, setBlocked] = useState(false)
  const [sampleProduct, setSampleProduct] = useState<Product | null>(null)
  const [picking, setPicking] = useState(false)
  const [printError, setPrintError] = useState<unknown>(null)
  const [reloading, setReloading] = useState(false)
  const {
    refusal,
    formRef,
    show: showRefusal,
    clear: clearRefusal,
  } = useRefusal()
  const priceTypes = usePriceTypeChoice()
  const categories = useQuery(categoriesQuery).data
  const width = mm(draft.widthMm)
  const height = mm(draft.heightMm)

  const data = useMemo(
    () =>
      sampleData(t, {
        product: sampleProduct,
        priceTypeId: priceTypes.value,
        priceTypes: priceTypes.types,
        category:
          sampleProduct?.categoryId && categories
            ? categoryPath(
                sampleProduct.categoryId,
                new Map(categories.map((c) => [c.id, c]))
              )
            : "",
      }),
    [t, sampleProduct, priceTypes.value, priceTypes.types, categories]
  )

  const errors = draftErrors(draft)
  const invalid = new Set([...errors.keys(), ...serverErrors.keys()])
  invalid.delete("")
  const selectedItem = draft.items.find((item) => item.key === selected)

  const form = useAppForm({
    defaultValues: { name: initial.name },
    onSubmit: async ({ value, formApi }) => {
      clearRefusal()
      setBlocked(false)
      if (errors.size > 0) {
        // Show the first element the server would refuse, with its error in the properties.
        setBlocked(true)
        setSelected([...errors.keys()].find((key) => key !== "") ?? null)
        return
      }
      const name = value.name.trim()
      const layout = layoutOf(draft)
      try {
        const result = base
          ? await updateTemplate(queryClient, base, {
              ...(name !== base.name && { name }),
              ...(JSON.stringify(layout) !== JSON.stringify(base.layout) && {
                layout,
              }),
            })
          : await createTemplate(queryClient, { name, layout })
        setServerErrors(new Map())
        setBase(result)
        setSaved(snapshot(result.name, result.layout))
        if (!base)
          await navigate({
            to: "/label-templates/$templateId",
            params: { templateId: result.id },
            replace: true,
            // Just saved: the guard still sees the state of the render before the save.
            ignoreBlocker: true,
          })
      } catch (error) {
        if (isApiError(error) && error.code === "VALIDATION_ERROR") {
          // `layout.elements[3].text` names an element by its place in the list; the draft keys it.
          const byKey = new Map<string, FieldCode>()
          for (const [field, codes] of Object.entries(error.fieldErrors)) {
            const index = /^layout\.elements\[(\d+)\]/i.exec(field)?.[1]
            const item = draft.items.find((_, i) => String(i) === index)
            if (item && codes[0]) byKey.set(item.key, codes[0])
            else if (/^layout\./i.test(field) && codes[0])
              byKey.set("", codes[0])
          }
          setServerErrors(byKey)
          const first = [...byKey.keys()].find((key) => key !== "")
          if (first) setSelected(first)
        }
        showRefusal(formApi, error)
      }
    },
  })

  const dirty = (name: string) =>
    saved === null || saved !== snapshot(name, layoutOf(draft))
  useBlocker({
    shouldBlockFn: () =>
      dirty(form.state.values.name) && !window.confirm(t.common.leaveUnsaved),
    enableBeforeUnload: () => dirty(form.state.values.name),
  })

  const change = (next: Draft, step: string | null) => {
    history.change(next, step)
  }
  const add = (kind: ElementKind, image?: string) => {
    const item = {
      key: newKey(),
      element: newElement(kind, width, height, t.labelEditor.newText, image),
    }
    change({ ...draft, items: [...draft.items, item] }, null)
    setSelected(item.key)
  }
  const act = (action: ItemAction) => {
    if (selected === null) return
    const result = applyAction(draft, selected, action)
    change(result.draft, null)
    setSelected(result.selected)
  }
  const testPrint = () => {
    setPrintError(null)
    if (errors.size > 0) {
      setBlocked(true)
      setSelected([...errors.keys()].find((key) => key !== "") ?? null)
      return
    }
    printLabels(layoutOf(draft), [data]).catch((error: unknown) => {
      setPrintError(error)
    })
  }
  const reload = async () => {
    if (!base) return
    const fresh = await queryClient.query({
      ...templateQuery(base.id),
      staleTime: 0,
    })
    setBase(fresh)
    setSaved(snapshot(fresh.name, fresh.layout))
    history.reset(draftOf(fresh.layout))
    form.reset({ name: fresh.name })
    setSelected(null)
    clearRefusal()
  }

  const conflict = isApiError(refusal) && refusal.code === "VERSION_CONFLICT"
  const header = (
    <PageHeader
      title={base ? base.name : t.labelEditor.newTitle}
      badge={
        base && !base.isActive ? (
          <span className="text-sm text-muted-foreground">
            {t.labelTemplates.inactive}
          </span>
        ) : undefined
      }
    >
      {/* Editing is a wide-screen task: on a phone the page is the preview and a test print. */}
      <div className="hidden lg:contents">
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={!history.canUndo}
          aria-label={t.labelEditor.undo}
          title={t.labelEditor.undo}
          onClick={history.undo}
        >
          <Undo2Icon aria-hidden />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={!history.canRedo}
          aria-label={t.labelEditor.redo}
          title={t.labelEditor.redo}
          onClick={history.redo}
        >
          <Redo2Icon aria-hidden />
        </Button>
        {base && (
          <Link
            to="/label-templates/new"
            search={{ from: base.id }}
            className={buttonVariants({ variant: "outline" })}
          >
            <CopyPlusIcon data-icon="inline-start" aria-hidden />
            {t.labelEditor.makeCopy}
          </Link>
        )}
      </div>
      <Button type="button" variant="outline" onClick={testPrint}>
        <PrinterIcon data-icon="inline-start" aria-hidden />
        {t.labelEditor.testPrint}
      </Button>
      <div className="hidden lg:contents">
        <form.AppForm>
          <form.SubmitButton label={t.common.save} />
        </form.AppForm>
      </div>
    </PageHeader>
  )

  return (
    <form
      ref={formRef}
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit().then(() => {
          focusFirstInvalid(formRef.current)
        })
      }}
    >
      <Link
        to="/label-templates"
        className={buttonVariants({
          variant: "ghost",
          size: "sm",
          className: "self-start",
        })}
      >
        <ArrowLeftIcon data-icon="inline-start" aria-hidden />
        {t.labelTemplates.title}
      </Link>
      {header}
      <div className="hidden w-full max-w-md lg:block">
        <form.AppField
          name="name"
          validators={{ onChange: required, onBlur: required }}
        >
          {(field) => <field.TextField label={t.labelEditor.name} required />}
        </form.AppField>
      </div>
      {refusal !== null && (
        <ProblemAlert
          title={t.common.saveFailed}
          error={refusal}
          onRetry={
            conflict
              ? () => {
                  setReloading(true)
                }
              : undefined
          }
          retryLabel={t.common.loadCurrent}
        />
      )}
      <ConfirmDialog
        open={reloading}
        onOpenChange={setReloading}
        title={t.common.loadCurrent}
        description={t.labelEditor.reloadConfirm}
        confirmLabel={t.common.loadCurrent}
        action={reload}
        failedTitle={t.labelEditor.loadFailed}
      />
      {blocked && errors.size > 0 && (
        <Alert variant="destructive">
          <CircleAlertIcon aria-hidden />
          <AlertTitle>{t.labelEditor.fixErrors}</AlertTitle>
          <AlertDescription>{t.labelEditor.fixErrorsHint}</AlertDescription>
        </Alert>
      )}
      {printError !== null && (
        <ProblemAlert title={t.labels.printFailed} error={printError} />
      )}

      {/* Editing is a desktop task; on a narrow screen the template is shown and can be test-printed. */}
      <div className="flex flex-col gap-3 lg:hidden">
        <Alert>
          <AlertDescription>{t.labelEditor.wideScreen}</AlertDescription>
        </Alert>
        <LabelPreview layout={layoutOf(draft)} data={data} />
      </div>

      <div className="hidden gap-4 lg:grid lg:grid-cols-[14rem_minmax(0,1fr)_20rem]">
        <Card size="sm">
          <CardContent>
            <ElementsPanel
              draft={draft}
              selected={selected}
              onSelect={setSelected}
              onAdd={add}
              onAction={act}
              invalid={invalid}
            />
          </CardContent>
        </Card>
        <Card size="sm" className="min-w-0">
          <CardHeader>
            <CardTitle>{t.labelEditor.layout}</CardTitle>
          </CardHeader>
          <CardContent>
            <EditorCanvas
              draft={draft}
              data={data}
              selected={selected}
              onSelect={setSelected}
              onChange={change}
              onAction={act}
              invalid={invalid}
            />
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          <Card size="sm">
            <CardContent>
              {selectedItem ? (
                <PropertiesPanel
                  key={selectedItem.key}
                  item={selectedItem}
                  labelWidth={width}
                  labelHeight={height}
                  priceTypes={priceTypes.types}
                  sample={data}
                  serverError={serverErrors.get(selectedItem.key) ?? null}
                  error={errors.get(selectedItem.key) ?? null}
                  onChange={(element, step) => {
                    change(
                      {
                        ...draft,
                        items: draft.items.map((item) =>
                          item.key === selectedItem.key
                            ? { ...item, element }
                            : item
                        ),
                      },
                      step
                    )
                  }}
                />
              ) : (
                <LabelPanel
                  draft={draft}
                  onResize={(w, h) => {
                    change(resizeLabel(draft, w, h), "label-size")
                  }}
                  onPreset={(preset) => {
                    const oldType =
                      priceTypes.types.find((type) => type.isDefault)?.id ??
                      null
                    change(
                      draftOf(
                        presetLayout(
                          preset,
                          width,
                          height,
                          { sale: t.labelEditor.saleBanner },
                          oldType
                        )
                      ),
                      null
                    )
                  }}
                />
              )}
            </CardContent>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardTitle>{t.labelEditor.sampleTitle}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm">{data.values.name}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPicking(true)
                  }}
                >
                  <SearchIcon data-icon="inline-start" aria-hidden />
                  {t.labelEditor.pickProduct}
                </Button>
                {sampleProduct && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSampleProduct(null)
                    }}
                  >
                    <XIcon data-icon="inline-start" aria-hidden />
                    {t.labelEditor.backToSample}
                  </Button>
                )}
              </div>
              <PriceTypeSelect choice={priceTypes} />
            </CardContent>
          </Card>
        </div>
      </div>
      {picking && (
        <ProductPickerDialog
          open
          onOpenChange={setPicking}
          title={t.labelEditor.pickProduct}
          hint={t.labelEditor.pickHint}
          chosen={new Set(sampleProduct ? [sampleProduct.id] : [])}
          onPick={(item) => {
            setPicking(false)
            void queryClient
              .query({ ...productQuery(item.id), staleTime: 0 })
              .then(setSampleProduct)
          }}
        />
      )}
    </form>
  )
}
