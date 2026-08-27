import { http, HttpResponse } from "msw";
import { server } from "../../mocks/server";
import { api } from "../../mocks/handlers";
import { GET } from "@/app/contacts/[id]/vcard/route";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function get(id: string) {
  return GET(new Request(`http://localhost/contacts/${id}/vcard`), {
    params: Promise.resolve({ id }),
  });
}

describe("GET /contacts/[id]/vcard", () => {
  it("streams the API's file with its content type and filename", async () => {
    const res = await get("1");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/vcard; charset=utf-8");
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="ada-lovelace.vcf"',
    );
    expect(res.headers.get("cache-control")).toBe("no-store");
    await expect(res.text()).resolves.toMatch(/^BEGIN:VCARD\r\n/);
  });

  it("is a 404 for an unknown contact", async () => {
    const res = await get("4242");

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ detail: "Contact 4242 not found" });
  });

  it.each(["abc", "0", "-1"])("is a 404 for the malformed id %p", async (id) => {
    const res = await get(id);
    expect(res.status).toBe(404);
  });

  it.each(["1abc", "1.5", " 1", "01x", "abc"])(
    "is a 404 for the malformed id %p rather than serving a nearby contact",
    async (id) => {
      // `parseInt` would read "1abc" as contact 1 and hand back Ada's card.
      const res = await get(id);

      expect(res.status).toBe(404);
      await expect(res.json()).resolves.toEqual({ detail: "Contact not found" });
    },
  );

  it("keeps the API's status when it refuses for its own reasons", async () => {
    server.use(
      http.get(api("/api/v1/contacts/:id/vcard"), () =>
        HttpResponse.json({ detail: "Too many requests" }, { status: 429 }),
      ),
    );

    const res = await get("1");

    expect(res.status).toBe(429);
    await expect(res.json()).resolves.toEqual({ detail: "Too many requests" });
  });

  it("reports an unreachable API as 503 rather than crashing", async () => {
    server.use(
      http.get(api("/api/v1/contacts/:id/vcard"), () => HttpResponse.error()),
    );

    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const res = await get("1");
    spy.mockRestore();

    expect(res.status).toBe(503);
    // The API's address never reaches the browser; it is logged server-side.
    await expect(res.json()).resolves.toEqual({ detail: "Could not reach the Contacts API." });
  });
});
