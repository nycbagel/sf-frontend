import { PHOTO_MAX_BYTES, photoDataUrlSchema } from "@/lib/contacts/photo";
import {
  CONTACT_FIELDS,
  EMPTY_ADDRESS,
  addressFieldName,
  addressToFormValues,
  contactInputSchema,
  formDataToValues,
  zodFieldErrors,
} from "@/lib/contacts/schema";
import { MAX_ADDRESSES } from "@/lib/contacts/types";
import type { AddressFormValues, ContactFormValues } from "@/lib/contacts/types";

const PHOTO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function address(overrides: Partial<AddressFormValues> = {}): AddressFormValues {
  return { ...EMPTY_ADDRESS, ...overrides };
}

function values(overrides: Partial<ContactFormValues> = {}): ContactFormValues {
  return {
    first_name: "Ada",
    last_name: "Lovelace",
    email: "Ada@Example.com",
    phone: "",
    company: "",
    job_title: "",
    addresses: [],
    notes: "",
    photo: "",
    ...overrides,
  };
}

describe("contactInputSchema", () => {
  it("lowercases the email and nulls out the blanks", () => {
    const parsed = contactInputSchema.parse(values());

    expect(parsed.email).toBe("ada@example.com");
    expect(parsed.phone).toBeNull();
    expect(parsed.notes).toBeNull();
    expect(parsed.addresses).toEqual([]);
  });

  it("trims what the user typed", () => {
    expect(contactInputSchema.parse(values({ company: "  Acme  " })).company).toBe(
      "Acme",
    );
  });

  it("requires the three fields the API requires", () => {
    const result = contactInputSchema.safeParse(
      values({ first_name: " ", last_name: "", email: "" }),
    );

    expect(result.success).toBe(false);
    expect(zodFieldErrors(result.error!)).toEqual({
      first_name: "First name is required",
      last_name: "Last name is required",
      email: "Email is required",
    });
  });

  it("rejects a malformed email", () => {
    const result = contactInputSchema.safeParse(values({ email: "not-an-email" }));
    expect(zodFieldErrors(result.error!).email).toBe("Enter a valid email address");
  });

  it("enforces the API's length limits", () => {
    const result = contactInputSchema.safeParse(
      values({ first_name: "a".repeat(101), phone: "9".repeat(41) }),
    );

    expect(zodFieldErrors(result.error!)).toEqual({
      first_name: "First name must be 100 characters or fewer",
      phone: "Phone must be 40 characters or fewer",
    });
  });

  it("accepts an image data URL as the photo and blank as none", () => {
    expect(contactInputSchema.parse(values({ photo: PHOTO })).photo).toBe(PHOTO);
    expect(contactInputSchema.parse(values()).photo).toBeNull();
  });

  it("rejects a photo that is not an inline PNG, JPEG, or WebP", () => {
    for (const photo of [
      "https://example.com/ada.png",
      "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
      "data:image/png;base64,@@not-base64@@",
    ]) {
      const result = contactInputSchema.safeParse(values({ photo }));
      expect(zodFieldErrors(result.error!).photo).toBe(
        "Photo must be a PNG, JPEG, or WebP image",
      );
    }
  });

  it("rejects a photo above the API's size cap", () => {
    const tooBig = "A".repeat(Math.ceil((PHOTO_MAX_BYTES + 3) / 3) * 4);
    const result = contactInputSchema.safeParse(
      values({ photo: `data:image/jpeg;base64,${tooBig}` }),
    );

    expect(zodFieldErrors(result.error!).photo).toBe("Photo must be 512 KB or smaller");
  });

  describe("addresses", () => {
    it("keeps the rows in order with blanks nulled out", () => {
      const parsed = contactInputSchema.parse(
        values({
          addresses: [
            address({ type: "work", city: " Arlington ", state: "VA" }),
            address({ type: "home", street: "1 Market St" }),
          ],
        }),
      );

      expect(parsed.addresses).toEqual([
        { type: "work", street: null, city: "Arlington", state: "VA", postal_code: null, country: null },
        { type: "home", street: "1 Market St", city: null, state: null, postal_code: null, country: null },
      ]);
    });

    it("drops a row that has a type but nothing else", () => {
      const parsed = contactInputSchema.parse(
        values({ addresses: [address({ type: "other" }), address({ city: "Oslo" })] }),
      );

      expect(parsed.addresses.map((row) => row.city)).toEqual(["Oslo"]);
    });

    it("numbers a rejected row as the API will see it, ignoring dropped blanks", () => {
      // A blank row before a bad one: the API is sent one address, so the
      // message must say "Address 1", not "Address 2".
      const result = contactInputSchema.safeParse(
        values({
          addresses: [address({ type: "home" }), address({ city: "9".repeat(121) })],
        }),
      );

      expect(zodFieldErrors(result.error!).addresses).toMatch(/^Address 1: /);
    });

    it("counts only filled rows against the limit", () => {
      const filled = Array.from({ length: MAX_ADDRESSES }, (_, index) =>
        address({ city: `City ${index}` }),
      );

      const parsed = contactInputSchema.parse(
        values({ addresses: [...filled, address({ type: "other" })] }),
      );

      expect(parsed.addresses).toHaveLength(MAX_ADDRESSES);
    });

    it("still rejects more filled rows than the API accepts", () => {
      const result = contactInputSchema.safeParse(
        values({
          addresses: Array.from({ length: MAX_ADDRESSES + 1 }, (_, index) =>
            address({ city: `City ${index}` }),
          ),
        }),
      );

      expect(zodFieldErrors(result.error!).addresses).toMatch(/up to 10 addresses/);
    });

    it("names the row when a field is too long", () => {
      const result = contactInputSchema.safeParse(
        values({
          addresses: [address({ city: "Oslo" }), address({ postal_code: "9".repeat(21) })],
        }),
      );

      expect(zodFieldErrors(result.error!)).toEqual({
        addresses: "Address 2: Postal code must be 20 characters or fewer",
      });
    });

    it("rejects an unknown type", () => {
      const result = contactInputSchema.safeParse(
        values({ addresses: [address({ type: "vacation", city: "Oslo" })] }),
      );

      expect(zodFieldErrors(result.error!).addresses).toBe(
        "Address 1: Choose Home, Work, or Other",
      );
    });

    it("caps the list at the API's limit", () => {
      const result = contactInputSchema.safeParse(
        values({ addresses: Array.from({ length: 11 }, () => address({ city: "Oslo" })) }),
      );

      expect(zodFieldErrors(result.error!).addresses).toBe(
        "A contact can have up to 10 addresses",
      );
    });
  });
});

describe("formDataToValues", () => {
  it("pulls every known field out, defaulting to an empty string", () => {
    const formData = new FormData();
    formData.set("first_name", "Grace");
    formData.set("email", "grace@example.com");
    formData.set("ignored", "nope");

    const extracted = formDataToValues(formData);

    expect(extracted.first_name).toBe("Grace");
    expect(extracted.last_name).toBe("");
    expect(extracted.addresses).toEqual([]);
    expect(Object.keys(extracted).sort()).toEqual(
      [...CONTACT_FIELDS.map((field) => field.name), "addresses"].sort(),
    );
  });

  it("ignores a file submitted for an address field", () => {
    // A real multipart submission hands us a File here, which would otherwise
    // stringify to "[object File]" and be stored as an address line. The entries
    // are supplied directly because jsdom's FormData coerces on `set()`.
    const entries: Array<[string, FormDataEntryValue]> = [
      [addressFieldName(0, "type"), "home"],
      [addressFieldName(0, "city"), "Oslo"],
      [addressFieldName(0, "street"), new File(["x"], "sneaky.png", { type: "image/png" })],
    ];
    const formData = {
      entries: () => entries[Symbol.iterator](),
      get: () => null,
    } as unknown as FormData;

    expect(formDataToValues(formData).addresses).toEqual([
      address({ type: "home", city: "Oslo" }),
    ]);
  });

  it("regroups the indexed address inputs into rows, by index", () => {
    const formData = new FormData();
    formData.set(addressFieldName(1, "type"), "work");
    formData.set(addressFieldName(1, "city"), "Arlington");
    formData.set(addressFieldName(0, "type"), "home");
    formData.set(addressFieldName(0, "street"), "1 Market St");
    formData.set("addresses[0].bogus", "ignored");

    expect(formDataToValues(formData).addresses).toEqual([
      address({ type: "home", street: "1 Market St" }),
      address({ type: "work", city: "Arlington" }),
    ]);
  });
});

describe("addressToFormValues", () => {
  it("turns nulls into empty strings for the inputs", () => {
    expect(
      addressToFormValues({
        type: "home",
        street: null,
        city: "Oslo",
        state: null,
        postal_code: null,
        country: "Norway",
      }),
    ).toEqual(address({ type: "home", city: "Oslo", country: "Norway" }));
  });
});

describe("photo data URLs must be canonical base64", () => {
  it.each([
    ["data:image/png;base64,A", "a lone character"],
    ["data:image/png;base64,A=", "an impossible one-character group"],
    ["data:image/png;base64,AA=", "a short padded group"],
    ["data:image/png;base64,", "an empty payload"],
  ])("rejects %s (%s)", (value) => {
    expect(photoDataUrlSchema.safeParse(value).success).toBe(false);
  });

  it.each([
    "data:image/png;base64,AAAA",
    "data:image/png;base64,AA==",
    "data:image/jpeg;base64,AAA=",
  ])("accepts %s", (value) => {
    expect(photoDataUrlSchema.safeParse(value).success).toBe(true);
  });
});
