import { AppHeader } from "@/components/layout/app-header"

// Application routes (everything outside the `(auth)` group) share the
// session-aware header. Auth screens keep their own full-card layout.
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <AppHeader />
      {children}
    </>
  )
}
