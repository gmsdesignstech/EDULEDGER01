import { notFound } from "next/navigation";
import { AdminSection } from "@/components/admin-section";

const routes: Record<string, string> = {
  dashboard: "overview",
  overview: "overview",
  schools: "schools",
  subscriptions: "subscriptions",
  "revenue-payments": "finance",
  users: "users",
  analytics: "analytics",
  notifications: "notifications",
  "system-health": "health",
  "audit-logs": "audit",
  settings: "settings",
  accounts: "users",
  "payment-transactions": "finance",
  refunds: "finance",
  "add-ons-features": "settings",
  security: "security",
  "admin-profile": "profile",
};

export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const view = routes[section];
  if (!view) notFound();
  return <AdminSection section={view} />;
}

