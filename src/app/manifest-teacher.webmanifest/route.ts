import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const manifest = {
    name: "EduLedger - Teacher Portal",
    short_name: "EduLedger Teacher",
    description: "EduLedger Teacher Portal for attendance, marks, homework, and timetable.",
    start_url: "/teacher",
    display: "standalone",
    background_color: "#0b1226",
    theme_color: "#2563eb",
    orientation: "any",
    scope: "/teacher",
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
        url: "/teacher/attendance",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Homework",
        short_name: "Homework",
        url: "/teacher/homework",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Marks Entry",
        short_name: "Marks",
        url: "/teacher/marks",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Timetable",
        short_name: "Timetable",
        url: "/teacher/timetable",
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

