"use client"

import * as React from "react"

import { formatDuration } from "@/lib/format"
import { cn } from "@/lib/utils"
import { IconButton } from "@/components/ui/icon-button"
import { Slider } from "@/components/ui/slider"
import { ExitFullscreenIcon, FullscreenIcon } from "@/components/icons/fullscreen-icon"
import { PauseIcon } from "@/components/icons/pause-icon"
import { PlayIcon } from "@/components/icons/play-icon"
import { VolumeIcon } from "@/components/icons/volume-icon"
import { VolumeOffIcon } from "@/components/icons/volume-off-icon"

// `onVolumeChange` is redeclared below (a volume value, not the media event of the same name).
type PlayerControlsProps = Omit<React.ComponentProps<"div">, "children" | "onVolumeChange"> & {
  paused: boolean
  muted: boolean
  /** 0..1, as `HTMLMediaElement.volume`. */
  volume: number
  /** Seconds. */
  currentTime: number
  /** Seconds; 0 while the metadata is not loaded. */
  duration: number
  /** Seconds already buffered from the start (end of the buffered range that covers `currentTime`). */
  buffered: number
  fullscreen: boolean
  /** Disables every control (e.g. before the metadata loads). */
  disabled?: boolean
  onTogglePlay: () => void
  onToggleMute: () => void
  onVolumeChange: (volume: number) => void
  onSeek: (time: number) => void
  onToggleFullscreen: () => void
}

function clock(seconds: number): string {
  return formatDuration(seconds) ?? "0:00"
}

/**
 * Bottom bar of the watch page player (watch-page/TD-05): only the capability controls —
 * play/pause, volume (mute + slider), seek bar with buffer, current time / duration and full
 * screen (Revisions 2026-10-19: the extra controls of the Figma frame are not rendered).
 * Controlled: the media state comes from `VideoPlayer`; no I/O happens here.
 */
function PlayerControls({
  paused,
  muted,
  volume,
  currentTime,
  duration,
  buffered,
  fullscreen,
  disabled = false,
  onTogglePlay,
  onToggleMute,
  onVolumeChange,
  onSeek,
  onToggleFullscreen,
  className,
  ...props
}: PlayerControlsProps) {
  const seekable = !disabled && duration > 0
  const bufferedPercent = duration > 0 ? Math.min(100, (buffered / duration) * 100) : 0
  const volumePercent = muted ? 0 : Math.round(volume * 100)

  return (
    <div
      data-slot="player-controls"
      className={cn(
        "flex flex-col gap-2 bg-linear-to-t from-overlay to-transparent px-4 pt-8 pb-3 text-neutral-100",
        className
      )}
      {...props}
    >
      <div className="relative flex items-center">
        <div
          aria-hidden="true"
          data-slot="player-buffered"
          className="pointer-events-none absolute inset-x-0 h-1 overflow-hidden rounded-full"
        >
          <div className="h-full bg-neutral-100/40" style={{ width: `${bufferedPercent}%` }} />
        </div>
        <Slider
          value={[Math.min(currentTime, duration)]}
          min={0}
          max={duration > 0 ? duration : 1}
          step={1}
          variant="overlay"
          disabled={!seekable}
          thumbLabel="Seek"
          thumbValueText={`${clock(currentTime)} of ${clock(duration)}`}
          onValueChange={([time]) => onSeek(time)}
        />
      </div>

      <div className="flex items-center gap-2">
        <IconButton
          aria-label={paused ? "Play" : "Pause"}
          disabled={disabled}
          onClick={onTogglePlay}
          className="text-neutral-100 hover:bg-transparent"
        >
          {paused ? <PlayIcon className="size-4" /> : <PauseIcon />}
        </IconButton>

        <div className="group/volume flex items-center gap-2">
          <IconButton
            aria-label={muted ? "Unmute" : "Mute"}
            disabled={disabled}
            onClick={onToggleMute}
            className="text-neutral-100 hover:bg-transparent"
          >
            {muted ? <VolumeOffIcon /> : <VolumeIcon />}
          </IconButton>
          <Slider
            value={[volumePercent]}
            min={0}
            max={100}
            step={5}
            variant="overlay"
            disabled={disabled}
            thumbLabel="Volume"
            thumbValueText={`${volumePercent}%`}
            onValueChange={([value]) => onVolumeChange(value / 100)}
            className="w-0 opacity-0 transition-all data-disabled:opacity-0 group-focus-within/volume:w-20 group-focus-within/volume:opacity-100 group-hover/volume:w-20 group-hover/volume:opacity-100"
          />
        </div>

        {/* Not `text-overlay`: that name is also the `--color-overlay` token and would win over the white. */}
        <span data-slot="player-time" className="text-body-lg text-neutral-100 tabular-nums">
          {clock(currentTime)} / {clock(duration)}
        </span>

        <IconButton
          aria-label={fullscreen ? "Exit full screen" : "Enter full screen"}
          disabled={disabled}
          onClick={onToggleFullscreen}
          className="ml-auto text-neutral-100 hover:bg-transparent"
        >
          {fullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
        </IconButton>
      </div>
    </div>
  )
}

export { PlayerControls }
export type { PlayerControlsProps }
