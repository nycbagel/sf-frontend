import { z } from "zod";

/**
 * Contact photos travel as base64 data URLs, so the API's in-memory database
 * can hold them without a file store. These rules mirror the API's own
 * `PhotoDataUrl` validator; the API stays the authority.
 */

export const PHOTO_MEDIA_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

/** Largest decoded image the API accepts. */
export const PHOTO_MAX_BYTES = 512 * 1024;

/** Square edge the browser downscales uploads to before they leave the page. */
export const PHOTO_EDGE_PX = 256;

/**
 * Largest file the picker will decode. The output is bounded by the resize, but
 * `createImageBitmap` has to decode the source first, so an enormous or highly
 * compressed image would otherwise be decompressed in full before it shrank.
 */
export const PHOTO_MAX_SOURCE_BYTES = 20 * 1024 * 1024;

/** Largest source image the picker will decode, per side. */
export const PHOTO_MAX_SOURCE_EDGE_PX = 12_000;

// Canonical base64: whole four-character groups, with only the final group
// allowed to be padded (`AA==`, `AAA=`). Anything else cannot decode.
const DATA_URL =
  /^data:image\/(?:png|jpeg|webp);base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

/** Bytes a base64 payload decodes to, worked out from its length alone. */
export function decodedByteLength(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

export const photoDataUrlSchema = z
  .string()
  .refine(
    (value) => DATA_URL.test(value) && value.length > "data:image/png;base64,".length,
    "Photo must be a PNG, JPEG, or WebP image",
  )
  .refine(
    (value) => decodedByteLength(value.slice(value.indexOf(",") + 1)) <= PHOTO_MAX_BYTES,
    `Photo must be ${PHOTO_MAX_BYTES / 1024} KB or smaller`,
  );
