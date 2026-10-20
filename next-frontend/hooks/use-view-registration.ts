"use client";

import { useEffect, type RefObject } from "react";

/** Seconds of accumulated playback that count as a view (watch-page/TD-01). */
export const VIEW_THRESHOLD_SECONDS = 10;
/** `timeupdate` deltas above this are jumps (seek, tab throttling), not playback. */
const MAX_PLAYBACK_DELTA_SECONDS = 1.5;
/** On `ended` a shorter video counts when playback covered all but this last tick. */
const END_TOLERANCE_SECONDS = 1;

/**
 * Registers one view per mount (and per `publicId`) through the BFF (watch-page/TD-01): playback
 * time is accumulated from `timeupdate` deltas — seeks and jumps add nothing — and once it reaches
 * `min(10 s, duration)`, or the video `ended` after being watched to the end, it calls
 * `POST /api/videos/{publicId}/views` once. Failures are silent: they never touch playback.
 */
export function useViewRegistration(
  videoRef: RefObject<HTMLVideoElement | null>,
  publicId: string,
  enabled: boolean
): void {
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !enabled) {
      return;
    }
    let watched = 0;
    // Starts at the mount position: the first tick from there is already playback.
    let last: number | null = video.currentTime;
    let sent = false;

    const threshold = () =>
      Number.isFinite(video.duration) && video.duration > 0
        ? Math.min(VIEW_THRESHOLD_SECONDS, video.duration)
        : VIEW_THRESHOLD_SECONDS;

    const register = () => {
      if (sent) {
        return;
      }
      sent = true;
      fetch(`/api/videos/${encodeURIComponent(publicId)}/views`, { method: "POST" }).catch(
        () => {
          // Silent: a failed registration never interrupts playback.
        }
      );
    };

    const onTimeUpdate = () => {
      const now = video.currentTime;
      if (last !== null && !video.seeking) {
        const delta = now - last;
        if (delta > 0 && delta <= MAX_PLAYBACK_DELTA_SECONDS) {
          watched += delta;
        }
      }
      last = now;
      if (watched >= threshold()) {
        register();
      }
    };
    const onSeeking = () => {
      last = null;
    };
    const onSeeked = () => {
      last = video.currentTime;
    };
    const onEnded = () => {
      if (watched >= threshold() - END_TOLERANCE_SECONDS) {
        register();
      }
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("seeking", onSeeking);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("ended", onEnded);
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("seeking", onSeeking);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("ended", onEnded);
    };
  }, [videoRef, publicId, enabled]);
}
