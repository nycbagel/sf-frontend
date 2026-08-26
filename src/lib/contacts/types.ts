/**
 * Types mirroring the Contacts API OpenAPI 3.1 document (`GET /openapi.json`).
 * Field names stay snake_case so payloads map 1:1 onto the wire format.
 */

/** `AddressType` — the API's enum of what kind of place an address is. */
export const ADDRESS_TYPES = ["home", "work", "other"] as const;
export type AddressType = (typeof ADDRESS_TYPES)[number];

export const ADDRESS_TYPE_LABELS: Record<AddressType, string> = {
  home: "Home",
  work: "Work",
  other: "Other",
};

/** Bound the API enforces on a contact's address list. */
export const MAX_ADDRESSES = 10;

/** `AddressRead` — one of a contact's postal addresses. */
export interface Address {
  id: number;
  type: AddressType;
  street: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
}

/** `AddressInput` — an address as sent to the API; the server assigns the id. */
export type AddressInput = Omit<Address, "id">;

/** `ContactRead` — a stored contact, as returned by every contact endpoint. */
export interface Contact {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  company: string | null;
  job_title: string | null;
  addresses: Address[];
  notes: string | null;
  /** Base64 data URL (`data:image/...;base64,...`), or `null` for none. */
  photo: string | null;
  created_at: string;
  updated_at: string;
  full_name: string;
}

/** Every editable field, i.e. `ContactCreate` / `ContactReplace`. */
export type ContactInput = Omit<
  Contact,
  "id" | "created_at" | "updated_at" | "full_name" | "addresses"
> & { addresses: AddressInput[] };

/** The single-value inputs — everything on the form except the address rows. */
export type ContactTextField = Exclude<keyof ContactInput, "addresses">;

/** `ContactPage` — one page of contacts plus the totals needed to paginate. */
export interface ContactPage {
  items: Contact[];
  total: number;
  limit: number;
  offset: number;
}

/** `HealthResponse` — result of the liveness probe. */
export interface HealthResponse {
  status: string;
  database: string;
  contacts: number;
}

/** Sort fields the API's allow-list accepts. */
export const SORT_FIELDS = [
  "id",
  "first_name",
  "last_name",
  "email",
  "company",
  "created_at",
  "updated_at",
] as const;

export type SortField = (typeof SORT_FIELDS)[number];
export type SortOrder = "asc" | "desc";

/** Bounds the API enforces on `limit`. */
export const MIN_LIMIT = 1;
export const MAX_LIMIT = 200;
export const DEFAULT_PER_PAGE = 25;
export const PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;

/** One address row exactly as it comes off the form, before Zod parses it. */
export type AddressFormValues = Record<keyof AddressInput, string>;

/** The whole form as raw strings: the text inputs plus the address rows. */
export type ContactFormValues = Record<ContactTextField, string> & {
  addresses: AddressFormValues[];
};

/**
 * Result of a server action, consumed by `useActionState` in the forms.
 * Lives here (not in the `"use server"` module) so client components can import
 * the type without pulling server code into the browser bundle.
 */
export type FormState = {
  status: "idle" | "error";
  /** Message shown above the form; used for API-level failures. */
  message?: string;
  /** Per-field messages keyed by input name; address rows share one entry. */
  fieldErrors?: Partial<Record<keyof ContactInput, string>>;
  /** Echo of the submitted values so the form survives a failed round trip. */
  values?: Partial<ContactFormValues>;
};

export const EMPTY_FORM_STATE: FormState = { status: "idle" };
