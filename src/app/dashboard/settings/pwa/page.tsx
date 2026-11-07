import type { Metadata } from "next";
import { PwaDiagnosticsClient } from "@/components/pwa-diagnostics-client";

export const metadata: Metadata = {
  title: "PWA & Push Diagnostics | EduLedger Settings",
  description: "Inspect Progressive Web App installation status, service worker health, and Firebase push configuration.",
};

export default function PwaSettingsPage() {
  return <PwaDiagnosticsClient />;
}
