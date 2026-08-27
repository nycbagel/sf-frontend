import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AddressesField from "@/components/contacts/AddressesField";
import { EMPTY_ADDRESS } from "@/lib/contacts/schema";
import { MAX_ADDRESSES, type AddressFormValues } from "@/lib/contacts/types";

const HOME: AddressFormValues = {
  ...EMPTY_ADDRESS,
  type: "home",
  city: "San Francisco",
  state: "CA",
};
const WORK: AddressFormValues = { ...EMPTY_ADDRESS, type: "work", city: "Arlington" };

function rows() {
  return screen.queryAllByRole("group", { name: /^address \d+$/i });
}

describe("AddressesField", () => {
  it("prefills one numbered row per address, with indexed input names", () => {
    render(<AddressesField initial={[HOME, WORK]} />);

    const [first, second] = rows();
    expect(within(first).getByLabelText(/type/i)).toHaveValue("home");
    expect(within(first).getByLabelText(/city/i)).toHaveValue("San Francisco");
    expect(within(second).getByLabelText(/city/i)).toHaveAttribute(
      "name",
      "addresses[1].city",
    );
  });

  it("starts empty and adds a blank row on demand", async () => {
    render(<AddressesField initial={[]} />);
    expect(rows()).toHaveLength(0);
    expect(screen.getByText(/no addresses yet/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /add address/i }));
    expect(screen.queryByText(/no addresses yet/i)).not.toBeInTheDocument();

    const [row] = rows();
    expect(within(row).getByLabelText(/type/i)).toHaveValue("home");
    expect(within(row).getByLabelText(/street address/i)).toHaveValue("");
  });

  it("removes a row and renumbers the ones after it", async () => {
    render(<AddressesField initial={[HOME, WORK]} />);

    await userEvent.click(screen.getByRole("button", { name: /remove address 1/i }));

    const remaining = rows();
    expect(remaining).toHaveLength(1);
    expect(within(remaining[0]).getByLabelText(/city/i)).toHaveValue("Arlington");
    expect(within(remaining[0]).getByLabelText(/city/i)).toHaveAttribute(
      "name",
      "addresses[0].city",
    );
  });

  it("moves focus into the row it just added", async () => {
    render(<AddressesField initial={[]} />);

    await userEvent.click(screen.getByRole("button", { name: /add address/i }));

    const [row] = rows();
    expect(within(row).getByLabelText(/type/i)).toHaveFocus();
  });

  it("keeps focus in the list after removing a row", async () => {
    render(<AddressesField initial={[HOME, WORK]} />);

    await userEvent.click(screen.getByRole("button", { name: /remove address 1/i }));

    // The row that slid up into position 1 takes the focus, not the document body.
    const [row] = rows();
    expect(within(row).getByLabelText(/type/i)).toHaveFocus();
  });

  it("falls back to the Add button when the last row is removed", async () => {
    render(<AddressesField initial={[HOME]} />);

    await userEvent.click(screen.getByRole("button", { name: /remove address 1/i }));

    expect(screen.getByRole("button", { name: /add address/i })).toHaveFocus();
  });

  it("stops adding at the API's limit", () => {
    render(<AddressesField initial={Array.from({ length: MAX_ADDRESSES }, () => HOME)} />);

    expect(screen.getByRole("button", { name: /add address/i })).toBeDisabled();
  });

  it("follows a new initial list, as after a failed submission", async () => {
    const { rerender } = render(<AddressesField initial={[HOME]} />);
    await userEvent.type(within(rows()[0]).getByLabelText(/city/i), " Bay");

    rerender(<AddressesField initial={[WORK, HOME]} />);

    expect(rows()).toHaveLength(2);
    expect(within(rows()[0]).getByLabelText(/city/i)).toHaveValue("Arlington");
    expect(within(rows()[1]).getByLabelText(/city/i)).toHaveValue("San Francisco");
  });

  it("announces the list-level error", () => {
    render(<AddressesField initial={[HOME]} error="Address 1: City must be 120 characters or fewer" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Address 1");
  });
});
