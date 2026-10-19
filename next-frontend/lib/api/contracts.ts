/**
 * BFF ↔ Components contracts barrel.
 *
 * This file is the **only** module in the project authorized to import `paths`
 * from `./types.gen`. Every Route Handler and every Component consumes BFF
 * shapes via named aliases exported from here — never by indexing `paths`
 * directly elsewhere.
 *
 * Two alias forms by convention:
 *
 * 1. **Pass-through alias** — BFF returns the upstream NestJS shape as-is.
 *    The alias indexes `paths` for the route's success-content type:
 *
 *      export type Video =
 *        paths["/videos/{id}"]["get"]["responses"][200]["content"]["application/json"];
 *
 * 2. **Reshape alias** — BFF projects a subset or composed shape. The alias
 *    name is named-only (does NOT index `paths`), making reshapes greppable
 *    against the wire shape:
 *
 *      export type VideoCard = Pick<Video, "id" | "title" | "thumbnailUrl">;
 *
 * Feature SIs append aliases here as endpoints are wired through the BFF.
 * The barrel starts empty by design.
 */
import type { paths } from "./types.gen";

// ─── Auth ─────────────────────────────────────────────────────────────────────

// Request bodies
export type RegisterDto =
  paths["/auth/register"]["post"]["requestBody"]["content"]["application/json"];

export type LoginDto =
  paths["/auth/login"]["post"]["requestBody"]["content"]["application/json"];

export type ForgotPasswordDto =
  paths["/auth/forgot-password"]["post"]["requestBody"]["content"]["application/json"];

export type RefreshTokenDto =
  paths["/auth/refresh"]["post"]["requestBody"]["content"]["application/json"];

export type ResetPasswordDto =
  paths["/auth/reset-password"]["post"]["requestBody"]["content"]["application/json"];

export type ResendConfirmationDto =
  paths["/auth/resend-confirmation"]["post"]["requestBody"]["content"]["application/json"];

// Upstream success response bodies
export type RegisterResponse =
  paths["/auth/register"]["post"]["responses"][201]["content"]["application/json"];

// LoginTokenPair: upstream 200 body — BFF reads it to seal into the iron-session cookie;
// tokens never cross to the browser (per phase-02-auth-frontend/TD-02).
export type LoginTokenPair =
  paths["/auth/login"]["post"]["responses"][200]["content"]["application/json"];

export type RefreshTokenPair =
  paths["/auth/refresh"]["post"]["responses"][200]["content"]["application/json"];

// Shared error envelope (all auth 4xx responses)
export type ApiErrorEnvelope =
  paths["/auth/register"]["post"]["responses"][400]["content"]["application/json"];

// ─── Categories ───────────────────────────────────────────────────────────────

export type Category =
  paths["/categories"]["get"]["responses"][200]["content"]["application/json"][number];

// ─── Videos ───────────────────────────────────────────────────────────────────

export type Video =
  paths["/videos/{publicId}"]["get"]["responses"][200]["content"]["application/json"];

export type UpdateVideoInput =
  paths["/videos/{publicId}"]["patch"]["requestBody"]["content"]["application/json"];

export type VideoPlayback =
  paths["/videos/{publicId}/playback"]["get"]["responses"][200]["content"]["application/json"];

// Upload (Fase 03) — sessão multipart presignada
export type CreateVideoInput =
  paths["/videos"]["post"]["requestBody"]["content"]["application/json"];

export type VideoCreated =
  paths["/videos"]["post"]["responses"][201]["content"]["application/json"];

export type UploadSession = VideoCreated["upload"];

export type PresignPartsInput =
  paths["/videos/{publicId}/upload/parts"]["post"]["requestBody"]["content"]["application/json"];

export type PresignedParts =
  paths["/videos/{publicId}/upload/parts"]["post"]["responses"][200]["content"]["application/json"];

export type UploadState =
  paths["/videos/{publicId}/upload"]["get"]["responses"][200]["content"]["application/json"];

export type CompleteUploadInput =
  paths["/videos/{publicId}/upload/complete"]["post"]["requestBody"]["content"]["application/json"];

export type UploadCompleted =
  paths["/videos/{publicId}/upload/complete"]["post"]["responses"][202]["content"]["application/json"];

// ─── Channels ─────────────────────────────────────────────────────────────────

export type Channel =
  paths["/channels/me"]["get"]["responses"][200]["content"]["application/json"];

export type UpdateChannelInput =
  paths["/channels/me"]["patch"]["requestBody"]["content"]["application/json"];

export type ChannelPublic =
  paths["/channels/{nickname}"]["get"]["responses"][200]["content"]["application/json"];

export type OwnerVideosPage =
  paths["/channels/me/videos"]["get"]["responses"][200]["content"]["application/json"];

export type OwnerVideosQuery = NonNullable<
  paths["/channels/me/videos"]["get"]["parameters"]["query"]
>;

export type VideoListItem = OwnerVideosPage["items"][number];

export type ChannelVideosPage =
  paths["/channels/{nickname}/videos"]["get"]["responses"][200]["content"]["application/json"];

export type ChannelVideosQuery = NonNullable<
  paths["/channels/{nickname}/videos"]["get"]["parameters"]["query"]
>;

export type VideoCardItem = ChannelVideosPage["items"][number];

// ─── BFF reshapes (Fase 04) ───────────────────────────────────────────────────

// PATCH /api/videos/{publicId}: `publish` (FE-only, default true) encadeia o publish quando o
// vídeo salvo é um rascunho pronto com título (per video-channel-management/TD-03 Revisions).
export type UpdateVideoRequest = UpdateVideoInput & { publish?: boolean };

export type VideoUpdateResult = { video: Video; published: boolean };
