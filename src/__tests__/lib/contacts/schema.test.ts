import { PHOTO_MAX_BYTES, photoDataUrlSchema } from "@/lib/contacts/photo";
import {
  CONTACT_FIELDS,
  contactInputSchema,
  formDataToValues,
  zodFieldErrors,
} from "@/lib/contacts/schema";

const PHOTO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function values(overrides: Record<string, string> = {}) {
  return {
    first_name: "Ada",
    last_name: "Lovelace",
    email: "Ada@Example.com",
    phone: "",
    company: "",
    job_title: "",
    address: "",
    city: "",
    state: "",
    postal_code: "",
    country: "",
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
      values({ first_name: "a".repeat(101), postal_code: "9".repeat(21) }),
    );

    expect(zodFieldErrors(result.error!)).toEqual({
      first_name: "First name must be 100 characters or fewer",
      postal_code: "Postal code must be 20 characters or fewer",
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
    expect(Object.keys(extracted).sort()).toEqual(
      CONTACT_FIELDS.map((field) => field.name).sort(),
    );
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
