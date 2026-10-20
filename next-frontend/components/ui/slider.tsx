"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slider as SliderPrimitive } from "radix-ui"

// `overlay`: white track, range and thumb over dark media (the watch page player bar).
const sliderTrackVariants = cva(
  [
    "relative grow overflow-hidden rounded-full",
    "data-horizontal:h-1 data-horizontal:w-full data-vertical:h-full data-vertical:w-1",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-muted",
        overlay: "bg-neutral-100/30",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

const sliderRangeVariants = cva(
  "absolute select-none data-horizontal:h-full data-vertical:w-full",
  {
    variants: {
      variant: {
        default: "bg-primary",
        overlay: "bg-neutral-100",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

const sliderThumbVariants = cva(
  [
    "relative block size-3 shrink-0 rounded-full border ring-ring/50 transition-[color,box-shadow] select-none after:absolute after:-inset-2",
    "hover:ring-3 focus-visible:ring-3 focus-visible:outline-hidden active:ring-3 disabled:pointer-events-none disabled:opacity-50",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "border-ring bg-white",
        overlay: "border-neutral-100 bg-neutral-100",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  thumbLabel,
  thumbValueText,
  variant = "default",
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> &
  VariantProps<typeof sliderTrackVariants> & {
  /** Accessible name of each thumb (the element with role="slider"). */
  thumbLabel?: string
  /** Human-readable value announced for each thumb (aria-valuetext), e.g. "0:20 of 4:56". */
  thumbValueText?: string
}) {
  const _values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min, max],
    [value, defaultValue, min, max]
  )

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      data-variant={variant}
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={sliderTrackVariants({ variant })}
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className={sliderRangeVariants({ variant })}
        />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          aria-label={thumbLabel}
          aria-valuetext={thumbValueText}
          className={sliderThumbVariants({ variant })}
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider, sliderTrackVariants, sliderRangeVariants, sliderThumbVariants }
