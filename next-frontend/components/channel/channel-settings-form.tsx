"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/format"
import type { ApiErrorEnvelope, Channel, UpdateChannelInput } from "@/lib/api/contracts"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AlarmIcon } from "@/components/icons/alarm-icon"
import { FieldError } from "@/components/auth/field-error"

// Client-side mirror of `UpdateChannelDto` (video-channel-management/TD-08; phase-02-auth/TD-10):
// the handle has no `@` (only a visual prefix), lowercase letters, digits and `_`, 3..50, and is not
// a reserved route segment; the name is 1..50 after trim; the description up to 1000.
export const RESERVED_NICKNAMES = [
  "me",
  "admin",
  "channel",
  "channels",
  "studio",
  "api",
  "watch",
  "login",
  "signup",
] as const
export const NAME_MAX = 50
export const DESCRIPTION_MAX = 1000

const channelSchema = z.object({
  nickname: z
    .string()
    .regex(/^[a-z0-9_]{3,50}$/, "Use 3–50 lowercase letters, numbers or underscores")
    .refine(
      (value) => !(RESERVED_NICKNAMES as readonly string[]).includes(value),
      "This handle is reserved"
    ),
  name: z
    .string()
    .trim()
    .min(1, "Display name is required")
    .max(NAME_MAX, `Display name must be ${NAME_MAX} characters or fewer`),
  description: z
    .string()
    .max(DESCRIPTION_MAX, `Description must be ${DESCRIPTION_MAX} characters or fewer`),
})

type ChannelFormValues = z.infer<typeof channelSchema>

const FIELDS = ["nickname", "name", "description"] as const

function valuesOf(channel: Pick<Channel, "nickname" | "name" | "description">): ChannelFormValues {
  return {
    nickname: channel.nickname,
    name: channel.name,
    description: channel.description ?? "",
  }
}

function messageOf(envelope: ApiErrorEnvelope | null, fallback: string): string {
  if (!envelope) return fallback
  return Array.isArray(envelope.message) ? envelope.message.join("; ") : envelope.message
}

type ChannelSettingsFormProps = Omit<React.ComponentProps<"form">, "children" | "onSubmit"> & {
  channel: Pick<Channel, "nickname" | "name" | "description" | "updated_at">
}

/**
 * Figma "Canal" (154:1512): "Basic Information" with the handle (fixed visual `@` prefix) and the
 * display name side by side (20px apart, helper texts below), "Description", and the footer with
 * "Last updated" and Cancel / Save Changes (154:1683, px-32 py-16).
 *
 * Save → `PATCH /api/channel` with only the changed fields → toast "Channel updated" →
 * `router.refresh()` (the BFF already rewrote `channelSlug` in the session, TD-08). Fields validate
 * as they change; Save stays disabled until the form is dirty and valid.
 */
function ChannelSettingsForm({ channel, className, ...props }: ChannelSettingsFormProps) {
  const router = useRouter()
  const ids = React.useId()
  const handleId = `${ids}-handle`
  const nameId = `${ids}-name`
  const descriptionId = `${ids}-description`

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, dirtyFields, isDirty, isValid, isSubmitting },
  } = useForm<ChannelFormValues>({
    resolver: zodResolver(channelSchema),
    defaultValues: valuesOf(channel),
    mode: "onChange",
  })
  const descriptionLength = useWatch({ control, name: "description" })?.length ?? 0

  async function save(values: ChannelFormValues) {
    const body: UpdateChannelInput = {}
    if (dirtyFields.nickname) body.nickname = values.nickname
    if (dirtyFields.name) body.name = values.name
    if (dirtyFields.description) {
      body.description = values.description.trim() === "" ? null : values.description
    }

    let response: Response
    try {
      response = await fetch("/api/channel", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    } catch {
      toast.error("Could not save the changes. Check your connection and try again.")
      return
    }

    if (response.status === 401) {
      router.push("/login?returnTo=/studio/channel")
      return
    }
    if (!response.ok) {
      const envelope = (await response.json().catch(() => null)) as ApiErrorEnvelope | null
      const message = messageOf(envelope, "Could not save the changes")
      if (envelope?.error === "NICKNAME_TAKEN") {
        setError("nickname", { message: "This handle is already taken" })
      } else if (envelope?.error === "VALIDATION_ERROR") {
        const field = FIELDS.find((name) => new RegExp(`\\b${name}\\b`, "i").test(message))
        setError(field ?? "root.serverError", { message })
      } else {
        toast.error(message)
      }
      return
    }

    const updated = (await response.json()) as Channel
    toast.success("Channel updated")
    reset(valuesOf(updated))
    router.refresh()
  }

  return (
    <Card data-slot="channel-settings-card" className="w-full gap-0 overflow-hidden py-0">
      <form
        data-slot="channel-settings-form"
        noValidate
        onSubmit={handleSubmit(save)}
        className={cn("flex flex-col", className)}
        {...props}
      >
        <div className="flex w-full flex-col gap-4 px-8 pt-8 pb-8">
          <h2 className="text-h2 text-foreground">Basic Information</h2>
          {errors.root?.serverError?.message ? (
            <p role="alert" className="text-label-md text-destructive">
              {errors.root.serverError.message}
            </p>
          ) : null}
          <div className="flex w-full items-start gap-5">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Label htmlFor={handleId}>Channel handle</Label>
              <div className="relative w-full">
                <span
                  aria-hidden="true"
                  data-slot="handle-prefix"
                  className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-body-lg text-muted-foreground"
                >
                  @
                </span>
                <Input
                  id={handleId}
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={errors.nickname ? true : undefined}
                  aria-describedby={`${handleId}-help${errors.nickname ? ` ${handleId}-error` : ""}`}
                  className="pl-8"
                  {...register("nickname")}
                />
              </div>
              <FieldError id={`${handleId}-error`} className="px-4" message={errors.nickname?.message} />
              <p id={`${handleId}-help`} className="px-4 pt-1 text-helper text-muted-foreground">
                Your unique identifier on StreamTube
              </p>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Label htmlFor={nameId}>Display name</Label>
              <Input
                id={nameId}
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={`${nameId}-help${errors.name ? ` ${nameId}-error` : ""}`}
                {...register("name")}
              />
              <FieldError id={`${nameId}-error`} className="px-4" message={errors.name?.message} />
              <p id={`${nameId}-help`} className="px-4 pt-1 text-helper text-muted-foreground">
                The name that appears on your channel
              </p>
            </div>
          </div>

          <h2 id={`${descriptionId}-label`} className="text-h2 text-foreground">
            Description
          </h2>
          <Textarea
            id={descriptionId}
            aria-labelledby={`${descriptionId}-label`}
            aria-invalid={errors.description ? true : undefined}
            aria-describedby={`${descriptionId}-counter${errors.description ? ` ${descriptionId}-error` : ""}`}
            className="h-36 resize-none [field-sizing:fixed]"
            {...register("description")}
          />
          <div className="flex justify-between gap-4">
            <FieldError id={`${descriptionId}-error`} message={errors.description?.message} />
            <p
              id={`${descriptionId}-counter`}
              className={cn(
                "ml-auto text-caption text-muted-foreground",
                descriptionLength > DESCRIPTION_MAX && "text-destructive"
              )}
            >
              {descriptionLength}/{DESCRIPTION_MAX}
            </p>
          </div>
        </div>

        <div className="flex w-full items-center justify-between gap-4 border-t border-border px-8 py-4">
          <p className="flex items-center gap-1 text-caption text-muted-foreground">
            <AlarmIcon className="size-3" />
            Last updated: {formatDate(channel.updated_at)}
          </p>
          <div className="flex items-center gap-6">
            <Button type="button" variant="outline" onClick={() => router.push("/studio/videos")}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="min-w-42"
              disabled={!isDirty || !isValid || isSubmitting}
              data-loading={isSubmitting ? "true" : undefined}
            >
              {isSubmitting ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  )
}

export { ChannelSettingsForm }
