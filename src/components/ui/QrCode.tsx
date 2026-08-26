import "server-only";

import { encode } from "uqr";

/** Quiet zone the QR spec requires around the symbol, in modules. */
const QUIET_ZONE = 4;

/**
 * One SVG path covering every dark module. Horizontal runs are merged into a
 * single rectangle each, so the markup stays a fraction of one-rect-per-module.
 */
export function modulePath(data: boolean[][]): string {
  const parts: string[] = [];
  data.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x += 1;
        continue;
      }
      let run = 1;
      while (row[x + run]) run += 1;
      parts.push(`M${x} ${y}h${run}v1h-${run}z`);
      x += run;
    }
  });
  return parts.join("");
}

/**
 * A QR code rendered on the server as inline SVG — no client JavaScript, no
 * image route, crisp at any zoom. Text beyond what a QR can hold (2,953 bytes
 * at version 40) is reported instead of thrown.
 */
export default function QrCode({
  text,
  label,
  className = "",
}: {
  text: string;
  label: string;
  className?: string;
}) {
  let qr: ReturnType<typeof encode>;
  try {
    qr = encode(text, { ecc: "M", border: QUIET_ZONE });
  } catch (error) {
    // uqr raises a RangeError ("Data too long") past the version-40 ceiling.
    if (!(error instanceof RangeError)) throw error;
    return (
      <p role="note" className="text-[13px] text-muted-foreground">
        Too much data to fit in a QR code.
      </p>
    );
  }

  return (
    // Scanners need dark modules on a light ground, so the card stays white in
    // the dark theme on purpose — the one place the semantic tokens don't apply.
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${qr.size} ${qr.size}`}
      shapeRendering="crispEdges"
      className={`rounded-lg bg-white text-black ${className}`}
    >
      <path d={modulePath(qr.data)} fill="currentColor" />
    </svg>
  );
}
