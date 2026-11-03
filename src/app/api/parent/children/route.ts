import { NextResponse } from "next/server";
import { parentApiContext, parentNoStore } from "@/lib/parent-auth";

export const runtime = "nodejs";

export async function GET() {
  const context = await parentApiContext();
  if ("response" in context) return context.response;

  return NextResponse.json(
    { children: context.children },
    { headers: parentNoStore }
  );
}

