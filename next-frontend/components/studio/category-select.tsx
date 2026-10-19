"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/**
 * Subset of `CategoryResponse` (`GET /categories`) the select needs. Swap for a `Pick` of the
 * generated alias from `@/lib/api/contracts` once the OpenAPI chain exports it (SI-04.10).
 */
type CategoryOption = { id: string; name: string }

// Radix Select reserves "" for "no value", so clearing the category uses a sentinel item.
const NO_CATEGORY = "__none__"

type CategorySelectProps = {
  categories: CategoryOption[]
  /** Selected category id, or null for none. */
  value: string | null
  onValueChange: (value: string | null) => void
  id?: string
  /** Accessible label; visually hidden because the SectionHeader titles the section. */
  label?: string
  placeholder?: string
  disabled?: boolean
  name?: string
  "aria-invalid"?: boolean
  "aria-describedby"?: string
  className?: string
}

/**
 * Figma "Category select" (2096:2238): 36px trigger, input-background fill, border-border,
 * radius-1-5, up to 448px wide; options come from `GET /categories` through props.
 */
function CategorySelect({
  categories,
  value,
  onValueChange,
  id = "category",
  label = "Category",
  placeholder = "Select a category",
  disabled,
  name,
  className,
  ...aria
}: CategorySelectProps) {
  return (
    <div data-slot="category-select" className={cn("flex w-full max-w-md flex-col", className)}>
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <Select
        value={value ?? ""}
        onValueChange={(next) => onValueChange(next === NO_CATEGORY ? null : next)}
        disabled={disabled}
        name={name}
      >
        <SelectTrigger
          id={id}
          className="h-9 w-full rounded-[var(--radius-1-5)] border-border bg-input-background px-3 text-body-md text-foreground data-[size=default]:h-9"
          {...aria}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectItem value={NO_CATEGORY}>No category</SelectItem>
          {categories.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              {category.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export { CategorySelect }
export type { CategoryOption, CategorySelectProps }
