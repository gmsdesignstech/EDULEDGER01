import { NextResponse } from "next/server";
import { parentApiContext, parentNoStore } from "@/lib/parent-auth";
import { parentChildOverview } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const context = await parentApiContext(id);
  if ("response" in context) return context.response;

  try {
    const overview = await parentChildOverview(context.user.institutionId, context.user.id, id);
    return NextResponse.json({ overview }, { headers: parentNoStore });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load overview." },
      { status: 400, headers: parentNoStore }
    );
  }
}

