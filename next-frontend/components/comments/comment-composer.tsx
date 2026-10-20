"use client"

import * as React from "react"
import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { loginHref } from "@/lib/auth/return-to"
import { cn } from "@/lib/utils"
import { FieldError } from "@/components/auth/field-error"
import { ChannelAvatar } from "@/components/channel/channel-avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

/** Mirror of `CreateCommentDto`/`UpdateCommentDto` (§API Contracts → Validation Rules; TD-07). */
const COMMENT_MAX_LENGTH = 2000

const commentSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Write something before posting")
    .max(COMMENT_MAX_LENGTH, `Comments can have at most ${COMMENT_MAX_LENGTH} characters`),
})

type CommentFormValues = z.infer<typeof commentSchema>

type CommentComposerProps = {
  isLoggedIn: boolean
  /** Where the anonymous visitor returns after login (social-interactions/TD-10). */
  returnTo: string
  /** Receives the trimmed text; throw an `Error` to show its message under the field. */
  onSubmit: (text: string) => Promise<void>
  /** Channel name of the signed-in user, for the initials avatar. */
  avatarName?: string
  /** Pre-filled text — the comment being edited, or "@nickname " for a reply to a reply. */
  initialValue?: string
  label?: string
  placeholder?: string
  submitLabel?: string
  /** Reply/edit composers open with the buttons visible; the main one waits for focus. */
  startExpanded?: boolean
  onCancel?: () => void
  className?: string
}

/**
 * Figma Video show "Add a comment…" (152:2219): user avatar + auto-growing field; "Cancel" and
 * "Comment" appear on focus (not drawn — phase 06 resolution OQ-2). The same component posts a
 * comment, a reply and an edit — the parent decides what `onSubmit` calls. Anonymous visitors get a
 * "Sign in to comment" link instead of the field.
 */
function CommentComposer({
  isLoggedIn,
  returnTo,
  onSubmit,
  avatarName,
  initialValue = "",
  label = "Add a comment",
  placeholder = "Add a comment…",
  submitLabel = "Comment",
  startExpanded = false,
  onCancel,
  className,
}: CommentComposerProps) {
  const fieldId = React.useId()
  const [expanded, setExpanded] = React.useState(startExpanded)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    trigger,
    formState: { errors, isValid, isSubmitting },
  } = useForm<CommentFormValues>({
    resolver: zodResolver(commentSchema),
    mode: "onChange",
    defaultValues: { text: initialValue },
  })

  // A pre-filled field (edit, or "@nickname " in a reply) is validated up front so "Save"/"Reply"
  // starts enabled — with mode "onChange" react-hook-form only computes isValid after a change.
  React.useEffect(() => {
    if (initialValue) void trigger("text")
  }, [initialValue, trigger])

  if (!isLoggedIn) {
    return (
      <p data-slot="comment-composer" data-state="anonymous" className={cn("text-body-md", className)}>
        <Link
          href={loginHref(returnTo)}
          className="text-link hover:underline"
        >
          Sign in to comment
        </Link>
      </p>
    )
  }

  const submit = handleSubmit(async ({ text }) => {
    try {
      await onSubmit(text)
      reset({ text: "" })
      setExpanded(startExpanded)
    } catch (error) {
      setError("text", {
        message: error instanceof Error && error.message ? error.message : "Could not post the comment",
      })
    }
  })

  function cancel() {
    reset({ text: initialValue })
    setExpanded(startExpanded)
    onCancel?.()
  }

  const errorId = `${fieldId}-error`
  return (
    <form
      data-slot="comment-composer"
      data-state={expanded ? "expanded" : "collapsed"}
      noValidate
      onSubmit={submit}
      className={cn("flex w-full gap-4", className)}
    >
      {avatarName ? <ChannelAvatar name={avatarName} size="md" className="shrink-0" /> : null}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <label htmlFor={fieldId} className="sr-only">
          {label}
        </label>
        <Textarea
          id={fieldId}
          className="min-h-0 rounded-none border-0 border-b bg-transparent px-0 py-1 focus-visible:ring-0"
          rows={1}
          placeholder={placeholder}
          aria-invalid={errors.text ? true : undefined}
          aria-describedby={errors.text ? errorId : undefined}
          onFocus={() => setExpanded(true)}
          {...register("text")}
        />
        <FieldError id={errorId} message={errors.text?.message} />
        {expanded ? (
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={cancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || isSubmitting}>
              {submitLabel}
            </Button>
          </div>
        ) : null}
      </div>
    </form>
  )
}

export { CommentComposer, COMMENT_MAX_LENGTH, commentSchema }
export type { CommentComposerProps }
