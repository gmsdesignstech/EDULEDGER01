import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Parent Account Activation | EduLedger",
  manifest: "/parent/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "EduLedger Parent" },
  icons: {
    icon: "/icons/parent/icon-192.png",
    apple: "/icons/parent/apple-touch-icon.png",
  },
  robots: { index: false, follow: false },
};

export default function ParentActivateLayout({ children }: { children: React.ReactNode }) {
  return children;
}

