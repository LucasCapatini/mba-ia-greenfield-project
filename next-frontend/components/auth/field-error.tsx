import { cn } from "@/lib/utils"

function FieldError({
  message,
  className,
  ...props
}: Omit<React.ComponentProps<"p">, "children"> & { message?: string }) {
  if (!message) return null
  return (
    <p className={cn("text-caption text-destructive", className)} {...props}>
      {message}
    </p>
  )
}

export { FieldError }
