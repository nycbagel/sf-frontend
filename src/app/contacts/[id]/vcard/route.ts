import { ApiError, ApiUnreachableError } from "@/lib/apiClient";
import { apiErrorMessage, getContactVcard } from "@/lib/contacts/api";

type RouteContext = { params: Promise<{ id: string }> };

/** Response headers worth passing through from the API's vCard endpoint. */
const FILE_HEADERS = ["Content-Type", "Content-Disposition"] as const;

/** Shown to the browser; the real cause (which names the API URL) stays in the server log. */
const UNAVAILABLE = "Could not reach the Contacts API.";

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
  // Digits only: `parseInt` would read "1abc" as contact 1 and serve that card.
  const raw = (await params).id;
  if (!/^\d+$/.test(raw)) {
    return Response.json({ detail: "Contact not found" }, { status: 404 });
  }
  const id = Number(raw);
  if (id < 1 || !Number.isSafeInteger(id)) {
    return Response.json({ detail: "Contact not found" }, { status: 404 });
  }

  let upstream: Response | null;
  try {
    upstream = await getContactVcard(id);
  } catch (error) {
    if (error instanceof ApiUnreachableError) {
      console.error(error);
      return Response.json({ detail: UNAVAILABLE }, { status: 503 });
    }
    if (error instanceof ApiError) {
      // Anything the API refused for its own reasons (401, 403, 429, 5xx): keep
      // its status rather than turning a handled refusal into a route crash.
      console.error(error);
      return Response.json(
        { detail: apiErrorMessage(error, "The vCard could not be exported.") },
        { status: error.status },
      );
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
