import { NextResponse } from "next/server";
import { parentApiContext, parentNoStore } from "@/lib/parent-auth";
import { listModuleRecords } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const context = await parentApiContext();
  if ("response" in context) return context.response;

  try {
    const announcements = await listModuleRecords(context.user.institutionId, "announcements");
    return NextResponse.json({ announcements }, { headers: parentNoStore });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load announcements." },
      { status: 400, headers: parentNoStore }
    );
  }
}

