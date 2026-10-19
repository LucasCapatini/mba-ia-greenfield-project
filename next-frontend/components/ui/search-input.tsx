"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { SearchIcon } from "@/components/icons/search-icon"
import { XIcon } from "@/components/icons/x-icon"

// The placeholder is not an accessible name, so a label is mandatory.
type SearchInputProps = Omit<
  React.ComponentProps<"input">,
  "type" | "value" | "defaultValue" | "aria-label"
> & {
  "aria-label": string
  /** Controlled value. Omit it (and use `defaultValue`) for an uncontrolled field. */
  value?: string
  defaultValue?: string
  /** Called with the new text on every edit and with "" when the field is cleared. */
  onValueChange?: (value: string) => void
  /** Called after the clear button empties the field. */
  onClear?: () => void
}

/**
 * Figma "Search" (158:4007): pill field (h-11, pl-5, bg-secondary, border-border) with a
 * 72×44 trailing slot. The slot shows the magnifier while the field is empty and a
 * "Clear search" button once it has text.
 */
function SearchInput({
  className,
  value,
  defaultValue = "",
  onValueChange,
  onChange,
  onClear,
  disabled,
  ref,
  ...props
}: SearchInputProps) {
  const isControlled = value !== undefined
  const [innerValue, setInnerValue] = React.useState(defaultValue)
  const currentValue = isControlled ? value : innerValue
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (!isControlled) setInnerValue(event.target.value)
    onChange?.(event)
    onValueChange?.(event.target.value)
  }

  function handleClear() {
    if (!isControlled) setInnerValue("")
    onValueChange?.("")
    onClear?.()
    inputRef.current?.focus()
  }

  return (
    <div
      data-slot="search-input"
      data-disabled={disabled ? "true" : undefined}
      className={cn(
        "flex h-11 w-full items-center rounded-[var(--radius-full)] border border-border bg-secondary pl-5",
        "transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        "data-[disabled=true]:opacity-50",
        className
      )}
    >
      <Input
        ref={inputRef}
        type="search"
        value={currentValue}
        onChange={handleChange}
        disabled={disabled}
        className={cn(
          "h-full min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 py-0 text-body-md",
          "placeholder:text-muted-foreground focus-visible:ring-0 disabled:opacity-100",
          "[&::-webkit-search-cancel-button]:appearance-none"
        )}
        {...props}
      />
      <div className="flex h-11 w-18 shrink-0 items-center justify-center text-foreground">
        {currentValue ? (
          <button
            type="button"
            aria-label="Clear search"
            data-slot="search-input-clear"
            onClick={handleClear}
            disabled={disabled}
            className="inline-flex size-8 items-center justify-center rounded-[var(--radius-full)] outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none"
          >
            <XIcon className="size-5" />
          </button>
        ) : (
          <SearchIcon className="size-6" />
        )}
      </div>
    </div>
  )
}

export { SearchInput }
export type { SearchInputProps }
