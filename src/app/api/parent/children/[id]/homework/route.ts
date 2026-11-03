import { NextResponse } from "next/server";
import { parentApiContext, parentNoStore } from "@/lib/parent-auth";
import { parentChildHomework } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const context = await parentApiContext(id);
  if ("response" in context) return context.response;

  const child = context.children.find((c) => c.id === id);
  if (!child) {
    return NextResponse.json(
      { error: "Student not found." },
      { status: 404, headers: parentNoStore }
    );
  }

  try {
    const homework = await parentChildHomework(context.user.institutionId, child.className, child.section);
    return NextResponse.json({ homework }, { headers: parentNoStore });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load homework." },
      { status: 400, headers: parentNoStore }
    );
  }
}

