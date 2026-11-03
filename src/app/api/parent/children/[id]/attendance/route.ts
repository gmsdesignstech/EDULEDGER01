import { NextResponse } from "next/server";
import { parentApiContext, parentNoStore } from "@/lib/parent-auth";
import { parentChildAttendance } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const context = await parentApiContext(id);
  if ("response" in context) return context.response;

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") || undefined;

  try {
    const data = await parentChildAttendance(context.user.institutionId, id, month);
    return NextResponse.json(data, { headers: parentNoStore });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load attendance." },
      { status: 400, headers: parentNoStore }
    );
  }
}

