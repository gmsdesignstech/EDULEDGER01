"use client";

import { readApiJson } from "@/lib/api-response";
import { useEffect, useState } from "react";

type Recipient = {
  id: string;
  name: string;
  parent: string;
  parentWhatsapp: string;
  whatsappEnabled: boolean;
  whatsappAttendance: boolean;
  whatsappAcademics: boolean;
  whatsappFees: boolean;
  whatsappNotices: boolean;
  whatsappGeneral: boolean;
};

const options = [
  ["whatsappAttendance", "Attendance"],
  ["whatsappAcademics", "Results"],
  ["whatsappFees", "Fees"],
  ["whatsappNotices", "Announcements"],
  ["whatsappGeneral", "Other updates"],
] as const;

function masked(value: string) {
  return value.length > 6 ? `${value.slice(0, 3)}••••${value.slice(-3)}` : "Not available";
}

export function WhatsAppConsentManager() {
  const [items, setItems] = useState<Recipient[]>([]);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/api/whatsapp/consent", { cache: "no-store" })
      .then(async response => {
        const body = await readApiJson(response);
        if (!response.ok) throw new Error(body.error || "Could not load consent settings.");
        setItems(body.recipients || []);
      })
      .catch(error => setNotice(error instanceof Error ? error.message : "Could not load consent settings."));
  }, []);

  function change(id: string, key: keyof Recipient, checked: boolean) {
    setItems(current => current.map(item => item.id === id ? { ...item, [key]: checked } : item));
  }

  async function save(item: Recipient) {
    setBusy(item.id);
    setNotice("");
    const response = await fetch("/api/whatsapp/consent", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    const body = await readApiJson(response);
    setBusy("");
    setNotice(response.ok ? `Consent settings saved for ${item.name}.` : body.error || "Could not save consent settings.");
  }

  return <section className="rounded-xl border bg-white p-5 shadow-sm">
    <h2 className="font-semibold text-slate-900">Parent consent and preferences</h2>
    <p className="mb-4 text-xs text-slate-500">Messages are blocked server-side unless consent and the relevant category are enabled.</p>
    {notice && <p className="mb-3 rounded-lg bg-slate-50 p-3 text-sm">{notice}</p>}
    <div className="max-h-96 space-y-3 overflow-y-auto">
      {items.map(item => <div key={item.id} className="rounded-lg border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><b className="text-sm">{item.name}</b><p className="text-xs text-slate-500">{item.parent} · {masked(item.parentWhatsapp)}</p></div>
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={item.whatsappEnabled} onChange={event => change(item.id, "whatsappEnabled", event.target.checked)} /> Parent consented</label>
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          {options.map(([key, label]) => <label key={key} className="flex items-center gap-1 text-xs"><input type="checkbox" disabled={!item.whatsappEnabled} checked={item.whatsappEnabled && item[key]} onChange={event => change(item.id, key, event.target.checked)} /> {label}</label>)}
          <button type="button" disabled={busy === item.id} onClick={() => save(item)} className="ml-auto rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{busy === item.id ? "Saving…" : "Save"}</button>
        </div>
      </div>)}
      {!items.length && <p className="py-6 text-center text-sm text-slate-500">No active students.</p>}
    </div>
  </section>;
}
