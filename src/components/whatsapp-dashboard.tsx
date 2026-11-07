"use client";

import { readApiJson } from "@/lib/api-response";
import { useCallback, useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { CheckCheck, Clock3, FileText, MessageCircle, RefreshCw, Send, TriangleAlert } from "lucide-react";
import { WhatsAppConsentManager } from "./whatsapp-consent-manager";

type Configuration = {
  enabled: boolean;
  businessNumber: string;
  providerConfigured: boolean;
  provider?: "meta_cloud" | null;
  senderVerified?: boolean;
  connectivityVerified?: boolean;
  dispatchEnabled?: boolean;
  integrationState?: "not_configured" | "configuration_error" | "pending_verification" | "invalid_number" | "connected_unverified" | "dispatch_enabled_unverified" | "disconnected";
  configurationStatus: string;
  webhookStatus: string;
  autoAbsence: boolean;
  autoFeeReceipt: boolean;
  autoFeeReminder: boolean;
  autoMarksheet: boolean;
};

type Template = {
  id: string;
  name: string;
  category: string;
  language: string;
  providerTemplateName: string;
  enabled: boolean;
  variables: string[];
  approvalStatus?: string;
  rejectionReason?: string;
  lastSyncedAt?: string;
};

type Diagnostics={metrics:Record<string,number>;readiness:Record<string,boolean>};
type ScheduledItem={id:string;messageType:string;templateName:string;status:string;scheduledAt?:string;createdAt:string};

type Message = {
  id: string;
  studentName?: string;
  recipientName: string;
  recipientPhone: string;
  messageType: string;
  templateName: string;
  documentKind?: string;
  providerMessageId?: string;
  status: string;
  errorMessage?: string;
  sentBy: string;
  createdAt: string;
};

type DashboardData = {
  summary: Record<string, number>;
  items: Message[];
  templates: Template[];
  configuration: Configuration;
};

const inputClass = "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500";
const buttonClass = "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50";

function maskPhone(phone: string) {
  return phone.length > 6 ? `${phone.slice(0, 3)}••••${phone.slice(-3)}` : "••••••";
}

export function WhatsAppDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [diagnostics,setDiagnostics]=useState<Diagnostics|null>(null);
  const [scheduled,setScheduled]=useState<ScheduledItem[]>([]);
  const [ownerConfirmed,setOwnerConfirmed]=useState(false);
  const [template, setTemplate] = useState({ name: "", category: "Attendance", language: "en", providerTemplateName: "", enabled: true, variables: "" });

  const load = useCallback(async () => {
    setLoadError("");
    const [response,diagnosticResponse,scheduledResponse] = await Promise.all([fetch("/api/whatsapp/messages", { cache: "no-store" }),fetch("/api/whatsapp/diagnostics",{cache:"no-store"}),fetch("/api/whatsapp/scheduled",{cache:"no-store"})]);
    const text = await response.text();
    let body: DashboardData & { error?: string };
    try {
      body = text ? JSON.parse(text) : ({ error: "The server returned an empty response." } as DashboardData & { error?: string });
    } catch {
      body = { error: "The server returned an invalid response." } as DashboardData & { error?: string };
    }
    if (!response.ok) throw new Error(body.error || "Could not load WhatsApp dashboard.");
    setData(body);
    if(diagnosticResponse.ok)setDiagnostics(await readApiJson(diagnosticResponse));
    if(scheduledResponse.ok)setScheduled((await readApiJson(scheduledResponse)).items||[]);
  }, []);

  useEffect(() => {
    load().catch((error: Error) => setLoadError(error.message));
  }, [load]);

  async function saveConfiguration(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    setBusy(true);
    setNotice("");
    const response = await fetch("/api/whatsapp/configuration", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: data.configuration.enabled,
        businessNumber: data.configuration.businessNumber,
        ownerConfirmed,
        autoAbsence: data.configuration.autoAbsence,
        autoFeeReceipt: data.configuration.autoFeeReceipt,
        autoFeeReminder: data.configuration.autoFeeReminder,
        autoMarksheet: data.configuration.autoMarksheet,
      }),
    });
    const body = await readApiJson(response);
    setBusy(false);
    if (!response.ok) return setNotice(body.error || "Could not save configuration.");
    setData((current) => current ? { ...current, configuration: body.configuration } : current);
    setOwnerConfirmed(false);
    setNotice("WhatsApp notification settings saved.");
  }

  async function disconnect() {
    if (!window.confirm("Disconnect this school's WhatsApp configuration and disable its automations? Provider-side assets will not be changed.")) return;
    setBusy(true);
    setNotice("");
    const response=await fetch("/api/whatsapp/configuration",{method:"DELETE"});
    const body=await readApiJson(response);
    setBusy(false);
    if(!response.ok)return setNotice(body.error||"Could not disconnect WhatsApp configuration.");
    setData(current=>current?{...current,configuration:body.configuration}:current);
    setOwnerConfirmed(false);
    setNotice("EduLedger configuration disconnected. Provider-side registration was not changed.");
  }

  async function saveTemplate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    const response = await fetch("/api/whatsapp/templates", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...template, variables: template.variables.split(",").map((value) => value.trim()).filter(Boolean) }),
    });
    const body = await readApiJson(response);
    setBusy(false);
    if (!response.ok) return setNotice(body.error || "Could not save template.");
    setData((current) => current ? { ...current, templates: body.templates } : current);
    setTemplate({ name: "", category: "Attendance", language: "en", providerTemplateName: "", enabled: true, variables: "" });
    setNotice("Template mapping saved.");
  }

  async function retry(id: string) {
    setBusy(true);
    const response = await fetch("/api/whatsapp/messages", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    const body = await readApiJson(response);
    setBusy(false);
    if (!response.ok) return setNotice(body.error || "Retry failed.");
    await load();
    setNotice("Message queued for retry.");
  }

  if (loadError) return <div className="space-y-3 rounded-xl border border-red-200 bg-white p-6 text-sm text-red-700"><p>{loadError}</p><button type="button" className={buttonClass} onClick={() => load().catch((error: Error) => setLoadError(error.message))}><RefreshCw className="size-4" /> Retry</button></div>;
  if (!data) return <div className="rounded-xl border bg-white p-6 text-sm text-slate-600">Loading WhatsApp workspace…</div>;

  const metrics: Array<{ label: string; value: number; Icon: LucideIcon }> = [
    { label: "Today", value: data.summary.today || 0, Icon: MessageCircle },
    { label: "Queued", value: data.summary.queued || 0, Icon: Clock3 },
    { label: "Delivered", value: data.summary.delivered || 0, Icon: CheckCheck },
    { label: "Failed", value: data.summary.failed || 0, Icon: TriangleAlert },
    { label: "Documents", value: data.summary.documents || 0, Icon: FileText },
  ];

  const updateConfiguration = (patch: Partial<Configuration>) => setData({ ...data, configuration: { ...data.configuration, ...patch } });
  const approvedTemplateCount=data.templates.filter(item=>item.enabled&&item.approvalStatus==="APPROVED").length;
  const nextSetupAction=data.configuration.integrationState==="configuration_error"?"Ask the server operator to correct this institution's provider mapping in the secret manager.":!data.configuration.businessNumber?"Enter and attest an institution-owned business number.":!data.configuration.providerConfigured?"Complete provider onboarding and add this institution's server-side provider mapping.":!data.configuration.senderVerified?"Verify that the provider sender matches this institution's business number.":!approvedTemplateCount?"Map at least one provider-approved template.":!data.configuration.connectivityVerified?"Run the controlled sandbox connectivity test and retain evidence.":!data.configuration.dispatchEnabled?"Keep dispatch disabled until the release owner approves the test evidence.":"Dispatch is enabled; continue monitoring delivery and webhook evidence.";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">WhatsApp</h1>
        <p className="text-sm text-slate-600">Institution-scoped WhatsApp Business onboarding, consent controls, templates, and delivery tracking.</p>
      </div>

      <nav aria-label="WhatsApp workspace sections" className="flex gap-2 overflow-x-auto rounded-xl border bg-white p-2 text-sm shadow-sm">
        {["overview","readiness","templates","consent","history","scheduled","diagnostics","help"].map(item=><a key={item} href={`#wa-${item}`} className="whitespace-nowrap rounded-lg px-3 py-2 font-medium capitalize text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">{item}</a>)}
      </nav>

      <section id="wa-readiness" className="rounded-xl border bg-white p-5 shadow-sm" aria-labelledby="wa-readiness-title">
        <h2 id="wa-readiness-title" className="font-semibold text-slate-900">Integration readiness</h2>
        <p className="mt-1 text-xs text-slate-500">Configured values and verified external behavior are deliberately shown separately.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(diagnostics?.readiness||{}).map(([key,value])=><div key={key} className={`rounded-lg border p-3 text-sm ${value?"border-emerald-200 bg-emerald-50 text-emerald-900":"border-amber-200 bg-amber-50 text-amber-900"}`}><div className="font-medium">{key.replace(/([A-Z])/g," $1")}</div><div className="mt-1 text-xs">{value?"Available / observed":"Not externally verified"}</div></div>)}</div>
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Scheduling is database-backed, but the configured Vercel worker currently runs once daily. Delivery time precision is not verified.</div>
      </section>

      {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map(({ label, value, Icon }) => (
          <div key={label} className="rounded-xl border bg-white p-4 shadow-sm">
            <Icon className="mb-3 size-5 text-emerald-600" />
            <div className="text-2xl font-bold text-slate-900">{value}</div>
            <div className="text-xs text-slate-500">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <form id="wa-overview" onSubmit={saveConfiguration} className="space-y-4 rounded-xl border bg-white p-5 shadow-sm">
          <div>
            <h2 className="font-semibold text-slate-900">WhatsApp communication</h2>
            <p className="text-xs text-slate-500">Each institution needs its own authorized sender. Provider credentials remain server-only.</p>
          </div>
          <label className="block text-sm font-medium text-slate-700">Authorized business number<input required className={`${inputClass} mt-1`} inputMode="tel" placeholder="+91XXXXXXXXXX" value={data.configuration.businessNumber||""} onChange={event=>updateConfiguration({businessNumber:event.target.value,enabled:false})}/><span className="mt-1 block text-xs font-normal text-slate-500">Entering a number does not verify ownership or register it with WhatsApp.</span></label>
          <label className="flex items-start gap-2 text-sm"><input className="mt-1" type="checkbox" checked={ownerConfirmed} onChange={event=>setOwnerConfirmed(event.target.checked)}/><span>I confirm that my institution owns or is authorized to use this number. I understand provider verification is still required.</span></label>
          <div className={`rounded-lg border p-3 text-sm ${data.configuration.senderVerified ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>Connection: {data.configuration.configurationStatus}</div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800"><div>Provider: {data.configuration.provider==="meta_cloud"?"Meta Cloud API":"Not selected / configured"}</div><div className="mt-1 text-xs">Approved templates: {approvedTemplateCount}</div><div className="mt-2 font-medium">Next action</div><p className="mt-1 text-xs">{nextSetupAction}</p></div>
          <div className={`rounded-lg border p-3 text-sm ${data.configuration.dispatchEnabled ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>Dispatch: {data.configuration.dispatchEnabled ? "Explicitly enabled on server" : "Disabled pending controlled verification"}</div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950"><div className="font-medium">Supported onboarding</div><p className="mt-1 text-xs">Meta Cloud API, Twilio, and 360dialog all require official WhatsApp Business Platform authorization. A provider-managed signup can simplify the steps, but cannot remove Meta business and number verification.</p></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!data.configuration.senderVerified} checked={data.configuration.enabled} onChange={(event) => updateConfiguration({ enabled: event.target.checked })} /> Enable this institution after sender verification</label>
          <div className="grid gap-2 sm:grid-cols-2">
            {([
              ["autoAbsence", "Automatic absence alerts"],
              ["autoFeeReceipt", "Automatic fee receipts"],
              ["autoFeeReminder", "Automatic fee reminders"],
              ["autoMarksheet", "Automatic mark sheets"],
            ] as const).map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={data.configuration[key]} onChange={(event) => updateConfiguration({ [key]: event.target.checked })} /> {label}</label>)}
          </div>
          <div className="flex flex-wrap gap-2"><button className={buttonClass} disabled={busy||!ownerConfirmed}><Send className="size-4" /> Save settings</button><button type="button" onClick={disconnect} disabled={busy} className="inline-flex h-10 items-center justify-center rounded-lg border border-red-200 px-4 text-sm font-semibold text-red-700 disabled:opacity-50">Disconnect</button></div>
        </form>

        <form id="wa-templates" onSubmit={saveTemplate} className="space-y-4 rounded-xl border bg-white p-5 shadow-sm">
          <div>
            <h2 className="font-semibold text-slate-900">Approved template mapping</h2>
            <p className="text-xs text-slate-500">Map an EduLedger event to a template already approved in Meta Business Manager.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input required className={inputClass} placeholder="EduLedger name" value={template.name} onChange={(event) => setTemplate({ ...template, name: event.target.value })} />
            <input required className={inputClass} placeholder="Meta template_name" value={template.providerTemplateName} onChange={(event) => setTemplate({ ...template, providerTemplateName: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} />
            <select className={inputClass} value={template.category} onChange={(event) => setTemplate({ ...template, category: event.target.value })}><option>Attendance</option><option>Fees</option><option>Examinations</option><option>Timetable</option><option>Notices</option><option>Emergency</option><option>General</option></select>
            <input required className={inputClass} placeholder="Language (en)" value={template.language} onChange={(event) => setTemplate({ ...template, language: event.target.value })} />
          </div>
          <input className={inputClass} placeholder="Variables, comma-separated: student_name, date" value={template.variables} onChange={(event) => setTemplate({ ...template, variables: event.target.value.toLowerCase().replace(/[^a-z_, ]/g, "") })} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={template.enabled} onChange={(event) => setTemplate({ ...template, enabled: event.target.checked })} /> Enabled</label>
          <button className={buttonClass} disabled={busy}>Save template</button>
          <div className="space-y-2 border-t pt-3">
            {data.templates.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 text-sm"><span>{item.name} → <code>{item.providerTemplateName}</code></span><span className={item.approvalStatus==="APPROVED"&&item.enabled?"text-emerald-700":"text-amber-700"}>{item.enabled?item.approvalStatus||"Approval unknown":"Disabled"}</span></div>)}
          </div>
        </form>
      </div>

      <section id="wa-scheduled" className="overflow-hidden rounded-xl border bg-white shadow-sm"><div className="border-b p-5"><h2 className="font-semibold">Scheduled messages</h2><p className="text-xs text-slate-500">Only queued or scheduled jobs can be cancelled. Provider-accepted messages cannot be recalled.</p></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Message</th><th className="p-3">Scheduled</th><th className="p-3">State</th></tr></thead><tbody>{scheduled.filter(item=>item.status==="Scheduled").map(item=><tr className="border-t" key={item.id}><td className="p-3">{item.messageType}<div className="text-xs text-slate-500">{item.templateName}</div></td><td className="p-3">{item.scheduledAt?new Date(item.scheduledAt).toLocaleString():"Not scheduled"}</td><td className="p-3">{item.status}</td></tr>)}{!scheduled.some(item=>item.status==="Scheduled")&&<tr><td colSpan={3} className="p-8 text-center text-slate-500">No scheduled messages.</td></tr>}</tbody></table></div></section>

      <div id="wa-history" className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="border-b p-5"><h2 className="font-semibold text-slate-900">Message history</h2><p className="text-xs text-slate-500">Recipient numbers are masked. Meta status updates arrive through the signed webhook.</p></div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Recipient</th><th className="p-3">Message</th><th className="p-3">Status</th><th className="p-3">Sent by</th><th className="p-3">Created</th><th className="p-3" /></tr></thead>
            <tbody>
              {data.items.map((item) => <tr key={item.id} className="border-t"><td className="p-3"><div>{item.studentName || item.recipientName}</div><div className="text-xs text-slate-500">{maskPhone(item.recipientPhone)}</div></td><td className="p-3"><div>{item.messageType}</div><div className="text-xs text-slate-500">{item.templateName}{item.documentKind ? ` · ${item.documentKind}` : ""}</div></td><td className="p-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{item.status}</span>{item.errorMessage && <div className="mt-1 max-w-xs text-xs text-red-600">{item.errorMessage}</div>}</td><td className="p-3">{item.sentBy}</td><td className="p-3 whitespace-nowrap">{new Date(item.createdAt).toLocaleString()}</td><td className="p-3">{item.status === "Failed" && <button type="button" disabled={busy} onClick={() => retry(item.id)} className="inline-flex items-center gap-1 text-emerald-700"><RefreshCw className="size-4" /> Retry</button>}</td></tr>)}
              {!data.items.length && <tr><td colSpan={6} className="p-8 text-center text-slate-500">No WhatsApp messages have been queued.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <div id="wa-consent"><WhatsAppConsentManager /></div>
      <section id="wa-diagnostics" className="rounded-xl border bg-white p-5 shadow-sm"><h2 className="font-semibold">Operational diagnostics</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(diagnostics?.metrics||{}).map(([key,value])=><div key={key} className="rounded-lg bg-slate-50 p-3"><div className="text-2xl font-bold">{value}</div><div className="text-xs capitalize text-slate-500">{key.replace(/([A-Z])/g," $1")}</div></div>)}</div></section>
      <section id="wa-help" className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-950"><h2 className="font-semibold">Setup and safety notes</h2><ul className="mt-2 list-disc space-y-1 pl-5"><li>Provider credentials remain server-only and are never displayed here.</li><li>Entering a number is not onboarding. The authorized owner must complete official provider and Meta verification.</li><li>A manual click-to-chat link may open WhatsApp for a staff member, but EduLedger must not record that as an automated send or delivery.</li><li>Templates may contain only minimal notice fields. Detailed marks, fee balances, receipt data, addresses, and phone numbers are blocked.</li><li>Template approval, webhook reachability, and end-to-end delivery remain unverified until an authorized staging test succeeds.</li><li>Uncertain outcomes require manual provider-side review and must not be blindly retried.</li><li>Bulk confirmation remains unavailable until the campaign migration is reviewed and applied in an isolated staging database.</li></ul></section>
    </div>
  );
}
