import { processWhatsAppWebhookStatus } from "@/lib/db";
import { parseMetaWebhookStatuses, verifyMetaSignature, verifyMetaWebhookChallenge } from "@/lib/whatsapp";
import { verifyWebhookSignature } from "@/lib/whatsapp-n8n";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  if (verifyMetaWebhookChallenge(q.get("hub.mode"), q.get("hub.verify_token"))) {
    return new Response(q.get("hub.challenge") || "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(declaredLength) && declaredLength > 1_000_000) {
    return Response.json({ error: "Webhook payload is too large." }, { status: 413 });
  }
  const raw = await request.text();
  if (raw.length > 1_000_000) {
    return Response.json({ error: "Webhook payload is too large." }, { status: 413 });
  }

  // 1. Check if it's an n8n webhook callback
  const n8nSig = request.headers.get("x-eduledger-signature") || request.headers.get("x-n8n-signature");
  const timestampHeader = request.headers.get("x-eduledger-timestamp") || request.headers.get("x-n8n-timestamp");
  if (n8nSig && verifyWebhookSignature(raw, n8nSig, timestampHeader)) {
    try {
      const data = JSON.parse(raw);
      const updates = Array.isArray(data) ? data : data.statuses || [data];
      for (const item of updates) {
        if (item.providerMessageId && item.status) {
          const rawStatus = String(item.status).toLowerCase();
          const validStatus = (["sent", "delivered", "read", "failed"].includes(rawStatus)
            ? rawStatus
            : "sent") as "sent" | "delivered" | "read" | "failed";
          await processWhatsAppWebhookStatus({
            providerMessageId: String(item.providerMessageId),
            status: validStatus,
            timestamp: item.timestamp ? new Date(item.timestamp) : new Date(),
            errorCode: item.errorCode ? String(item.errorCode) : "",
            errorMessage: item.errorMessage ? String(item.errorMessage) : "",
          });
        }
      }
      return Response.json({ ok: true, source: "n8n" });
    } catch {
      return Response.json({ error: "Invalid n8n status payload" }, { status: 400 });
    }
  }

  // 2. Otherwise verify Meta Cloud API signature
  if (!verifyMetaSignature(raw, request.headers.get("x-hub-signature-256") || "")) {
    return Response.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let statuses;
  try {
    statuses = parseMetaWebhookStatuses(raw);
  } catch {
    return Response.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  try {
    for (const status of statuses) await processWhatsAppWebhookStatus(status);
    return Response.json({ ok: true, source: "meta" });
  } catch {
    return Response.json({ error: "Webhook persistence failed." }, { status: 503 });
  }
}
