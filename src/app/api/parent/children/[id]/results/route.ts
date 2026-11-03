import { NextResponse } from "next/server";
import { parentApiContext, parentNoStore } from "@/lib/parent-auth";
import { parentChildResults } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const context = await parentApiContext(id);
  if ("response" in context) return context.response;

  try {
    const results = await parentChildResults(context.user.institutionId, id);
    return NextResponse.json({ results }, { headers: parentNoStore });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load examination results." },
      { status: 400, headers: parentNoStore }
    );
  }
}

