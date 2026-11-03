import { describe, expect, it } from "vitest";
import { ApiResponseError, parseApiResponse } from "../src/lib/api-response";

describe("API response parsing", () => {
  it("parses JSON success responses", async () => {
    await expect(parseApiResponse<{ ok: boolean }>(Response.json({ ok: true }))).resolves.toEqual({ ok: true });
  });

  it("uses structured API errors", async () => {
    await expect(parseApiResponse(Response.json({ message: "Validation failed" }, { status: 400 }))).rejects.toMatchObject({ message: "Validation failed", status: 400 });
  });

  it("hides non-JSON server and empty success responses", async () => {
    await expect(parseApiResponse(new Response("An error occurred", { status: 500 }), "Import failed.")).rejects.toEqual(new ApiResponseError("Import failed.", 500));
    await expect(parseApiResponse(new Response(null, { status: 204 }))).rejects.toMatchObject({ message: "The server returned an empty response. Please try again." });
    await expect(parseApiResponse(new Response("<html>upstream error</html>", { status: 200 }))).rejects.toMatchObject({ message: "The server returned an invalid response. Please try again." });
  });
});
