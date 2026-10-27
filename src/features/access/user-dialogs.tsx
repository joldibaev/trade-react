import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useSelector } from "@tanstack/react-form"
import { useState } from "react"

import type { FieldCode } from "@/api/errors"
import {
  FormChecksProvider,
  useFormChecks,
} from "@/components/form/form-checks"
import { allOf, required, useAppForm } from "@/components/form/form"
import { FormDialog, useRefusal } from "@/components/form/form-dialog"
import { storesQuery } from "@/features/stores/stores-api"
import { useT } from "@/i18n/i18n"
import { changedFields } from "@/lib/changes"

import {
  createUser,
  groupsQuery,
  resetPassword,
  updateUser,
  userQuery,
  type User,
} from "./access-api"

/** TradeNet's only password rule: 15 characters or more (users.md). */
export const passwordMinLength = 15

export function longPassword({
  value,
}: {
  value: string
}): FieldCode | undefined {
  return value.length > 0 && value.length < passwordMinLength
    ? "PASSWORD_TOO_SHORT"
    : undefined
}

/** For "repeat the password": the codes go under the repeat field. */
export function passwordsDiffer(
  password: string,
  repeat: string,
  repeatField: string
): Record<string, FieldCode> {
  return password === repeat ? {} : { [repeatField]: "PASSWORDS_DIFFER" }
}

const valuesOf = (user: User | undefined) => ({
  login: user?.login ?? "",
  password: "",
  repeat: "",
  fullName: user?.fullName ?? "",
  phone: user?.phone ?? "",
  groupId: user?.group.id ?? "",
  storesAll: user?.stores.all ?? false,
  storeIds: user?.stores.storeIds ?? [],
  reason: "",
})

/**
 * A new person, or a change to one: login, name, phone, group, stores. A new group ends the person's sessions and
 * needs a reason (TradeNet users.md); the dialog asks for it only then.
 */
export function UserFormDialog({
  user,
  open,
  onOpenChange,
  onSaved,
}: {
  user?: User
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (user: User) => void
}) {
  const t = useT()
  const queryClient = useQueryClient()
  const refusal = useRefusal()
  const checks = useFormChecks()
  const [base, setBase] = useState(user)
  const groups = useQuery(groupsQuery).data ?? []
  const stores = useQuery(storesQuery()).data ?? []

  const form = useAppForm({
    defaultValues: valuesOf(base),
    onSubmit: async ({ value, formApi }) => {
      refusal.clear()
      const adminGroup = groups.find((g) => g.id === value.groupId)?.builtIn
      const storeAccess = {
        // ADMIN always has every store; the database refuses anything else.
        all: adminGroup === true || value.storesAll,
        storeIds: adminGroup || value.storesAll ? null : value.storeIds,
      }
      const reason = value.reason.trim() || null
      if (base) {
        const before = valuesOf(base)
        const changes = changedFields(
          {
            login: before.login,
            fullName: before.fullName,
            phone: before.phone,
            groupId: before.groupId,
            stores: { all: before.storesAll, storeIds: before.storeIds },
          },
          {
            login: value.login.trim(),
            fullName: value.fullName.trim(),
            phone: value.phone.trim(),
            groupId: value.groupId,
            stores: {
              all: storeAccess.all,
              storeIds: storeAccess.storeIds ?? [],
            },
          }
        )
        if (changes.groupId !== undefined && !reason) {
          checks.refuse({ reason: "REQUIRED" })
          return
        }
        try {
          const saved = await updateUser(queryClient, base, {
            ...changes,
            ...(changes.stores && { stores: storeAccess }),
            reason,
          })
          onOpenChange(false)
          onSaved?.(saved)
        } catch (error) {
          refusal.show(formApi, error)
        }
        return
      }
      if (
        checks.refuse(passwordsDiffer(value.password, value.repeat, "repeat"))
      )
        return
      try {
        const saved = await createUser(queryClient, {
          login: value.login.trim(),
          password: value.password,
          fullName: value.fullName.trim(),
          phone: value.phone.trim(),
          groupId: value.groupId,
          stores: storeAccess,
          reason,
        })
        onOpenChange(false)
        onSaved?.(saved)
      } catch (error) {
        refusal.show(formApi, error)
      }
    },
  })

  const groupId = useSelector(form.store, (s) => s.values.groupId)
  const storesAll = useSelector(form.store, (s) => s.values.storesAll)
  const adminChosen = groups.find((g) => g.id === groupId)?.builtIn === true
  const groupChanged = base !== undefined && groupId !== base.group.id

  return (
    <FormDialog
      wide
      open={open}
      onOpenChange={onOpenChange}
      title={user ? t.users.editTitle : t.users.createTitle}
      refusal={refusal.refusal}
      refusalTitle={t.common.saveFailed}
      onReload={() => {
        if (!base) return
        void queryClient
          .query({ ...userQuery(base.id), staleTime: 0 })
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
          <form.SubmitButton label={user ? t.common.save : t.common.create} />
        </form.AppForm>
      }
    >
      <FormChecksProvider value={checks}>
        <form.AppField
          name="fullName"
          validators={{ onChange: required, onBlur: required }}
        >
          {(field) => (
            <field.TextField
              label={t.users.fullName}
              autoComplete="off"
              required
            />
          )}
        </form.AppField>
        <form.AppField
          name="phone"
          validators={{ onChange: required, onBlur: required }}
        >
          {(field) => (
            <field.TextField
              label={t.users.phone}
              description={t.common.phoneHint}
              type="tel"
              autoComplete="off"
              required
            />
          )}
        </form.AppField>
        <form.AppField
          name="login"
          validators={{ onChange: required, onBlur: required }}
        >
          {(field) => (
            <field.TextField
              label={t.users.login}
              autoComplete="off"
              required
            />
          )}
        </form.AppField>
        {!user && (
          <>
            <form.AppField
              name="password"
              validators={{
                onChange: allOf(required, longPassword),
                onBlur: allOf(required, longPassword),
              }}
            >
              {(field) => (
                <field.TextField
                  label={t.users.password}
                  description={t.users.passwordHint}
                  type="password"
                  autoComplete="new-password"
                  required
                />
              )}
            </form.AppField>
            <form.AppField
              name="repeat"
              validators={{ onChange: required, onBlur: required }}
            >
              {(field) => (
                <field.TextField
                  label={t.users.repeatPassword}
                  type="password"
                  autoComplete="new-password"
                  required
                />
              )}
            </form.AppField>
          </>
        )}
        <form.AppField
          name="groupId"
          validators={{ onChange: required, onBlur: required }}
        >
          {(field) => (
            <field.SelectField
              label={t.users.group}
              placeholder={t.users.chooseGroup}
              description={groupChanged ? t.users.groupChangeHint : undefined}
              options={groups.map((g) => ({ value: g.id, label: g.name }))}
            />
          )}
        </form.AppField>
        {adminChosen ? (
          <p className="text-sm text-muted-foreground">
            {t.users.adminHasAllStores}
          </p>
        ) : (
          <>
            <form.AppField name="storesAll">
              {(field) => (
                <field.SwitchField
                  label={t.users.allStores}
                  description={t.users.allStoresHint}
                />
              )}
            </form.AppField>
            {!storesAll && (
              <form.AppField name="storeIds">
                {(field) => (
                  <field.CheckboxListField
                    legend={t.users.stores}
                    description={t.users.storesHint}
                    options={stores.map((s) => ({
                      value: s.id,
                      label: s.isActive
                        ? s.name
                        : `${s.name} (${t.stores.inactive})`,
                    }))}
                  />
                )}
              </form.AppField>
            )}
          </>
        )}
        <form.AppField name="reason">
          {(field) => (
            <field.TextareaField
              label={groupChanged ? t.users.reasonRequired : t.users.reason}
              description={t.users.reasonHint}
              required={groupChanged}
            />
          )}
        </form.AppField>
      </FormChecksProvider>
    </FormDialog>
  )
}

/** Deactivating ends every session of the person at once and needs a reason; reactivating does not. */
export function UserActivationDialog({
  user,
  open,
  onOpenChange,
}: {
  user: User
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const queryClient = useQueryClient()
  const refusal = useRefusal()
  const deactivating = user.isActive
  const form = useAppForm({
    defaultValues: { reason: "" },
    onSubmit: async ({ value, formApi }) => {
      refusal.clear()
      try {
        await updateUser(queryClient, user, {
          isActive: !user.isActive,
          reason: value.reason.trim() || null,
        })
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
      title={`${deactivating ? t.users.deactivate : t.users.activate}: ${user.fullName}`}
      description={deactivating ? t.users.deactivateHint : t.users.activateHint}
      refusal={refusal.refusal}
      refusalTitle={t.common.saveFailed}
      onReload={() => {
        onOpenChange(false)
      }}
      formRef={refusal.formRef}
      onSubmit={() => form.handleSubmit()}
      submit={
        <form.AppForm>
          <form.SubmitButton
            label={deactivating ? t.users.deactivate : t.users.activate}
          />
        </form.AppForm>
      }
    >
      <form.AppField
        name="reason"
        validators={
          deactivating ? { onChange: required, onBlur: required } : {}
        }
      >
        {(field) => (
          <field.TextareaField
            label={deactivating ? t.users.reasonRequired : t.users.reason}
            required={deactivating}
          />
        )}
      </form.AppField>
    </FormDialog>
  )
}

/** A new password from the admin: all the person's sessions end; they sign in with it and may change it. */
export function ResetPasswordDialog({
  user,
  open,
  onOpenChange,
}: {
  user: User
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const queryClient = useQueryClient()
  const refusal = useRefusal()
  const checks = useFormChecks()
  const form = useAppForm({
    defaultValues: { newPassword: "", repeat: "", reason: "" },
    onSubmit: async ({ value, formApi }) => {
      refusal.clear()
      if (
        checks.refuse(
          passwordsDiffer(value.newPassword, value.repeat, "repeat")
        )
      )
        return
      try {
        await resetPassword(queryClient, user, {
          newPassword: value.newPassword,
          reason: value.reason.trim(),
        })
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
      title={`${t.users.resetPassword}: ${user.fullName}`}
      description={t.users.resetPasswordHint}
      refusal={refusal.refusal}
      refusalTitle={t.common.saveFailed}
      onReload={() => {
        onOpenChange(false)
      }}
      formRef={refusal.formRef}
      onSubmit={() => form.handleSubmit()}
      submit={
        <form.AppForm>
          <form.SubmitButton label={t.users.resetPassword} />
        </form.AppForm>
      }
    >
      <FormChecksProvider value={checks}>
        <form.AppField
          name="newPassword"
          validators={{
            onChange: allOf(required, longPassword),
            onBlur: allOf(required, longPassword),
          }}
        >
          {(field) => (
            <field.TextField
              label={t.users.newPassword}
              description={t.users.passwordHint}
              type="password"
              autoComplete="new-password"
              required
            />
          )}
        </form.AppField>
        <form.AppField
          name="repeat"
          validators={{ onChange: required, onBlur: required }}
        >
          {(field) => (
            <field.TextField
              label={t.users.repeatPassword}
              type="password"
              autoComplete="new-password"
              required
            />
          )}
        </form.AppField>
        <form.AppField
          name="reason"
          validators={{ onChange: required, onBlur: required }}
        >
          {(field) => (
            <field.TextareaField label={t.users.reasonRequired} required />
          )}
        </form.AppField>
      </FormChecksProvider>
    </FormDialog>
  )
}
