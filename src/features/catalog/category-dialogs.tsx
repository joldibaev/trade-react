import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo } from "react"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { required, useAppForm } from "@/components/form/form"
import { FormDialog, useRefusal } from "@/components/form/form-dialog"
import { useT } from "@/i18n/i18n"
import { changedFields } from "@/lib/changes"

import {
  categoriesQuery,
  createCategory,
  deleteCategory,
  updateCategory,
} from "./categories-api"
import {
  branchIds,
  buildCategoryTree,
  categoryPath,
  flattenTree,
  type Category,
  type CategoryNode,
} from "./category-tree"

/** The select's value for "at the top level": a select item needs a non-empty value. */
const topLevel = "top"

/**
 * A new category (under `parentId` when given), or a rename and move of an existing one. Moving is choosing another
 * parent; the category's own branch is not offered, since the server refuses it (409 `CATEGORY_CYCLE`).
 */
export function CategoryFormDialog({
  category,
  parentId,
  open,
  onOpenChange,
}: {
  category?: Category
  parentId?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const queryClient = useQueryClient()
  const refusal = useRefusal()
  const categories = useQuery(categoriesQuery).data

  const parentOptions = useMemo(() => {
    const list = categories ?? []
    const tree = buildCategoryTree(list)
    const own = category
      ? flattenTree(tree).find((node) => node.id === category.id)
      : undefined
    const excluded = own ? branchIds(own) : new Set<string>()
    const byId = new Map(list.map((c) => [c.id, c]))
    return [
      { value: topLevel, label: t.categories.topLevel },
      ...flattenTree(tree)
        .filter((node) => !excluded.has(node.id))
        .map((node) => ({
          value: node.id,
          label: categoryPath(node.id, byId),
        })),
    ]
  }, [categories, category, t])

  const initial = {
    name: category?.name ?? "",
    parent: (category ? category.parentId : parentId) ?? topLevel,
  }

  const form = useAppForm({
    defaultValues: initial,
    onSubmit: async ({ value, formApi }) => {
      refusal.clear()
      const name = value.name.trim()
      const parent = value.parent === topLevel ? null : value.parent
      try {
        if (category) {
          const changes = changedFields(initial, { ...value, name })
          await updateCategory(queryClient, category, {
            ...(changes.name !== undefined && { name }),
            ...(changes.parent !== undefined && { parent: { id: parent } }),
          })
        } else await createCategory(queryClient, { name, parentId: parent })
        onOpenChange(false)
      } catch (error) {
        refusal.show(formApi, error)
      }
    },
  })

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={category ? t.categories.editTitle : t.categories.createTitle}
      refusal={refusal.refusal}
      refusalTitle={t.common.saveFailed}
      // The conflict already read the categories again; the dialog starts over from them when reopened.
      onReload={() => {
        onOpenChange(false)
      }}
      formRef={refusal.formRef}
      onSubmit={() => form.handleSubmit()}
      submit={
        <form.AppForm>
          <form.SubmitButton
            label={category ? t.common.save : t.common.create}
          />
        </form.AppForm>
      }
    >
      <form.AppField
        name="name"
        validators={{ onChange: required, onBlur: required }}
      >
        {(field) => <field.TextField label={t.categories.name} required />}
      </form.AppField>
      <form.AppField name="parent">
        {(field) => (
          <field.SelectField
            label={t.categories.parent}
            options={parentOptions}
          />
        )}
      </form.AppField>
    </FormDialog>
  )
}

export function DeleteCategoryDialog({
  category,
  open,
  onOpenChange,
  onDeleted,
}: {
  category: CategoryNode
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}) {
  const t = useT()
  const queryClient = useQueryClient()
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`${t.categories.delete}: ${category.name}`}
      description={t.categories.deleteHint}
      confirmLabel={t.categories.delete}
      destructive
      failedTitle={t.categories.deleteFailed}
      action={async () => {
        await deleteCategory(queryClient, category)
        onDeleted()
      }}
    />
  )
}
