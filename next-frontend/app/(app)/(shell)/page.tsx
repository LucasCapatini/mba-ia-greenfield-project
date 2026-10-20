import { BrandLogo } from "@/components/auth/brand-logo"

// Placeholder home — replaced by the real feed in Phase 07 (project-plan.md).
// Exists so the application layout (header + logout) has a routable surface.
export default function Home() {
  return (
    <main
      data-slot="home-placeholder"
      className="flex flex-1 flex-col items-center justify-center gap-4 bg-background px-6 py-16 text-center"
    >
      <BrandLogo size="lg" />
      <h1 className="text-h1 text-foreground">StreamTube</h1>
      <p className="text-body-md text-muted-foreground max-w-md">
        Plataforma de compartilhamento de vídeos. O feed de vídeos chega na
        Fase 07; por enquanto, entre ou crie sua conta pelo menu acima.
      </p>
    </main>
  )
}
