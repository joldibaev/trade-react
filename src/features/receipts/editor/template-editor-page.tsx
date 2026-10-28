import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  ArrowLeftIcon,
  CircleAlertIcon,
  CopyPlusIcon,
  PrinterIcon,
  Redo2Icon,
  Undo2Icon,
} from "lucide-react"
import { useCallback, useMemo, useState } from "react"

import { isApiError } from "@/api/errors"
import { focusFirstInvalid, useAppForm } from "@/components/form/form"
import { useRefusal } from "@/components/form/form-dialog"
import { PageHeader } from "@/components/page"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  SaveRefusal,
  snapshotOf,
  TemplateLoader,
  useLeaveGuard,
} from "@/features/printing/editor-shell"
import { NumberValidityContext } from "@/features/printing/fields"
import { useHistory } from "@/features/printing/history"
import { storesQuery } from "@/features/stores/stores-api"
import { useT } from "@/i18n/i18n"
import { nameError } from "@/lib/text-rules"

import type { BlockType, ReceiptLayout } from "../receipt/layout"
import { ReceiptQrError, printReceipt, qrNumber } from "../receipt/print"
import { qrFailures, type QrFailure } from "../receipt/qr-check"
import { sampleReceipt } from "../receipt/sample"
import { ActivationConfirm, DeleteConfirm } from "../template-commands"
import {
  createReceiptTemplate,
  receiptTemplateQuery,
  updateReceiptTemplate,
  type ReceiptTemplate,
} from "../templates-api"
import { BlocksPanel } from "./blocks-panel"
import {
  applyAction,
  draftErrors,
  draftOf,
  layoutOf,
  newBlock,
  newKey,
  serverBlockErrors,
  standardLayout,
  type BlockAction,
  type BlockErrors,
  type Draft,
} from "./draft"
import { BlockProperties, RollProperties } from "./properties-panel"
import { useReceiptFrame } from "./receipt-preview"

/** An existing template, or a new one (the standard receipt, or a copy of another with `from`). */
export function ReceiptTemplateEditorPage({
  templateId,
  copyFrom,
}: {
  templateId?: string
  copyFrom?: string
}) {
  const t = useT()
  const source = templateId ?? copyFrom
  const query = useQuery({
    ...receiptTemplateQuery(source ?? ""),
    enabled: source !== undefined,
  })
  return (
    <TemplateLoader
      source={source}
      query={query}
      failedTitle={t.receiptEditor.loadFailed}
    >
      {(loaded) => {
        const template = templateId ? loaded : undefined
        const initial: { name: string; layout: ReceiptLayout } =
          loaded && copyFrom
            ? {
                name: `${loaded.name} ${t.receiptEditor.copySuffix}`,
                layout: loaded.layout,
              }
            : loaded
              ? { name: loaded.name, layout: loaded.layout }
              : {
                  name: "",
                  layout: standardLayout({
                    text: t.receiptEditor.sample.thanks,
                    title: t.receiptEditor.sample.title,
                  }),
                }
        return (
          <Editor
            key={template?.id ?? copyFrom ?? "new"}
            template={template}
            initial={initial}
          />
        )
      }}
    </TemplateLoader>
  )
}

/** What the person who edits is told about one QR block that a real shop's receipt could not print. */
function failureText(
  t: ReturnType<typeof useT>,
  layout: ReceiptLayout,
  failure: QrFailure
) {
  const shown = failure.shops.slice(0, 5).map((name) => `«${name}»`)
  const scope = [
    failure.shops.length > 0
      ? `${t.receiptEditor.store} ${shown.join(", ")}${failure.shops.length > shown.length ? ", …" : ""}`
      : null,
    failure.longTotal ? t.receiptEditor.longTotal : null,
  ]
    .filter(Boolean)
    .join("; ")
  return `${t.receiptEditor.kinds.QR} №${String(qrNumber(layout, failure.index))} (${scope}): ${t.receiptEditor[failure.kind]}`
}

function Editor({
  template,
  initial,
}: {
  template: ReceiptTemplate | undefined
  initial: { name: string; layout: ReceiptLayout }
}) {
  const t = useT()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const history = useHistory<Draft>(draftOf(initial.layout))
  const { draft } = history
  const [base, setBase] = useState(template)
  const [saved, setSaved] = useState(
    template ? snapshotOf(initial.name, initial.layout) : null
  )
  const [selected, setSelected] = useState<string | null>(null)
  const [serverErrors, setServerErrors] = useState<Map<string, BlockErrors>>(
    new Map()
  )
  const [blocked, setBlocked] = useState(false)
  const [printError, setPrintError] = useState<unknown>(null)
  const [printing, setPrinting] = useState(false)
  const [reloading, setReloading] = useState(false)
  const [command, setCommand] = useState<"activation" | "delete" | null>(null)
  // Number fields holding text they cannot use yet: saving waits for the person to fix them.
  const [badNumbers, setBadNumbers] = useState<ReadonlySet<string>>(new Set())
  const reportNumber = useCallback((id: string, invalid: boolean) => {
    setBadNumbers((current) => {
      if (current.has(id) === invalid) return current
      const next = new Set(current)
      if (invalid) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])
  const {
    refusal,
    formRef,
    show: showRefusal,
    clear: clearRefusal,
  } = useRefusal()

  const layout = useMemo(() => layoutOf(draft), [draft])
  const sample = useMemo(
    () =>
      sampleReceipt({
        ...t.receiptEditor.sample,
        cash: t.paymentMethods.cash,
      }),
    [t]
  )
  const { issues, frameProps } = useReceiptFrame(layout, sample, t.receipt)
  // The sample shop is short; a real shop's address can be 500 characters, and a link grows sixfold when encoded.
  const stores = useQuery(storesQuery()).data
  const failures = useMemo(
    () => qrFailures(layout, sample, stores ?? [], t.receipt.number),
    [layout, sample, stores, t]
  )
  const keyAt = (index: number) => draft.blocks[index]?.key
  const flagged = new Set(
    [...issues, ...failures].flatMap((issue) => {
      const key = keyAt(issue.index)
      return key === undefined ? [] : [key]
    })
  )

  const clientErrors = draftErrors(draft)
  const invalid = new Set([...clientErrors.keys(), ...serverErrors.keys()])
  invalid.delete("")
  const errorsOf = (key: string): BlockErrors => ({
    ...serverErrors.get(key),
    ...clientErrors.get(key),
  })
  const layoutErrors = errorsOf("")
  const selectedItem = draft.blocks.find((item) => item.key === selected)
  const firstInvalid = () =>
    [...clientErrors.keys(), ...serverErrors.keys()].find((key) => key !== "")
  const cannotProceed = clientErrors.size > 0 || badNumbers.size > 0

  // Editing what the server refused takes its word back, as every field does (`field-state.tsx`).
  const forgetServerError = (key: string, fields?: string[]) => {
    setServerErrors((current) => {
      const known = current.get(key)
      if (!known) return current
      const rest = new Map(current)
      const left = fields
        ? Object.fromEntries(
            Object.entries(known).filter(([field]) => !fields.includes(field))
          )
        : {}
      if (Object.keys(left).length > 0) rest.set(key, left)
      else rest.delete(key)
      return rest
    })
  }

  /** Puts what the server kept in place of the draft: the server may have normalized a text. */
  const adopt = (kept: ReceiptTemplate) => {
    const index = draft.blocks.findIndex((item) => item.key === selected)
    const fresh = draftOf(kept.layout)
    history.reset(fresh)
    setSelected(fresh.blocks[index]?.key ?? null)
    form.reset({ name: kept.name })
    setServerErrors(new Map())
    setBase(kept)
    setSaved(snapshotOf(kept.name, kept.layout))
  }

  const form = useAppForm({
    defaultValues: { name: initial.name },
    onSubmit: async ({ value, formApi }) => {
      clearRefusal()
      setBlocked(false)
      if (cannotProceed) {
        // Show the first block TradeNet would refuse, with its error in the properties.
        setBlocked(true)
        // A number being typed stays open: closing its panel would forget it.
        setSelected(firstInvalid() ?? selected)
        return
      }
      const name = value.name.trim()
      try {
        const result = base
          ? await updateReceiptTemplate(queryClient, base, {
              ...(name !== base.name && { name }),
              ...(JSON.stringify(layout) !== JSON.stringify(base.layout) && {
                layout,
              }),
            })
          : await createReceiptTemplate(queryClient, { name, layout })
        adopt(result)
        if (!base)
          await navigate({
            to: "/receipt-templates/$templateId",
            params: { templateId: result.id },
            replace: true,
            // Just saved: the guard still sees the state of the render before the save.
            ignoreBlocker: true,
          })
      } catch (error) {
        if (isApiError(error) && error.code === "VALIDATION_ERROR") {
          const found = serverBlockErrors(draft, error.fieldErrors)
          setServerErrors(found)
          const first = [...found.keys()].find((key) => key !== "")
          if (first) setSelected(first)
        }
        showRefusal(formApi, error)
      }
    },
  })

  const dirty = (name: string) =>
    saved === null || saved !== snapshotOf(name, layout)
  useLeaveGuard(() => dirty(form.state.values.name))

  const add = (type: BlockType, image?: string) => {
    const block = newBlock(type, {
      text: t.receiptEditor.sample.thanks,
      title: t.receiptEditor.sample.title,
    })
    const item = {
      key: newKey(),
      block: block.type === "IMAGE" && image ? { ...block, src: image } : block,
    }
    history.change({ ...draft, blocks: [...draft.blocks, item] })
    setSelected(item.key)
  }
  const act = (action: BlockAction) => {
    if (selected === null) return
    const result = applyAction(draft, selected, action)
    history.change(result.draft)
    setSelected(result.selected)
  }
  const testPrint = () => {
    setPrintError(null)
    if (cannotProceed) {
      setBlocked(true)
      // A number being typed stays open: closing its panel would forget it.
      setSelected(firstInvalid() ?? selected)
      return
    }
    setPrinting(true)
    printReceipt(layout, sample, t.receipt)
      .catch((error: unknown) => {
        setPrintError(error)
      })
      .finally(() => {
        setPrinting(false)
      })
  }
  const reload = async () => {
    if (!base) return
    const fresh = await queryClient.query({
      ...receiptTemplateQuery(base.id),
      staleTime: 0,
    })
    adopt(fresh)
    setSelected(null)
    clearRefusal()
  }

  const printMessage =
    printError instanceof ReceiptQrError
      ? `${t.receiptEditor.kinds.QR} №${String(printError.qrNumber)}: ${t.receiptEditor[printError.kind]}`
      : t.receiptEditor.testPrintFailed

  return (
    <NumberValidityContext.Provider value={reportNumber}>
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
          to="/receipt-templates"
          className={buttonVariants({
            variant: "ghost",
            size: "sm",
            className: "self-start",
          })}
        >
          <ArrowLeftIcon data-icon="inline-start" aria-hidden />
          {t.receiptTemplates.title}
        </Link>
        <PageHeader
          title={base ? base.name : t.receiptEditor.newTitle}
          badge={
            base && !base.isActive ? (
              <span className="text-sm text-muted-foreground">
                {t.receiptTemplates.inactive}
              </span>
            ) : undefined
          }
        >
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={!history.canUndo}
            aria-label={t.receiptEditor.undo}
            title={t.receiptEditor.undo}
            onClick={history.undo}
          >
            <Undo2Icon aria-hidden />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={!history.canRedo}
            aria-label={t.receiptEditor.redo}
            title={t.receiptEditor.redo}
            onClick={history.redo}
          >
            <Redo2Icon aria-hidden />
          </Button>
          {base && (
            <>
              <Link
                to="/receipt-templates/new"
                search={{ from: base.id }}
                className={buttonVariants({ variant: "outline" })}
              >
                <CopyPlusIcon data-icon="inline-start" aria-hidden />
                {t.receiptTemplates.makeCopy}
              </Link>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCommand("activation")
                }}
              >
                {base.isActive
                  ? t.receiptTemplates.deactivate
                  : t.receiptTemplates.activate}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCommand("delete")
                }}
              >
                {t.receiptTemplates.delete}
              </Button>
            </>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={printing}
            onClick={testPrint}
          >
            <PrinterIcon data-icon="inline-start" aria-hidden />
            {t.receiptEditor.testPrint}
          </Button>
          <form.AppForm>
            <form.SubmitButton label={t.common.save} />
          </form.AppForm>
        </PageHeader>
        <div className="w-full max-w-md">
          <form.AppField
            name="name"
            validators={{ onChange: nameError, onBlur: nameError }}
          >
            {(field) => (
              <field.TextField label={t.receiptEditor.name} required />
            )}
          </form.AppField>
        </div>
        <SaveRefusal
          refusal={refusal}
          reloading={reloading}
          onReloading={setReloading}
          confirmText={t.receiptEditor.reloadConfirm}
          failedTitle={t.receiptEditor.loadFailed}
          onReload={reload}
        />
        {blocked && cannotProceed && (
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden />
            <AlertTitle>{t.receiptEditor.fixErrors}</AlertTitle>
            <AlertDescription>{t.receiptEditor.fixErrorsHint}</AlertDescription>
          </Alert>
        )}
        {printError !== null && (
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden />
            <AlertTitle>{t.receiptEditor.printFailed}</AlertTitle>
            <AlertDescription>{printMessage}</AlertDescription>
          </Alert>
        )}

        {/* Three columns only where the middle one holds the whole 80 mm roll (about 340 px with its card): from
          1280 px, the sidebar open. Narrower, the panels stack and the paper is never clipped. */}
        <div className="grid gap-4 xl:grid-cols-[16rem_minmax(0,1fr)_20rem]">
          <Card size="sm">
            <CardContent>
              <BlocksPanel
                draft={draft}
                selected={selected}
                invalid={invalid}
                flagged={flagged}
                layoutError={layoutErrors.blocks}
                onSelect={setSelected}
                onAdd={add}
                onAction={act}
              />
            </CardContent>
          </Card>
          <Card size="sm" className="min-w-0">
            <CardHeader>
              <CardTitle>{t.receiptEditor.preview}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                {t.receiptEditor.previewHint}
              </p>
              {issues.map((issue) => (
                <Alert key={`${String(issue.index)}-${issue.kind}`}>
                  <CircleAlertIcon aria-hidden />
                  <AlertDescription>
                    {issue.kind === "barcodeDigitsOnly"
                      ? `${t.receiptEditor.kinds.BARCODE}: ${t.receiptEditor.barcodeDigitsOnly}`
                      : `${t.receiptEditor.kinds.QR} №${String(qrNumber(layout, issue.index))}: ${t.receiptEditor[issue.kind]}`}
                  </AlertDescription>
                </Alert>
              ))}
              {failures.map((failure) => (
                <Alert
                  key={`${String(failure.index)}-${failure.kind}`}
                  variant="destructive"
                >
                  <CircleAlertIcon aria-hidden />
                  <AlertDescription>
                    {failureText(t, layout, failure)}
                  </AlertDescription>
                </Alert>
              ))}
              <div className="overflow-x-auto">
                <iframe
                  {...frameProps}
                  title={t.receiptEditor.preview}
                  className="box-content max-w-none rounded-md border bg-white"
                />
              </div>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent>
              {selectedItem ? (
                <BlockProperties
                  key={selectedItem.key}
                  block={selectedItem.block}
                  errors={errorsOf(selectedItem.key)}
                  sample={sample}
                  onChange={(block) => {
                    forgetServerError(selectedItem.key)
                    const changed = Object.keys(block).filter(
                      (field) =>
                        block[field as keyof typeof block] !==
                        selectedItem.block[
                          field as keyof typeof selectedItem.block
                        ]
                    )
                    // Typing in one field is one step to undo; another field starts the next.
                    history.change(
                      {
                        ...draft,
                        blocks: draft.blocks.map((item) =>
                          item.key === selectedItem.key
                            ? { ...item, block }
                            : item
                        ),
                      },
                      `block:${selectedItem.key}:${changed.join()}`
                    )
                  }}
                />
              ) : (
                <RollProperties
                  layout={draft}
                  error={layoutErrors}
                  onChange={(changes) => {
                    forgetServerError("", Object.keys(changes))
                    history.change(
                      { ...draft, ...changes },
                      `roll:${Object.keys(changes).join()}`
                    )
                  }}
                />
              )}
            </CardContent>
          </Card>
        </div>
        {base && command === "activation" && (
          <ActivationConfirm
            template={base}
            onClose={() => {
              setCommand(null)
            }}
            onDone={(updated) => {
              setBase(updated)
            }}
          />
        )}
        {base && command === "delete" && (
          <DeleteConfirm
            template={base}
            onClose={() => {
              setCommand(null)
            }}
            onDone={() => {
              // Gone from the server: nothing is left to lose by leaving.
              setSaved(snapshotOf(form.state.values.name, layout))
              void navigate({ to: "/receipt-templates", ignoreBlocker: true })
            }}
          />
        )}
      </form>
    </NumberValidityContext.Provider>
  )
}
