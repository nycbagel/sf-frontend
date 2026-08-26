import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Pencil } from "lucide-react";
import AddressTypeBadge from "@/components/contacts/AddressTypeBadge";
import ContactAvatar from "@/components/contacts/ContactAvatar";
import DeleteContactButton from "@/components/contacts/DeleteContactButton";
import { buttonClasses } from "@/components/ui/Button";
import { getContact } from "@/lib/contacts/api";
import { addressLine, formatTimestamp, jobLine } from "@/lib/contacts/format";
import { ADDRESS_TYPES, type Address } from "@/lib/contacts/types";

type PageProps = { params: Promise<{ id: string }> };

function parseId(raw: string): number {
  const id = Number.parseInt(raw, 10);
  if (!Number.isInteger(id) || id < 1) notFound();
  return id;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const contact = await getContact(parseId((await params).id));
  return {
    title: contact?.full_name ?? "Contact not found",
    description: contact ? jobLine(contact) ?? undefined : undefined,
  };
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-hairline px-4 py-3 last:border-b-0 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm text-foreground">
        {children ?? <span className="text-muted-foreground/50">—</span>}
      </dd>
    </div>
  );
}

/** Addresses grouped by kind — home, then work, then other — one badge per group. */
function AddressGroups({ addresses }: { addresses: Address[] }) {
  return (
    <div className="space-y-2">
      {ADDRESS_TYPES.map((type) => {
        const group = addresses.filter((address) => address.type === type);
        if (group.length === 0) return null;
        return (
          <div key={type} className="flex flex-wrap items-start gap-2">
            <AddressTypeBadge type={type} />
            <ul className="min-w-0 space-y-1">
              {group.map((address) => (
                <li key={address.id}>
                  <address className="not-italic">{addressLine(address)}</address>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export default async function ContactDetailPage({ params }: PageProps) {
  const contact = await getContact(parseId((await params).id));
  if (!contact) notFound();

  const subtitle = jobLine(contact);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Link
        href="/contacts"
        className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        All contacts
      </Link>

      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <ContactAvatar contact={contact} size="xl" />
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              {contact.full_name}
            </h1>
            {subtitle ? (
              <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/contacts/${contact.id}/edit`}
            className={buttonClasses("secondary")}
          >
            <Pencil className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            Edit
          </Link>
          <DeleteContactButton
            contactId={contact.id}
            contactName={contact.full_name}
            redirectToList
            variant="danger"
            size="md"
            withLabel
          />
        </div>
      </header>

      <dl className="rounded-lg border border-border bg-card">
        <Row label="Email">
          <a href={`mailto:${contact.email}`} className="text-primary hover:underline">
            {contact.email}
          </a>
        </Row>
        <Row label="Phone">
          {contact.phone ? (
            <a href={`tel:${contact.phone}`} className="text-primary hover:underline">
              {contact.phone}
            </a>
          ) : null}
        </Row>
        <Row label="Company">{contact.company}</Row>
        <Row label="Job title">{contact.job_title}</Row>
        <Row label="Addresses">
          {contact.addresses.length > 0 ? (
            <AddressGroups addresses={contact.addresses} />
          ) : null}
        </Row>
        <Row label="Notes">
          {contact.notes ? (
            <span className="whitespace-pre-wrap">{contact.notes}</span>
          ) : null}
        </Row>
      </dl>

      <dl className="rounded-lg border border-border bg-card/50 text-[13px]">
        <Row label="ID">
          <span className="font-mono">{contact.id}</span>
        </Row>
        <Row label="Created">
          <span className="font-mono">{formatTimestamp(contact.created_at)}</span>
        </Row>
        <Row label="Last updated">
          <span className="font-mono">{formatTimestamp(contact.updated_at)}</span>
        </Row>
      </dl>
    </div>
  );
}
