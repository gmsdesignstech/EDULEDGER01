export interface PwaIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: "any" | "maskable" | "monochrome";
}

export interface PwaShortcut {
  name: string;
  short_name: string;
  description?: string;
  url: string;
  icons?: Array<{ src: string; sizes: string }>;
}

export interface PwaManifest {
  id: string;
  name: string;
  short_name: string;
  description: string;
  start_url: string;
  scope: string;
  display: "standalone" | "minimal-ui" | "fullscreen" | "browser";
  background_color: string;
  theme_color: string;
  orientation: "any" | "natural" | "landscape" | "portrait";
  icons: PwaIcon[];
  shortcuts?: PwaShortcut[];
}

export const TEACHER_MANIFEST: PwaManifest = {
  id: "/teacher",
  name: "EduLedger Teacher",
  short_name: "Teacher",
  description: "EduLedger Teacher Portal for attendance, marks, homework, and timetable.",
  start_url: "/teacher",
  scope: "/teacher/",
  display: "standalone",
  background_color: "#0f172a",
  theme_color: "#4f46e5",
  orientation: "any",
  icons: [
    {
      src: "/icons/teacher/icon-192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/icons/teacher/icon-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/icons/teacher/icon-maskable-192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "maskable",
    },
    {
      src: "/icons/teacher/icon-maskable-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
    {
      src: "/icons/teacher/icon.svg",
      sizes: "any",
      type: "image/svg+xml",
      purpose: "any",
    },
  ],
  shortcuts: [
    {
      name: "Attendance",
      short_name: "Attendance",
      url: "/teacher/attendance",
      icons: [{ src: "/icons/teacher/icon-192.png", sizes: "192x192" }],
    },
    {
      name: "Homework",
      short_name: "Homework",
      url: "/teacher/homework",
      icons: [{ src: "/icons/teacher/icon-192.png", sizes: "192x192" }],
    },
    {
      name: "Marks Entry",
      short_name: "Marks",
      url: "/teacher/marks",
      icons: [{ src: "/icons/teacher/icon-192.png", sizes: "192x192" }],
    },
    {
      name: "Timetable",
      short_name: "Timetable",
      url: "/teacher/timetable",
      icons: [{ src: "/icons/teacher/icon-192.png", sizes: "192x192" }],
    },
  ],
};

export const PARENT_MANIFEST: PwaManifest = {
  id: "/parent",
  name: "EduLedger Parent",
  short_name: "Parent",
  description: "EduLedger Parent Portal for student attendance, fee payments, exam results, and announcements.",
  start_url: "/parent",
  scope: "/parent/",
  display: "standalone",
  background_color: "#0f172a",
  theme_color: "#1d4ed8",
  orientation: "any",
  icons: [
    {
      src: "/icons/parent/icon-192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/icons/parent/icon-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/icons/parent/icon-maskable-192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "maskable",
    },
    {
      src: "/icons/parent/icon-maskable-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
    {
      src: "/icons/parent/icon.svg",
      sizes: "any",
      type: "image/svg+xml",
      purpose: "any",
    },
  ],
  shortcuts: [
    {
      name: "Attendance",
      short_name: "Attendance",
      url: "/parent/attendance",
      icons: [{ src: "/icons/parent/icon-192.png", sizes: "192x192" }],
    },
    {
      name: "Fees & Payment",
      short_name: "Fees",
      url: "/parent/fees",
      icons: [{ src: "/icons/parent/icon-192.png", sizes: "192x192" }],
    },
    {
      name: "Exam Results",
      short_name: "Results",
      url: "/parent/results",
      icons: [{ src: "/icons/parent/icon-192.png", sizes: "192x192" }],
    },
    {
      name: "Homework",
      short_name: "Homework",
      url: "/parent/homework",
      icons: [{ src: "/icons/parent/icon-192.png", sizes: "192x192" }],
    },
  ],
};

