export class ApiResponseError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ApiResponseError";
  }
}

type ErrorBody = { error?: unknown; message?: unknown };

function messageFrom(body: unknown, fallback: string) {
  if (body && typeof body === "object") {
    const value = body as ErrorBody;
    if (typeof value.message === "string" && value.message.trim()) return value.message;
    if (typeof value.error === "string" && value.error.trim()) return value.error;
  }
  return fallback;
}

/** Parse an API response without ever leaking JSON/HTML parser errors to the UI. */
export async function parseApiResponse<T>(response: Response, fallback = "The request could not be completed."): Promise<T> {
  const text = await response.text();
  let body: unknown = null;

  if (text.trim()) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new ApiResponseError(
        response.ok ? "The server returned an invalid response. Please try again." : fallback,
        response.status,
      );
    }
  }

  if (!response.ok) throw new ApiResponseError(messageFrom(body, fallback), response.status);
  if (body === null) throw new ApiResponseError("The server returned an empty response. Please try again.", response.status);
  return body as T;
}
