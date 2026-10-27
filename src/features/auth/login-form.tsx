import { useQueryClient } from "@tanstack/react-query"
import { useRef, useState } from "react"

import {
  focusFirstInvalid,
  required,
  showServerFieldErrors,
  useAppForm,
} from "@/components/form/form"
import { ProblemAlert } from "@/components/problem-alert"
import { FieldGroup } from "@/components/ui/field"
import { useT } from "@/i18n/i18n"

import { signIn, type LoginRequest } from "./session"

export function LoginForm({ onSignedIn }: { onSignedIn: () => void }) {
  const t = useT()
  const queryClient = useQueryClient()
  const formRef = useRef<HTMLFormElement>(null)
  // A refusal of the whole request (wrong password, too many attempts); field codes go under their fields instead.
  const [refusal, setRefusal] = useState<unknown>(null)

  const form = useAppForm({
    defaultValues: { login: "", password: "" } satisfies LoginRequest,
    onSubmit: async ({ value, formApi }) => {
      setRefusal(null)
      try {
        await signIn(queryClient, value)
        onSignedIn()
      } catch (error) {
        if (showServerFieldErrors(formApi, error))
          focusFirstInvalid(formRef.current)
        else setRefusal(error)
      }
    },
    onSubmitInvalid: () => {
      focusFirstInvalid(formRef.current)
    },
  })

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <FieldGroup>
        {refusal !== null && (
          <ProblemAlert title={t.auth.failed} error={refusal} />
        )}
        <form.AppField
          name="login"
          validators={{ onChange: required, onBlur: required }}
        >
          {(field) => (
            <field.TextField
              label={t.auth.login}
              autoComplete="username"
              required
            />
          )}
        </form.AppField>
        <form.AppField
          name="password"
          validators={{ onChange: required, onBlur: required }}
        >
          {(field) => (
            <field.TextField
              label={t.auth.password}
              type="password"
              autoComplete="current-password"
              required
            />
          )}
        </form.AppField>
        <form.AppForm>
          <form.SubmitButton label={t.auth.submit} />
        </form.AppForm>
      </FieldGroup>
    </form>
  )
}
