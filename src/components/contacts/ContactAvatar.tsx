import type { CSSProperties } from "react";
import { avatarHue, initials } from "@/lib/contacts/format";
import type { Contact } from "@/lib/contacts/types";

const SIZES = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
  xl: "h-20 w-20 text-2xl",
} as const;

/**
 * Round avatar: the contact's photo when there is one, otherwise their
 * initials tinted with a hue derived from their email.
 */
export default function ContactAvatar({
  contact,
  size = "md",
}: {
  contact: Pick<Contact, "first_name" | "last_name" | "email" | "photo">;
  size?: keyof typeof SIZES;
}) {
  const shape = `shrink-0 rounded-full ${SIZES[size]}`;

  if (contact.photo) {
    return (
      // A plain <img>: the source is an inline data URL, so there is nothing
      // for next/image to fetch, resize, or cache.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={contact.photo}
        alt={`Photo of ${contact.first_name} ${contact.last_name}`}
        className={`${shape} aspect-square object-cover ring-1 ring-border`}
      />
    );
  }

  const style = {
    "--avatar-hue": avatarHue(contact.email),
  } as CSSProperties;

  return (
    <span
      aria-hidden="true"
      style={style}
      className={`contact-avatar inline-flex select-none items-center justify-center font-display font-semibold ${shape}`}
    >
      {initials(contact)}
    </span>
  );
}
