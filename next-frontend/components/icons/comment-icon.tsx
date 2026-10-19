import * as React from "react"
import { cn } from "@/lib/utils"

// Figma VideoList comments metric (I158:3096;108:349), 12×12 solid speech bubble.
function CommentIcon({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 12 12"
      fill="currentColor"
      aria-hidden="true"
      className={cn(className)}
      {...props}
    >
      <path d="M12 5.625C12 8.31797 9.31406 10.5 6 10.5C5.13047 10.5 4.30547 10.35 3.56016 10.0805C3.28125 10.2844 2.82656 10.5633 2.2875 10.7977C1.725 11.0414 1.04766 11.25 0.375 11.25C0.222656 11.25 0.0867188 11.1586 0.028125 11.018C-0.0304687 10.8773 0.00234374 10.718 0.107812 10.6102L0.114844 10.6031C0.121875 10.5961 0.13125 10.5867 0.145312 10.5703C0.171094 10.5422 0.210938 10.4977 0.260156 10.4367C0.35625 10.3195 0.485156 10.1461 0.616406 9.93047C0.850781 9.54141 1.07344 9.03047 1.11797 8.45625C0.414844 7.65937 0 6.68203 0 5.625C0 2.93203 2.68594 0.75 6 0.75C9.31406 0.75 12 2.93203 12 5.625Z" />
    </svg>
  )
}

export { CommentIcon }
