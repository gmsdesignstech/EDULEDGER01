import { NextResponse } from "next/server";
import { parentApiContext, parentNoStore } from "@/lib/parent-auth";
import { parentChildTimetable } from "@/lib/db";

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
    const timetable = await parentChildTimetable(
      context.user.institutionId,
      child.className,
      child.section,
      child.academicYear
    );
    return NextResponse.json({ timetable }, { headers: parentNoStore });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load timetable." },
      { status: 400, headers: parentNoStore }
    );
  }
}

