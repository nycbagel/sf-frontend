import { z } from "zod";
import { photoDataUrlSchema } from "./photo";
import {
  ADDRESS_TYPES,
  ADDRESS_TYPE_LABELS,
  MAX_ADDRESSES,
  type Address,
  type AddressFormValues,
  type AddressInput,
  type ContactFormValues,
  type ContactInput,
  type ContactTextField,
} from "./types";

/**
 * Client/server-shared validation for the contact form.
 *
 * The rules mirror the API's Pydantic models (`ContactCreate` / `ContactReplace`)
 * so the user sees a mistake before a round trip — the API stays the authority,
 * and anything it rejects anyway is surfaced by `toFieldErrors` in `./api.ts`.
 */

/** Optional text: trimmed, and blank becomes `null` (the API clears the field). */
function optionalText(max: number, label: string) {
  return z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer`)
    .transform((value) => value || null)
    .nullable()
    .default(null);
}

function requiredText(max: number, label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`);
}

const addressInputSchema = z.object({
  type: z.enum(ADDRESS_TYPES, "Choose Home, Work, or Other"),
  street: optionalText(300, "Street address"),
  city: optionalText(120, "City"),
  state: optionalText(120, "State"),
  postal_code: optionalText(20, "Postal code"),
  country: optionalText(120, "Country"),
}) satisfies z.ZodType<AddressInput, unknown>;

/** A row the user added but never filled in is dropped rather than rejected. */
function hasLocation(address: AddressInput): boolean {
  return [
    address.street,
    address.city,
    address.state,
    address.postal_code,
    address.country,
  ].some((part) => part !== null);
}

export const contactInputSchema = z.object({
  first_name: requiredText(100, "First name"),
  last_name: requiredText(100, "Last name"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .max(320, "Email must be 320 characters or fewer")
    .pipe(z.email("Enter a valid email address"))
    .transform((value) => value.toLowerCase()),
  phone: optionalText(40, "Phone"),
  company: optionalText(200, "Company"),
  job_title: optionalText(200, "Job title"),
  addresses: z
    .array(addressInputSchema)
    .max(MAX_ADDRESSES, `A contact can have up to ${MAX_ADDRESSES} addresses`)
    .transform((rows) => rows.filter(hasLocation)),
  notes: z
    .string()
    .trim()
    .transform((value) => value || null)
    .nullable()
    .default(null),
  // Blank means "no photo"; anything else must be a data URL the API will accept.
  photo: z
    .string()
    .trim()
    .transform((value) => value || null)
    .pipe(photoDataUrlSchema.nullable())
    .default(null),
}) satisfies z.ZodType<ContactInput, unknown>;

/**
 * Collapse a ZodError into one message per field, keyed by input name. Address
 * rows share the `addresses` key, so the row number is folded into the message.
 */
export function zodFieldErrors(
  error: z.ZodError,
): Partial<Record<keyof ContactInput, string>> {
  const fieldErrors: Partial<Record<keyof ContactInput, string>> = {};
  for (const issue of error.issues) {
    const [key, row] = issue.path;
    if (typeof key !== "string" || key in fieldErrors) continue;
    fieldErrors[key as keyof ContactInput] =
      key === "addresses" && typeof row === "number"
        ? `Address ${row + 1}: ${issue.message}`
        : issue.message;
  }
  return fieldErrors;
}

/* ------------------------------------------------------------------ */
/* Form metadata — one source of truth for the fields and their limits */
/* ------------------------------------------------------------------ */

export interface FieldSpec<Name extends string = string> {
  name: Name;
  label: string;
  type?: "text" | "email" | "tel" | "textarea" | "select" | "photo";
  /** Choices for a `select`. */
  options?: readonly { value: string; label: string }[];
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
  autoComplete?: string;
  /** Column span inside the section grid. */
  wide?: boolean;
}

export type ContactFieldSpec = FieldSpec<ContactTextField>;
export type AddressFieldSpec = FieldSpec<keyof AddressInput>;

interface FormSection {
  title: string;
  description: string;
}

/** A section of plain inputs, rendered straight from its field specs. */
export interface ContactFieldGroup extends FormSection {
  kind: "fields";
  fields: ContactFieldSpec[];
}

/** The repeatable address rows, rendered by `AddressesField`. */
export interface ContactAddressesGroup extends FormSection {
  kind: "addresses";
}

export type ContactFormGroup = ContactFieldGroup | ContactAddressesGroup;

export const CONTACT_FIELD_GROUPS: ContactFormGroup[] = [
  {
    kind: "fields",
    title: "Photo",
    description: "Shown as a round avatar; initials stand in when there is none.",
    fields: [
      {
        name: "photo",
        label: "Profile photo",
        type: "photo",
        // A 512 KB image is ~700 K characters once base64-encoded.
        maxLength: 700_000,
        wide: true,
      },
    ],
  },
  {
    kind: "fields",
    title: "Identity",
    description: "First name, last name, and email are required.",
    fields: [
      {
        name: "first_name",
        label: "First name",
        required: true,
        maxLength: 100,
        placeholder: "Ada",
        autoComplete: "given-name",
      },
      {
        name: "last_name",
        label: "Last name",
        required: true,
        maxLength: 100,
        placeholder: "Lovelace",
        autoComplete: "family-name",
      },
      {
        name: "email",
        label: "Email",
        type: "email",
        required: true,
        maxLength: 320,
        placeholder: "ada@example.com",
        autoComplete: "email",
      },
      {
        name: "phone",
        label: "Phone",
        type: "tel",
        maxLength: 40,
        placeholder: "+1-415-555-0101",
        autoComplete: "tel",
      },
    ],
  },
  {
    kind: "fields",
    title: "Work",
    description: "Where they work and what they do.",
    fields: [
      {
        name: "company",
        label: "Company",
        maxLength: 200,
        placeholder: "Analytical Engines",
        autoComplete: "organization",
      },
      {
        name: "job_title",
        label: "Job title",
        maxLength: 200,
        placeholder: "Mathematician",
        autoComplete: "organization-title",
      },
    ],
  },
  {
    kind: "addresses",
    title: "Addresses",
    description: `Home, work, or other — up to ${MAX_ADDRESSES}. A row left blank is ignored.`,
  },
  {
    kind: "fields",
    title: "Notes",
    description: "Anything worth remembering. No length limit.",
    fields: [
      {
        name: "notes",
        label: "Notes",
        type: "textarea",
        maxLength: 10_000,
        placeholder: "Met at the SF hackathon.",
        wide: true,
      },
    ],
  },
];

export const CONTACT_FIELDS: ContactFieldSpec[] = CONTACT_FIELD_GROUPS.flatMap(
  (group) => (group.kind === "fields" ? group.fields : []),
);

/** The inputs inside one address row, in display order. */
export const ADDRESS_FIELDS: AddressFieldSpec[] = [
  {
    name: "type",
    label: "Type",
    type: "select",
    options: ADDRESS_TYPES.map((type) => ({
      value: type,
      label: ADDRESS_TYPE_LABELS[type],
    })),
  },
  {
    name: "street",
    label: "Street address",
    maxLength: 300,
    placeholder: "1 Market St, Suite 400",
    autoComplete: "street-address",
  },
  {
    name: "city",
    label: "City",
    maxLength: 120,
    placeholder: "San Francisco",
    autoComplete: "address-level2",
  },
  {
    name: "state",
    label: "State / region",
    maxLength: 120,
    placeholder: "CA",
    autoComplete: "address-level1",
  },
  {
    name: "postal_code",
    label: "Postal code",
    maxLength: 20,
    placeholder: "94105",
    autoComplete: "postal-code",
  },
  {
    name: "country",
    label: "Country",
    maxLength: 120,
    placeholder: "USA",
    autoComplete: "country-name",
  },
];

export const EMPTY_ADDRESS: AddressFormValues = {
  type: ADDRESS_TYPES[0],
  street: "",
  city: "",
  state: "",
  postal_code: "",
  country: "",
};

/**
 * Input name for one cell of one address row. The form renders these and
 * `formDataToValues` parses them back, so a plain POST carries the whole list.
 */
export function addressFieldName(
  index: number,
  field: keyof AddressInput,
): string {
  return `addresses[${index}].${field}`;
}

const ADDRESS_FIELD_NAME = /^addresses\[(\d+)\]\.([a-z_]+)$/;

function isAddressField(name: string): name is keyof AddressInput {
  return name in EMPTY_ADDRESS;
}

/** Regroup the indexed address inputs into rows, in index order. */
function addressesFromFormData(formData: FormData): AddressFormValues[] {
  const rows = new Map<number, AddressFormValues>();
  for (const [name, value] of formData.entries()) {
    const match = ADDRESS_FIELD_NAME.exec(name);
    if (!match || !isAddressField(match[2])) continue;

    const index = Number(match[1]);
    const row = rows.get(index) ?? { ...EMPTY_ADDRESS };
    row[match[2]] = String(value);
    rows.set(index, row);
  }
  return [...rows.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, row]) => row);
}

/** Pull the contact fields out of a submitted form, as raw strings. */
export function formDataToValues(formData: FormData): ContactFormValues {
  const text = Object.fromEntries(
    CONTACT_FIELDS.map((field) => [
      field.name,
      String(formData.get(field.name) ?? ""),
    ]),
  ) as Record<ContactTextField, string>;

  return { ...text, addresses: addressesFromFormData(formData) };
}

/** A stored address as form strings, so the edit form can prefill its row. */
export function addressToFormValues(address: Address): AddressFormValues {
  return {
    type: address.type,
    street: address.street ?? "",
    city: address.city ?? "",
    state: address.state ?? "",
    postal_code: address.postal_code ?? "",
    country: address.country ?? "",
  };
}
