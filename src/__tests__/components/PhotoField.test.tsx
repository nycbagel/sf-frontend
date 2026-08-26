import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PhotoField from "@/components/contacts/PhotoField";
import { CONTACT_FIELDS } from "@/lib/contacts/schema";

const PHOTO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const photoField = CONTACT_FIELDS.find((field) => field.name === "photo")!;

function hiddenInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector('input[type="hidden"][name="photo"]')!;
}

/**
 * jsdom has no image decoding or canvas. Stand in for both: `createImageBitmap`
 * resolves when the test says so, and the canvas hands back a fixed data URL.
 */
function stubImagePipeline() {
  const pending: Array<() => void> = [];
  const nativeBitmap = (globalThis as { createImageBitmap?: unknown }).createImageBitmap;
  const nativeGetContext = HTMLCanvasElement.prototype.getContext;
  const nativeToDataUrl = HTMLCanvasElement.prototype.toDataURL;

  (globalThis as { createImageBitmap?: unknown }).createImageBitmap = jest.fn(
    () =>
      new Promise((resolve) => {
        pending.push(() => resolve({ width: 4, height: 4, close: jest.fn() }));
      }),
  );
  HTMLCanvasElement.prototype.getContext = jest.fn(
    () => ({ drawImage: jest.fn() }) as unknown as CanvasRenderingContext2D,
  ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  let calls = 0;
  HTMLCanvasElement.prototype.toDataURL = jest.fn(() => `data:image/jpeg;base64,resized${++calls}`);

  return {
    /** Let the oldest outstanding read finish. */
    finishNextRead: () => pending.shift()?.(),
    restore: () => {
      (globalThis as { createImageBitmap?: unknown }).createImageBitmap = nativeBitmap;
      HTMLCanvasElement.prototype.getContext = nativeGetContext;
      HTMLCanvasElement.prototype.toDataURL = nativeToDataUrl;
    },
  };
}

const pngFile = (name: string) => new File(["png"], name, { type: "image/png" });

describe("PhotoField", () => {
  it("offers a file picker limited to image types", () => {
    const { container } = render(<PhotoField field={photoField} />);

    expect(screen.getByLabelText(/photo/i)).toHaveAttribute(
      "accept",
      "image/png,image/jpeg,image/webp",
    );
    expect(screen.getByRole("button", { name: "Upload photo" })).toBeInTheDocument();
    expect(hiddenInput(container)).toHaveValue("");
  });

  it("carries an existing photo in the hidden input so an edit keeps it", () => {
    const { container } = render(
      <PhotoField field={photoField} defaultValue={PHOTO} />,
    );

    expect(screen.getByRole("img", { name: "Selected photo" })).toHaveAttribute(
      "src",
      PHOTO,
    );
    expect(hiddenInput(container)).toHaveValue(PHOTO);
    expect(screen.getByRole("button", { name: "Change photo" })).toBeInTheDocument();
  });

  it("clears the photo when it is removed", async () => {
    const { container } = render(
      <PhotoField field={photoField} defaultValue={PHOTO} />,
    );

    await userEvent.click(screen.getByRole("button", { name: /remove/i }));

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(hiddenInput(container)).toHaveValue("");
  });

  it("keeps the picker disabled until it has hydrated", () => {
    // Server render: no JavaScript yet, so a chosen file could never be resized
    // and carried into the hidden input — refuse the pick rather than drop it.
    const markup = renderToStaticMarkup(<PhotoField field={photoField} />);
    expect(markup).toMatch(/<input[^>]*type="file"[^>]*disabled=""/);

    render(<PhotoField field={photoField} />);
    expect(screen.getByLabelText(/photo/i)).toBeEnabled();
  });

  it("reports busy while a file is being read and holds the result until then", async () => {
    const pipeline = stubImagePipeline();
    const onBusyChange = jest.fn();
    try {
      const { container } = render(
        <PhotoField field={photoField} onBusyChange={onBusyChange} />,
      );

      await userEvent.upload(screen.getByLabelText(/photo/i), pngFile("a.png"));

      expect(onBusyChange).toHaveBeenLastCalledWith(true);
      expect(screen.getByRole("button", { name: /processing/i })).toBeDisabled();
      expect(hiddenInput(container)).toHaveValue("");

      pipeline.finishNextRead();

      await waitFor(() =>
        expect(hiddenInput(container)).toHaveValue("data:image/jpeg;base64,resized1"),
      );
      expect(onBusyChange).toHaveBeenLastCalledWith(false);
      expect(screen.getByRole("button", { name: "Change photo" })).toBeEnabled();
    } finally {
      pipeline.restore();
    }
  });

  it("ignores a slow read that finishes after a newer file was picked", async () => {
    const pipeline = stubImagePipeline();
    try {
      const { container } = render(<PhotoField field={photoField} />);
      const input = screen.getByLabelText(/photo/i);

      await userEvent.upload(input, pngFile("first.png"));
      // The picker is disabled while reading; the user removes nothing and the
      // browser would not let them pick again — simulate a second change event
      // arriving anyway (e.g. drag-and-drop) by re-enabling and uploading.
      input.removeAttribute("disabled");
      await userEvent.upload(input, pngFile("second.png"));

      pipeline.finishNextRead(); // first.png finishes late
      pipeline.finishNextRead(); // second.png

      await waitFor(() =>
        expect(hiddenInput(container)).toHaveValue("data:image/jpeg;base64,resized2"),
      );
    } finally {
      pipeline.restore();
    }
  });

  it("shows the error the server reports for the field", () => {
    render(<PhotoField field={photoField} error="Photo is too large" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Photo is too large");
    expect(screen.getByLabelText(/photo/i)).toHaveAttribute("aria-invalid", "true");
  });
});
