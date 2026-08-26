import React from "react";
import { render, screen } from "@testing-library/react";
import QrCode, { modulePath } from "@/components/ui/QrCode";

const CARD = "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Ada Lovelace\r\nEND:VCARD\r\n";

describe("QrCode", () => {
  it("renders an accessible image whose label names the contact", () => {
    render(<QrCode text={CARD} label="Scan to save Ada Lovelace" />);

    const svg = screen.getByRole("img", { name: "Scan to save Ada Lovelace" });
    const [, , width, height] = svg.getAttribute("viewBox")!.split(" ").map(Number);
    expect(width).toBe(height);
    expect(width).toBeGreaterThanOrEqual(29); // version 1 (21) plus a 4-module quiet zone each side
    expect(svg.querySelector("path")?.getAttribute("d")).toMatch(/^M\d+ \d+h\d+v1h-\d+z/);
  });

  it("merges horizontal runs into one path", () => {
    expect(
      modulePath([
        [true, true, false],
        [false, true, false],
      ]),
    ).toBe("M0 0h2v1h-2zM1 1h1v1h-1z");
  });

  it("explains itself instead of throwing when the text cannot fit", () => {
    render(<QrCode text={"x".repeat(3000)} label="Too big" />);

    expect(screen.getByRole("note")).toHaveTextContent("Too much data to fit in a QR code.");
    expect(screen.queryByRole("img")).toBeNull();
  });
});
