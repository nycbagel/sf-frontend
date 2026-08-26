import React from "react";
import { render, screen } from "@testing-library/react";
import ContactAvatar from "@/components/contacts/ContactAvatar";
import { makeContact } from "../mocks/handlers";

const PHOTO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

describe("ContactAvatar", () => {
  it("falls back to initials when there is no photo", () => {
    const { container } = render(<ContactAvatar contact={makeContact()} />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.textContent).toBe("AL");
  });

  it("renders the photo as a round image with a descriptive alt", () => {
    render(<ContactAvatar contact={makeContact({ photo: PHOTO })} size="lg" />);

    const img = screen.getByRole("img", { name: "Photo of Ada Lovelace" });
    expect(img).toHaveAttribute("src", PHOTO);
    expect(img).toHaveClass("rounded-full", "aspect-square", "object-cover", "h-14");
  });
});
