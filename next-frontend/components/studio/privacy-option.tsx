"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { LinkIcon } from "@/components/icons/link-icon"
import { PublicIcon } from "@/components/icons/public-icon"

type Visibility = "public" | "unlisted"

const VISIBILITY_OPTIONS: Array<{
  value: Visibility
  title: string
  description: string
  Icon: React.ComponentType<React.ComponentProps<"svg">>
}> = [
  { value: "public", title: "Public", description: "Everyone can see your video", Icon: PublicIcon },
  {
    value: "unlisted",
    title: "Unlisted",
    description: "Anyone with the video link can watch your video",
    Icon: LinkIcon,
  },
]

type PrivacyOptionProps = {
  /** Controlled value — wire `field.value` from react-hook-form. */
  value: Visibility
  /** Wire `field.onChange`; the choice only reaches the server on Save Changes. */
  onChange: (value: Visibility) => void
  onBlur?: () => void
  name?: string
  disabled?: boolean
  /** Fieldset legend; visually hidden because the SectionHeader titles the section. */
  legend?: string
  /** Points the group at the SectionHeader description. */
  "aria-describedby"?: string
  className?: string
}

/**
 * Figma "PrivacyOption" (156:2822 selected / 156:2821 idle): 576px cards, p-4, gap-4, radius-1;
 * selected = input-background fill + primary border + ringed radio, idle = card fill +
 * border-border. Each card is the label of its radio, so the whole card is clickable; arrow keys
 * move the selection (Radix radio group).
 */
function PrivacyOption({
  value,
  onChange,
  onBlur,
  name,
  disabled,
  legend = "Visibility",
  className,
  ...aria
}: PrivacyOptionProps) {
  const baseId = React.useId()
  const legendId = `${baseId}-legend`

  return (
    <fieldset
      data-slot="privacy-option"
      disabled={disabled}
      className={cn("m-0 min-w-0 border-0 p-0", className)}
    >
      <legend id={legendId} className="sr-only">
        {legend}
      </legend>
      <RadioGroup
        value={value}
        onValueChange={(next) => onChange(next as Visibility)}
        onBlur={onBlur}
        name={name}
        disabled={disabled}
        aria-labelledby={legendId}
        aria-describedby={aria["aria-describedby"]}
        className="flex w-full max-w-xl flex-col gap-2"
      >
        {VISIBILITY_OPTIONS.map(({ value: optionValue, title, description, Icon }) => {
          const itemId = `${baseId}-${optionValue}`
          const selected = value === optionValue
          return (
            <label
              key={optionValue}
              htmlFor={itemId}
              data-slot="privacy-option-card"
              data-state={selected ? "checked" : "unchecked"}
              className={cn(
                "flex cursor-pointer items-start gap-4 rounded-[var(--radius-1)] border p-4 transition-colors",
                selected ? "border-primary bg-input-background" : "border-border bg-card hover:bg-muted/40",
                disabled && "cursor-not-allowed opacity-50"
              )}
            >
              <RadioGroupItem
                id={itemId}
                value={optionValue}
                aria-labelledby={`${itemId}-title`}
                aria-describedby={`${itemId}-description`}
                className="mt-0.5 border-2 border-border data-checked:border-primary data-checked:bg-transparent [&_[data-slot=radio-group-indicator]_span]:bg-primary"
              />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-center gap-2">
                  <Icon className="size-3.5 shrink-0 text-foreground" />
                  <span id={`${itemId}-title`} className="text-body-md text-foreground">
                    {title}
                  </span>
                </span>
                <span id={`${itemId}-description`} className="text-caption text-muted-foreground">
                  {description}
                </span>
              </span>
            </label>
          )
        })}
      </RadioGroup>
    </fieldset>
  )
}

export { PrivacyOption, VISIBILITY_OPTIONS }
export type { PrivacyOptionProps, Visibility }
