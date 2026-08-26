import { ADDRESS_TYPE_LABELS, type AddressType } from "@/lib/contacts/types";

/** Small pill naming an address's kind, e.g. "Home". */
export default function AddressTypeBadge({ type }: { type: AddressType }) {
  return (
    <span className="inline-flex shrink-0 rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-secondary-foreground">
      {ADDRESS_TYPE_LABELS[type]}
    </span>
  );
}
