---
kind: drift-report
phase: phase-05-watch-page
plan_mtime: "2026-10-20T00:08:35Z"
---

# phase-05-watch-page — Drift Report

## Screen: video-show — audited at SI-05.11.0 (2026-10-19)

**Quick scan:** 11 alinhado · 1 drift menor · 7 drift relevante · 0 ausente

- AppHeader (`app-header.tsx`) → `drift relevante` (exception)
- Avatar (`avatar.tsx`) → `alinhado`
- VideoPlayer (`video-player.tsx`) → `alinhado`
- PlayerControls (`player-controls.tsx`) → `drift relevante`
- IconButton (`icon-button.tsx`) → `drift relevante`
- PauseIcon (`pause-icon.tsx`) → `alinhado`
- Slider (`slider.tsx`) → `drift relevante`
- VolumeIcon (`volume-icon.tsx`) → `alinhado`
- VolumeOffIcon (`volume-off-icon.tsx`) → `alinhado`
- FullscreenIcon (`fullscreen-icon.tsx`) → `alinhado`
- VideoChannelLink (`video-channel-link.tsx`) → `alinhado`
- CopyLinkButton (`copy-link-button.tsx`) → `drift relevante`
- ShareIcon (`share-icon.tsx`) → `alinhado`
- DropdownMenu (`dropdown-menu.tsx`) → `alinhado`
- DownloadMenuItem (`download-menu-item.tsx`) → `alinhado`
- DownloadIcon (`download-icon.tsx`) → `alinhado`
- VideoDescription (`video-description.tsx`) → `drift menor` (3 changes)
- RelatedVideos (`related-videos.tsx`) → `drift relevante`
- VideoCard (`video-card.tsx`) → `drift relevante` (2 changes)

### next-frontend/components/layout/app-header.tsx — AppHeader

- **Status:** drift relevante
- **Decision:** `exception`
  - reason: the frame's hamburger, search, microphone, "+" and account avatar menu belong to the Phase 07 navbar (inventory decision); Phase 05 keeps the current session-aware header (anonymous → Entrar / Criar conta)
- **Prior:** _(none)_

### next-frontend/components/ui/avatar.tsx — Avatar

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/watch/video-player.tsx — VideoPlayer

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/watch/player-controls.tsx — PlayerControls

- **Status:** drift relevante
- **Decision:** `auto-Edit`
  - retune slider: default — `<Slider …>` → `<Slider variant="overlay" …>` on the seek and volume sliders (white track, played range and thumb over the dark player gradient)
- **Prior:** _(none)_

### next-frontend/components/ui/icon-button.tsx — IconButton

- **Status:** drift relevante
- **Decision:** `auto-Edit`
  - +variant 'secondary' from Figma demand — `bg-secondary text-secondary-foreground border border-border rounded-[var(--radius-full)]` (circular "⋮" trigger beside Share)
- **Prior:** _(none)_

### next-frontend/components/icons/pause-icon.tsx — PauseIcon

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/ui/slider.tsx — Slider

- **Status:** drift relevante
- **Decision:** `auto-Edit`
  - +variant 'overlay' from Figma demand — track `bg-neutral-100/30`, range `bg-neutral-100`, thumb `bg-neutral-100 border-neutral-100` (the default track `bg-muted` + range `bg-primary` is invisible on the player)
- **Prior:** _(none)_

### next-frontend/components/icons/volume-icon.tsx — VolumeIcon

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/icons/volume-off-icon.tsx — VolumeOffIcon

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/icons/fullscreen-icon.tsx — FullscreenIcon

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/watch/video-channel-link.tsx — VideoChannelLink

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/studio/copy-link-button.tsx — CopyLinkButton

- **Status:** drift relevante
- **Decision:** `auto-Edit`
  - +variant 'pill' from Figma demand — `Button` `variant="secondary"` with `rounded-[var(--radius-full)]`, `ShareIcon` + label "Share"; the default icon-only variant and the "Copied" / "Couldn't copy" status span stay as they are
- **Prior:** _(none)_

### next-frontend/components/icons/share-icon.tsx — ShareIcon

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/ui/dropdown-menu.tsx — DropdownMenu

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/watch/download-menu-item.tsx — DownloadMenuItem

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/icons/download-icon.tsx — DownloadIcon

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/watch/video-description.tsx — VideoDescription

- **Status:** drift menor
- **Decision:** `auto-Edit`
  - retune background: default — `bg-muted` → `border border-border bg-background`
  - retune meta text: default — `text-label-lg` → `text-body-lg`
  - retune body text: default — `text-body-md` → `text-body-lg`
- **Prior:** _(none)_

### next-frontend/components/watch/related-videos.tsx — RelatedVideos

- **Status:** drift relevante
- **Decision:** `auto-Edit`
  - retune card: default — `<VideoCard video={item} …>` → `<VideoCard variant="horizontal" video={item} …>`
- **Prior:** _(none)_

### next-frontend/components/videos/video-card.tsx — VideoCard

- **Status:** drift relevante
- **Decision:** `auto-Edit`
  - +variant 'horizontal' from Figma demand — `flex-row gap-3`: `VideoThumbnail` (`w-42`, radius-2, `durationSeconds`) on the left + text column (title `line-clamp-2 text-body-md`, channel and "N views • time" `text-caption text-muted-foreground`); the existing vertical layout becomes the default variant, unchanged
  - +prop 'duration_seconds' from Figma demand — optional `duration_seconds?: number | null` on `VideoCardData` (already present in `VideoCardItem`), shown only by the horizontal variant
- **Prior:** _(none)_
