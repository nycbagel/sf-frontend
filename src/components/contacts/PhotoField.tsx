"use client";

import { useRef, useState, useSyncExternalStore, type ChangeEvent } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import {
  PHOTO_EDGE_PX,
  PHOTO_MAX_SOURCE_BYTES,
  PHOTO_MAX_SOURCE_EDGE_PX,
  PHOTO_MEDIA_TYPES,
} from "@/lib/contacts/photo";
import type { ContactFieldSpec } from "@/lib/contacts/schema";

/** Thrown when a chosen file is too large to decode; shown to the user as-is. */
class PhotoTooLargeError extends Error {}

/**
 * Centre-crop to a square and downscale, so what we store is a small data URL
 * (tens of KB as JPEG) no matter how large the chosen file was.
 *
 * The output is bounded by the resize, but the source has to be decoded first,
 * so both its byte size and its pixel dimensions are checked before and after
 * `createImageBitmap` — a decompression bomb never reaches the canvas.
 */
async function toSquareDataUrl(file: File): Promise<string> {
  if (file.size > PHOTO_MAX_SOURCE_BYTES) {
    throw new PhotoTooLargeError(
      `That image is ${Math.round(file.size / 1024 / 1024)} MB. Choose one under ${PHOTO_MAX_SOURCE_BYTES / 1024 / 1024} MB.`,
    );
  }

  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width > PHOTO_MAX_SOURCE_EDGE_PX || bitmap.height > PHOTO_MAX_SOURCE_EDGE_PX) {
      throw new PhotoTooLargeError(
        `That image is ${bitmap.width}×${bitmap.height} pixels. Choose one under ${PHOTO_MAX_SOURCE_EDGE_PX} pixels per side.`,
      );
    }
    const edge = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = PHOTO_EDGE_PX;
    canvas.height = PHOTO_EDGE_PX;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D is not available");
    // JPEG has no alpha: paint the canvas white first so a transparent PNG
    // gets a white background instead of the encoder's black.
    context.fillStyle = "#fff";
    context.fillRect(0, 0, PHOTO_EDGE_PX, PHOTO_EDGE_PX);
    context.drawImage(
      bitmap,
      (bitmap.width - edge) / 2,
      (bitmap.height - edge) / 2,
      edge,
      edge,
      0,
      0,
      PHOTO_EDGE_PX,
      PHOTO_EDGE_PX,
    );
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    bitmap.close();
  }
}

// Hydration probe: the server snapshot is `false`, the client snapshot `true`,
// so the markup matches on hydration and flips once React is in charge.
const noSubscription = () => () => {};
const useHydrated = () => useSyncExternalStore(noSubscription, () => true, () => false);

/**
 * Photo picker for the contact form. The chosen image is resized in the
 * browser and carried in a hidden `photo` input, so the form still submits as
 * a plain POST and the value survives a failed round trip like any other field.
 *
 * Picking a file needs JavaScript (the resize runs on a canvas), so the picker
 * stays disabled until the component has hydrated rather than accepting a file
 * a pre-hydration submit would silently drop. Every other field on the form
 * keeps working before hydration. While a file is being resized the form is
 * told via `onBusyChange` so it can hold the submit until the read settles.
 */
export default function PhotoField({
  field,
  defaultValue,
  error,
  onBusyChange,
}: {
  field: ContactFieldSpec;
  defaultValue?: string;
  error?: string;
  /** Called with `true` while a chosen file is being read, then `false`. */
  onBusyChange?: (busy: boolean) => void;
}) {
  const [photo, setPhoto] = useState(defaultValue || null);
  const [readError, setReadError] = useState<string>();
  const hydrated = useHydrated();
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  // Incremented per pick, so a slow read that finishes after a newer pick is
  // ignored instead of overwriting the newer photo.
  const readSequence = useRef(0);

  const id = `field-${field.name}`;
  const errorId = `${id}-error`;
  const message = readError ?? error;
  const pickerDisabled = !hydrated || busy;

  function setBusyState(next: boolean) {
    setBusy(next);
    onBusyChange?.(next);
  }

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const sequence = ++readSequence.current;
    setBusyState(true);
    try {
      const dataUrl = await toSquareDataUrl(file);
      if (sequence !== readSequence.current) return;
      setPhoto(dataUrl);
      setReadError(undefined);
    } catch (error) {
      if (sequence !== readSequence.current) return;
      setReadError(
        error instanceof PhotoTooLargeError
          ? error.message
          : "That file could not be read as an image.",
      );
    } finally {
      if (sequence === readSequence.current) setBusyState(false);
    }
  }

  function removePhoto() {
    readSequence.current += 1;
    setPhoto(null);
    setReadError(undefined);
    setBusyState(false);
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <div className={field.wide ? "sm:col-span-2" : undefined}>
      <label
        htmlFor={id}
        className="mb-1.5 block text-[13px] font-medium text-foreground"
      >
        {field.label}
        <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
          optional
        </span>
      </label>

      <div className="flex items-center gap-4">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- inline data URL
          <img
            src={photo}
            alt="Selected photo"
            className="h-16 w-16 shrink-0 rounded-full aspect-square object-cover ring-1 ring-border"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground ring-1 ring-border"
          >
            <ImagePlus className="h-6 w-6" strokeWidth={1.5} />
          </span>
        )}

        <div className="flex flex-wrap items-center gap-2" aria-busy={busy || undefined}>
          <input
            ref={fileInput}
            id={id}
            type="file"
            accept={PHOTO_MEDIA_TYPES.join(",")}
            disabled={pickerDisabled}
            onChange={handleChange}
            aria-invalid={message ? true : undefined}
            aria-describedby={message ? errorId : undefined}
            // Out of the tab order: the button below is the keyboard control;
            // the input keeps its <label> so it stays the labelled "photo" field.
            tabIndex={-1}
            className="sr-only"
          />
          <Button
            variant="secondary"
            size="sm"
            disabled={pickerDisabled}
            onClick={() => fileInput.current?.click()}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : null}
            {busy ? "Processing…" : photo ? "Change photo" : "Upload photo"}
          </Button>
          {photo ? (
            <Button variant="ghost" size="sm" disabled={pickerDisabled} onClick={removePhoto}>
              <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Remove
            </Button>
          ) : null}
          <input type="hidden" name={field.name} value={photo ?? ""} />
        </div>
      </div>

      <p className="mt-1.5 text-[12px] text-muted-foreground">
        PNG, JPEG, or WebP. Cropped to a square and resized to {PHOTO_EDGE_PX}px
        before it is sent.
      </p>

      {message ? (
        <p id={errorId} role="alert" className="mt-1.5 text-[13px] text-destructive">
          {message}
        </p>
      ) : null}
    </div>
  );
}
