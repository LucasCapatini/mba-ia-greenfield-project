"use client";

import { useEffect, useState, type RefObject } from "react";

export type MediaState = {
  paused: boolean;
  /** Seconds. */
  currentTime: number;
  /** Seconds; 0 until the metadata loads (or for a stream without a finite duration). */
  duration: number;
  /** End (seconds) of the buffered range that covers `currentTime`; 0 when none does. */
  buffered: number;
  /** 0..1. */
  volume: number;
  muted: boolean;
  /** `waiting` fired and playback has not resumed yet (buffering). */
  waiting: boolean;
  /** The player container is the document's fullscreen element. */
  fullscreen: boolean;
};

const MEDIA_EVENTS = [
  "play",
  "pause",
  "timeupdate",
  "progress",
  "durationchange",
  "volumechange",
  "waiting",
  "playing",
  "ended",
  "loadedmetadata",
] as const;

const INITIAL: MediaState = {
  paused: true,
  currentTime: 0,
  duration: 0,
  buffered: 0,
  volume: 1,
  muted: false,
  waiting: false,
  fullscreen: false,
};

function bufferedEnd(video: HTMLVideoElement): number {
  const ranges = video.buffered;
  for (let i = 0; i < ranges.length; i++) {
    if (ranges.start(i) <= video.currentTime && video.currentTime <= ranges.end(i)) {
      return ranges.end(i);
    }
  }
  return 0;
}

/**
 * Snapshot of a native `<video>` for the custom controls (watch-page/TD-05): re-read on each
 * media event and on `fullscreenchange`. `waiting` turns on with `waiting` and off as soon as
 * playback resumes, pauses or ends.
 */
export function useMediaState(
  videoRef: RefObject<HTMLVideoElement | null>,
  containerRef: RefObject<HTMLElement | null>
): MediaState {
  const [state, setState] = useState<MediaState>(INITIAL);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    const read = (waiting: boolean): MediaState => ({
      paused: video.paused,
      currentTime: video.currentTime,
      duration: Number.isFinite(video.duration) ? video.duration : 0,
      buffered: bufferedEnd(video),
      volume: video.volume,
      muted: video.muted,
      waiting,
      fullscreen:
        document.fullscreenElement != null &&
        document.fullscreenElement === containerRef.current,
    });
    const onMediaEvent = (event: Event) => {
      setState((previous) => {
        if (event.type === "waiting") {
          return read(true);
        }
        const resumed = ["playing", "pause", "ended"].includes(event.type);
        return read(resumed ? false : previous.waiting);
      });
    };
    const onFullscreenChange = () => setState((previous) => read(previous.waiting));

    for (const type of MEDIA_EVENTS) {
      video.addEventListener(type, onMediaEvent);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    setState(read(false));
    return () => {
      for (const type of MEDIA_EVENTS) {
        video.removeEventListener(type, onMediaEvent);
      }
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [videoRef, containerRef]);

  return state;
}
