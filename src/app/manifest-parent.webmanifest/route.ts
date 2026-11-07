import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const manifest = {
    id: "/parent",
    name: "EduLedger - Parent Portal",
    short_name: "EduLedger Parent",
    description: "EduLedger Parent Portal for student attendance, fee payments, exam results, and announcements.",
    start_url: "/parent",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    orientation: "any",
    scope: "/parent",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Attendance",
        short_name: "Attendance",
        url: "/parent/attendance",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Fees & Payment",
        short_name: "Fees",
        url: "/parent/fees",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Exam Results",
        short_name: "Results",
        url: "/parent/results",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Homework",
        short_name: "Homework",
        url: "/parent/homework",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
    },
  });
}

