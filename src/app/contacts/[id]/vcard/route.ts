import { ApiUnreachableError } from "@/lib/apiClient";
import { getContactVcard } from "@/lib/contacts/api";

type RouteContext = { params: Promise<{ id: string }> };

/** Response headers worth passing through from the API's vCard endpoint. */
const FILE_HEADERS = ["Content-Type", "Content-Disposition"] as const;

/**
 * `GET /contacts/[id]/vcard` — the contact as a `.vcf` download.
 *
 * The browser hits this same-origin route; the API is called from the server so
 * `API_BASE_URL` stays private, and the API's body and file headers are
 * streamed back unchanged. Errors use the API's own `{"detail": …}` shape.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext,
): Promise<Response> {
  const id = Number.parseInt((await params).id, 10);
  if (!Number.isInteger(id) || id < 1) {
    return Response.json({ detail: "Contact not found" }, { status: 404 });
  }

  let upstream: Response | null;
  try {
    upstream = await getContactVcard(id);
  } catch (error) {
    if (error instanceof ApiUnreachableError) {
      return Response.json({ detail: error.message }, { status: 503 });
    }
    throw error;
  }
  if (!upstream) {
    return Response.json({ detail: `Contact ${id} not found` }, { status: 404 });
  }

  const headers = new Headers({ "Cache-Control": "no-store" });
  for (const name of FILE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(upstream.body, { status: 200, headers });
}
