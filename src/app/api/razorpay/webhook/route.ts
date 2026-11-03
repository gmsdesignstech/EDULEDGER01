// Keep the legacy Razorpay webhook URL as an alias of the canonical handler.
// A single implementation prevents payment validation and idempotency rules
// from drifting between the two public endpoints.
export { POST } from "@/app/api/subscription/webhook/route";

export const runtime = "nodejs";
