import { describe, expect, it } from "vitest";
import { readApiJson, ApiResponseError } from "@/lib/api-response";

describe("readApiJson", () => {
  it("accepts successful no-content responses", async () => {
    await expect(readApiJson(new Response(null, { status: 204 }))).resolves.toEqual({});
  });

  it("returns a useful error for an empty failed response", async () => {
    await expect(readApiJson(new Response(null, { status: 502 }))).resolves.toEqual({
      error: "The request failed (502).",
    });
  });

  it("does not expose the browser JSON parser error for an invalid success response", async () => {
    await expect(readApiJson(new Response("", { status: 200 }))).rejects.toMatchObject({
      name: "ApiResponseError",
      message: "The server returned an empty response. Please try again.",
    } satisfies Partial<ApiResponseError>);
    await expect(readApiJson(new Response("<html>gateway error</html>", { status: 200 }))).rejects.toMatchObject({
      name: "ApiResponseError",
      message: "The server returned an invalid response. Please try again.",
    } satisfies Partial<ApiResponseError>);
  });
});
