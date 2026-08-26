"use client";

import { useRef, useState } from "react";
import { MapPin, Plus, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import {
  ADDRESS_FIELDS,
  EMPTY_ADDRESS,
  addressFieldName,
} from "@/lib/contacts/schema";
import { MAX_ADDRESSES, type AddressFormValues } from "@/lib/contacts/types";

interface Row {
  /** Stable identity so removing a row does not re-mount the ones after it. */
  key: number;
  values: AddressFormValues;
}

function toRows(values: AddressFormValues[], firstKey = 0): Row[] {
  return values.map((row, offset) => ({ key: firstKey + offset, values: row }));
}

/** One past the highest key in use; a removed row's key is never on screen, so reuse is safe. */
function nextKey(rows: Row[]): number {
  return rows.reduce((max, row) => Math.max(max, row.key), -1) + 1;
}

/**
 * Repeatable address rows for the contact form.
 *
 * Each input is named `addresses[i].<field>`, so the rows travel in a plain
 * form POST and `formDataToValues` regroups them on the server. The rows
 * render on the server too — only adding and removing needs JavaScript.
 *
 * `initial` is the contact's addresses on first render and the echoed
 * submission after a failed one. When it changes the rows are rebuilt under
 * fresh keys, so every input remounts with the new default — the same way the
 * plain inputs take their `defaultValue` from the echoed values.
 */
export default function AddressesField({
  initial,
  error,
}: {
  initial: AddressFormValues[];
  error?: string;
}) {
  const [rows, setRows] = useState(() => toRows(initial));
  const [seenInitial, setSeenInitial] = useState(initial);

  if (initial !== seenInitial) {
    setSeenInitial(initial);
    setRows(toRows(initial, nextKey(rows)));
  }

  // Adding and removing rows moves the DOM out from under the keyboard, so each
  // one names where focus should land and the row/Add button claims it on mount.
  const focusTarget = useRef<number | "add" | null>(null);

  function addRow() {
    setRows((current) => {
      const key = nextKey(current);
      focusTarget.current = key;
      return [...current, { key, values: EMPTY_ADDRESS }];
    });
  }

  function removeRow(key: number) {
    setRows((current) => {
      const index = current.findIndex((row) => row.key === key);
      const remaining = current.filter((row) => row.key !== key);
      // Focus the row that takes this one's place, else the last one, else Add.
      focusTarget.current =
        remaining[index]?.key ?? remaining[remaining.length - 1]?.key ?? "add";
      return remaining;
    });
  }

  /** Called by a row (or the Add button) once it is on screen. */
  function claimFocus(owner: number | "add", element: HTMLElement | null) {
    if (!element || focusTarget.current !== owner) return;
    focusTarget.current = null;
    element.focus();
  }

  const errorId = "field-addresses-error";

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <p className="flex items-center gap-2 rounded-lg border border-dashed border-hairline px-4 py-3 text-[13px] text-muted-foreground">
          <MapPin className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          No addresses yet — add a home or work address.
        </p>
      ) : null}

      {rows.map((row, index) => (
        <fieldset
          key={row.key}
          ref={(element: HTMLFieldSetElement | null) =>
            claimFocus(row.key, element?.querySelector<HTMLElement>("select, input") ?? null)
          }
          aria-describedby={error ? errorId : undefined}
          className="space-y-3 rounded-lg border border-border bg-card/50 p-4"
        >
          <legend className="sr-only">Address {index + 1}</legend>

          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-medium text-foreground">
              Address {index + 1}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Remove address ${index + 1}`}
              onClick={() => removeRow(row.key)}
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {ADDRESS_FIELDS.map((spec) => (
              <Field
                key={spec.name}
                field={{ ...spec, name: addressFieldName(index, spec.name) }}
                defaultValue={row.values[spec.name]}
              />
            ))}
          </div>
        </fieldset>
      ))}

      {error ? (
        <p id={errorId} role="alert" className="text-[13px] text-destructive">
          {error}
        </p>
      ) : null}

      <Button
        variant="secondary"
        size="sm"
        ref={(element: HTMLButtonElement | null) => claimFocus("add", element)}
        onClick={addRow}
        disabled={rows.length >= MAX_ADDRESSES}
      >
        <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        Add address
      </Button>
    </div>
  );
}
