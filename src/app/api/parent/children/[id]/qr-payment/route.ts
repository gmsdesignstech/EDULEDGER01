import { NextResponse } from "next/server";
import { parentApiContext, parentNoStore } from "@/lib/parent-auth";
import { submitSchoolQrPayment } from "@/lib/db";
import { detectedImageMime } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const context = await parentApiContext(id);
  if ("response" in context) return context.response;

  try {
    const contentType = request.headers.get("content-type") || "";
    let feeId = "";
    let amount = 0;
    let utrNumber = "";
    let paymentDate = new Date().toISOString().slice(0, 10);
    let notes = "";
    let screenshotBuffer: Buffer | undefined;
    let screenshotMime: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      feeId = String(formData.get("feeId") || "").trim();
      amount = Number(formData.get("amount") || 0);
      utrNumber = String(formData.get("utrNumber") || "").trim();
      paymentDate = String(formData.get("paymentDate") || paymentDate).trim();
      notes = String(formData.get("notes") || "").trim();

      const file = formData.get("screenshot");
      if (file instanceof File && file.size > 0) {
        if (file.size > 5 * 1024 * 1024) {
          return NextResponse.json({ error: "Screenshot must be less than 5MB." }, { status: 400, headers: parentNoStore });
        }
        const buffer = Buffer.from(await file.arrayBuffer());
        const detected = detectedImageMime(buffer);
        if (!detected || !["image/png", "image/jpeg", "image/webp"].includes(detected)) {
          return NextResponse.json({ error: "Screenshot must be a valid PNG, JPG, or WebP image." }, { status: 400, headers: parentNoStore });
        }
        screenshotBuffer = buffer;
        screenshotMime = detected;
      }
    } else {
      const body = await request.json().catch(() => ({}));
      feeId = String(body.feeId || "").trim();
      amount = Number(body.amount || 0);
      utrNumber = String(body.utrNumber || "").trim();
      paymentDate = String(body.paymentDate || paymentDate).trim();
      notes = String(body.notes || "").trim();
    }

    if (!feeId) {
      return NextResponse.json({ error: "Fee invoice is required." }, { status: 400, headers: parentNoStore });
    }
    if (!utrNumber || utrNumber.length < 4 || utrNumber.length > 50) {
      return NextResponse.json({ error: "Please enter a valid UPI / UTR transaction reference number." }, { status: 400, headers: parentNoStore });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Payment amount must be greater than zero." }, { status: 400, headers: parentNoStore });
    }

    const payment = await submitSchoolQrPayment(context.user.institutionId, id, {
      feeId,
      amount,
      utrNumber,
      paymentDate,
      notes,
      screenshotBuffer,
      screenshotMime,
    });

    return NextResponse.json({ success: true, payment }, { headers: parentNoStore });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit payment verification." },
      { status: 400, headers: parentNoStore }
    );
  }
}

