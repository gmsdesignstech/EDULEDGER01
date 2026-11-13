import { NextResponse } from "next/server";
import { PARENT_MANIFEST } from "@/lib/pwa-manifests";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(PARENT_MANIFEST, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
    },
  });
}

