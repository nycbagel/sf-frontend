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

  it("reports an unreachable API as 503 rather than crashing", async () => {
    server.use(
      http.get(api("/api/v1/contacts/:id/vcard"), () => HttpResponse.error()),
    );

    const res = await get("1");

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({
      detail: expect.stringContaining("Could not reach the API"),
    });
  });
});
