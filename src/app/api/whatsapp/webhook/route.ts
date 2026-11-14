// src/app/api/whatsapp/webhook/route.ts
/**
 * Official Meta WhatsApp Business Cloud API Webhook Handler.
 * Direct WhatsApp Cloud API — Single provider architecture without intermediaries.
 *
 * GET: Webhook challenge verification (hub.mode, hub.verify_token, hub.challenge)
 * POST: Incoming webhook delivery events with HMAC-SHA256 signature verification (X-Hub-Signature-256)
 */
import { processWhatsAppWebhookStatus } from "@/lib/db";
import { parseMetaWebhookStatuses, verifyMetaSignature, verifyMetaWebhookChallenge } from "@/lib/whatsapp";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const mode = q.get("hub.mode");
  const token = q.get("hub.verify_token");
  const challenge = q.get("hub.challenge");

  if (verifyMetaWebhookChallenge(mode, token)) {
    return new Response(challenge || "", { status: 200 });
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

  // Verify official Meta Cloud API signature (X-Hub-Signature-256)
  const signatureHeader = request.headers.get("x-hub-signature-256") || "";
  if (!verifyMetaSignature(raw, signatureHeader)) {
    return Response.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let statuses;
  try {
    statuses = parseMetaWebhookStatuses(raw);
  } catch {
    return Response.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  try {
    for (const status of statuses) {
      await processWhatsAppWebhookStatus(status);
    }
    return Response.json({ ok: true, provider: "whatsapp_cloud", processed: statuses.length });
  } catch {
    return Response.json({ error: "Webhook persistence failed." }, { status: 503 });
  }
}
