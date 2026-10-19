/** Worker codes written to `videos.processing_error` (nestjs-project `videos.constants.ts`). */
const PROCESSING_ERROR_MESSAGES: Record<string, string> = {
  UNSUPPORTED_FORMAT: "the file is not a supported video format. Upload an MP4 or WebM file.",
  PROBE_FAILED: "we couldn't read this video file. Try exporting it again.",
  THUMBNAIL_FAILED: "we couldn't generate a thumbnail for this video.",
  OBJECT_MISSING: "the uploaded file was not found. Upload it again.",
}

/** Human-readable, lower-case sentence for a worker error code (meant to follow "…failed: "). */
export function describeProcessingError(code: string | null): string {
  if (!code) return "an unknown error occurred."
  return PROCESSING_ERROR_MESSAGES[code] ?? `an unexpected error occurred (${code}).`
}
