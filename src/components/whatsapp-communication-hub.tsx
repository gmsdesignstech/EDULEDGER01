"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Phone,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Filter,
  MessageCircle,
  ExternalLink,
  RefreshCw,
  GraduationCap,
  CalendarCheck2,
  IndianRupee,
  FileCheck2,
  BookOpen,
  CalendarDays,
  Megaphone,
  MessageSquare,
  Users,
  Send,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  FileText,
  Edit2,
  Trash2,
  Check,
  Layers3,
  HelpCircle,
  X,
  Radio,
  Copy,
  Zap,
  UserCheck,
  UserX,
  FileCode,
  Download,
  AlertTriangle,
  Server,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import {
  WHATSAPP_CATEGORIES,
  DEFAULT_TEMPLATES,
  renderWhatsAppTemplate,
  type WhatsAppCategory,
} from "@/lib/whatsapp-click-to-chat";
import type {
  WhatsAppStudentListItem,
  WhatsAppCommunicationStats,
} from "@/lib/whatsapp-click-to-chat-db";
import { WhatsAppShareModal } from "./whatsapp-share-modal";
import { readApiJson } from "@/lib/api-response";
import { N8N_WORKFLOWS_CATALOG, type N8nWorkflowMeta } from "@/lib/whatsapp-n8n-definitions";
import { SYSTEM_TEMPLATES } from "@/lib/whatsapp-templates";

interface WhatsAppCommunicationHubProps {
  userRole?: string;
  isTeacherView?: boolean;
}

export function WhatsAppCommunicationHub({
  userRole = "SCHOOL_ADMIN",
  isTeacherView = false,
}: WhatsAppCommunicationHubProps) {
  const [activeTab, setActiveTab] = useState<
    "students" | "contacts" | "workflows" | "history" | "templates"
  >("students");

  // Integration & Server status state
  const [integrationStatus, setIntegrationStatus] = useState<any>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  // Student list state (Click-to-chat / instant share)
  const [students, setStudents] = useState<WhatsAppStudentListItem[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("ALL");
  const [sectionFilter, setSectionFilter] = useState("ALL");
  const [hasWhatsAppFilter, setHasWhatsAppFilter] = useState<"all" | "yes" | "no">("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Parent Contacts & Consent state
  const [contacts, setContacts] = useState<any[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [contactClassFilter, setContactClassFilter] = useState("ALL");
  const [contactConsentFilter, setContactConsentFilter] = useState("ALL");
  const [editingContact, setEditingContact] = useState<any | null>(null);
  const [savingContact, setSavingContact] = useState(false);

  // Live Communication History state (from /api/whatsapp/history)
  const [history, setHistory] = useState<Array<Record<string, any>>>([]);
  const [totalHistory, setTotalHistory] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyStatusFilter, setHistoryStatusFilter] = useState("ALL");
  const [historySearch, setHistorySearch] = useState("");

  // Templates state
  const [templates, setTemplates] = useState<
    Array<{
      id: string;
      category: WhatsAppCategory;
      title: string;
      content: string;
      isCustom: boolean;
      isDefault: boolean;
    }>
  >([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateLangFilter, setTemplateLangFilter] = useState<"all" | "en" | "kn">("all");
  const [editingTemplate, setEditingTemplate] = useState<{
    id?: string;
    category: WhatsAppCategory;
    title: string;
    content: string;
  } | null>(null);
  const [templateSaving, setTemplateSaving] = useState(false);

  // Workflow JSON Viewer Modal state
  const [viewingWorkflow, setViewingWorkflow] = useState<N8nWorkflowMeta | null>(null);
  const [workflowJsonString, setWorkflowJsonString] = useState("");
  const [copiedWorkflow, setCopiedWorkflow] = useState(false);

  // Quick Share Modal state
  const [modalStudentId, setModalStudentId] = useState<string | null>(null);
  const [modalStudentName, setModalStudentName] = useState<string>("");
  const [modalCategory, setModalCategory] = useState<WhatsAppCategory>("STUDENT_INFO");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Toast notice
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 1. Fetch Integration Status & Stats
  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await fetch("/api/whatsapp/status", { cache: "no-store" });
      if (res.ok) {
        const data = await readApiJson(res);
        setIntegrationStatus(data);
      }
    } catch (err) {
      console.error("Error loading whatsapp status:", err);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  // 2. Fetch Students (for instant student sharing)
  const loadStudents = useCallback(async () => {
    setStudentsLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String((page - 1) * pageSize),
        hasWhatsApp: hasWhatsAppFilter,
      });
      if (classFilter !== "ALL") params.set("className", classFilter);
      if (sectionFilter !== "ALL") params.set("section", sectionFilter);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/whatsapp/click-to-chat/students?${params.toString()}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await readApiJson(res);
        setStudents(data.students || []);
        setTotalStudents(data.total || 0);
      }
    } catch (err) {
      console.error("Error loading students:", err);
    } finally {
      setStudentsLoading(false);
    }
  }, [page, classFilter, sectionFilter, hasWhatsAppFilter, search]);

  // 3. Fetch Parent Contacts & Consent
  const loadContacts = useCallback(async () => {
    setContactsLoading(true);
    try {
      const params = new URLSearchParams();
      if (contactClassFilter !== "ALL") params.set("class", contactClassFilter);
      if (contactConsentFilter !== "ALL") params.set("consent", contactConsentFilter);
      if (contactSearch.trim()) params.set("search", contactSearch.trim());

      const res = await fetch(`/api/whatsapp/contacts?${params.toString()}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await readApiJson(res);
        setContacts(data.contacts || []);
      }
    } catch (err) {
      console.error("Error loading parent contacts:", err);
    } finally {
      setContactsLoading(false);
    }
  }, [contactClassFilter, contactConsentFilter, contactSearch]);

  // 4. Fetch Message History (Live status tracking)
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({
        limit: "50",
        page: "1",
      });
      if (historyStatusFilter !== "ALL") params.set("status", historyStatusFilter);
      if (historySearch.trim()) params.set("search", historySearch.trim());

      const res = await fetch(`/api/whatsapp/history?${params.toString()}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await readApiJson(res);
        setHistory(data.items || []);
        setTotalHistory(data.pagination?.total || 0);
      }
    } catch (err) {
      console.error("Error loading message history:", err);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyStatusFilter, historySearch]);

  // 5. Fetch Templates
  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const res = await fetch("/api/whatsapp/click-to-chat/templates", { cache: "no-store" });
      if (res.ok) {
        const data = await readApiJson(res);
        setTemplates(data.templates || []);
      }
    } catch (err) {
      console.error("Error loading templates:", err);
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadStudents();
  }, [loadStatus, loadStudents]);

  useEffect(() => {
    if (activeTab === "contacts") loadContacts();
    if (activeTab === "history") loadHistory();
    if (activeTab === "templates") loadTemplates();
  }, [activeTab, loadContacts, loadHistory, loadTemplates]);

  // Distinct class names for filters
  const classOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of students) {
      if (s.className) set.add(s.className);
    }
    for (const c of contacts) {
      if (c.className) set.add(c.className);
    }
    return Array.from(set).sort();
  }, [students, contacts]);

  // Open share modal helper
  const handleOpenShare = (student: { id: string; name: string }, cat: WhatsAppCategory = "STUDENT_INFO") => {
    setModalStudentId(student.id);
    setModalStudentName(student.name);
    setModalCategory(cat);
    setIsModalOpen(true);
  };

  // Save Contact & Consent Changes
  const handleSaveContact = async () => {
    if (!editingContact) return;
    setSavingContact(true);
    try {
      const res = await fetch("/api/whatsapp/contacts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: editingContact.studentId,
          parentPhone: editingContact.rawPhone,
          consentGranted: editingContact.hasConsent,
          attendance: editingContact.categories?.attendance ?? true,
          academics: editingContact.categories?.academics ?? true,
          fees: editingContact.categories?.fees ?? true,
          notices: editingContact.categories?.notices ?? true,
          general: editingContact.categories?.general ?? true,
        }),
      });
      if (!res.ok) {
        const err = await readApiJson(res);
        throw new Error(err.error || "Failed to update contact.");
      }
      showToast("Parent WhatsApp contact & consent updated!");
      setEditingContact(null);
      loadContacts();
      loadStatus();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update contact.");
    } finally {
      setSavingContact(false);
    }
  };

  // Opt-out a parent
  const handleOptOut = async (studentId: string, studentName: string) => {
    if (!confirm(`Are you sure you want to opt-out the parent of ${studentName}? Automated and manual WhatsApp messages will be blocked.`)) {
      return;
    }
    try {
      const res = await fetch("/api/whatsapp/opt-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, reason: "MANUAL_STAFF_RECORDED" }),
      });
      if (res.ok) {
        showToast(`Parent of ${studentName} has been opted out.`);
        loadContacts();
        loadStatus();
      } else {
        const err = await readApiJson(res);
        alert(err.error || "Failed to process opt-out.");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to opt-out.");
    }
  };

  // Save Template handler
  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;
    setTemplateSaving(true);
    try {
      const res = await fetch("/api/whatsapp/click-to-chat/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingTemplate),
      });
      if (!res.ok) {
        const err = await readApiJson(res);
        throw new Error(err.error || "Failed to save template.");
      }
      showToast("Template saved successfully!");
      setEditingTemplate(null);
      loadTemplates();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save template.");
    } finally {
      setTemplateSaving(false);
    }
  };

  // Open Workflow JSON viewer modal
  const handleOpenWorkflowModal = (wf: N8nWorkflowMeta) => {
    setViewingWorkflow(wf);
    setCopiedWorkflow(false);
    // Build standard importable n8n workflow JSON structure
    const sampleJson = {
      name: `${wf.code} – EduLedger ${wf.name}`,
      description: wf.summary,
      nodes: [
        {
          parameters: {
            httpMethod: "POST",
            path: `${wf.trigger.replace(".", "-")}-webhook`,
            options: {},
          },
          name: `Webhook – ${wf.name}`,
          type: "n8n-nodes-base.webhook",
          typeVersion: 1,
          position: [180, 300],
        },
        {
          parameters: {
            conditions: {
              boolean: [
                { value1: "={{ $json.parent.hasConsent }}", value2: true },
                { value1: "={{ $json.parent.optedOut }}", value2: false },
              ],
              string: [{ value1: "={{ $json.eventType }}", value2: wf.trigger }],
            },
          },
          name: "Verify Consent & Event",
          type: "n8n-nodes-base.if",
          typeVersion: 1,
          position: [420, 300],
        },
        {
          parameters: {
            method: "POST",
            url: "https://graph.facebook.com/v19.0/{{WHATSAPP_PHONE_NUMBER_ID}}/messages",
            sendHeaders: true,
            headerParameters: {
              parameters: [
                { name: "Authorization", value: "Bearer {{WHATSAPP_ACCESS_TOKEN}}" },
                { name: "Content-Type", value: "application/json" },
              ],
            },
            sendBody: true,
            specifyBody: "json",
            jsonBody: "={\n  \"messaging_product\": \"whatsapp\",\n  \"recipient_type\": \"individual\",\n  \"to\": \"{{ $json.parent.phone.replace(/\\D/g, '') }}\",\n  \"type\": \"text\",\n  \"text\": { \"body\": {{ JSON.stringify($json.template.renderedMessage) }} }\n}",
          },
          name: "Send WhatsApp via Cloud API",
          type: "n8n-nodes-base.httpRequest",
          typeVersion: 4.1,
          position: [680, 240],
        },
        {
          parameters: {
            method: "POST",
            url: "{{EDULEDGER_WEBHOOK_URL}}/api/whatsapp/webhook",
            sendHeaders: true,
            headerParameters: {
              parameters: [
                { name: "Content-Type", value: "application/json" },
                { name: "X-EduLedger-Signature", value: "{{EDULEDGER_WEBHOOK_SECRET}}" },
              ],
            },
            sendBody: true,
            specifyBody: "json",
            jsonBody: "={\n  \"providerMessageId\": \"{{ $json.messages ? $json.messages[0].id : '' }}\",\n  \"status\": \"sent\",\n  \"timestamp\": \"{{ new Date().toISOString() }}\",\n  \"eventType\": \"${wf.trigger}\"\n}",
          },
          name: "Status Callback to EduLedger",
          type: "n8n-nodes-base.httpRequest",
          typeVersion: 4.1,
          position: [920, 240],
        },
      ],
      connections: {
        [`Webhook – ${wf.name}`]: { main: [[{ node: "Verify Consent & Event", type: "main", index: 0 }]] },
        "Verify Consent & Event": { main: [[{ node: "Send WhatsApp via Cloud API", type: "main", index: 0 }]] },
        "Send WhatsApp via Cloud API": { main: [[{ node: "Status Callback to EduLedger", type: "main", index: 0 }]] },
      },
    };
    setWorkflowJsonString(JSON.stringify(sampleJson, null, 2));
  };

  const copyWorkflowJson = () => {
    navigator.clipboard.writeText(workflowJsonString);
    setCopiedWorkflow(true);
    setTimeout(() => setCopiedWorkflow(false), 3000);
  };

  const metrics = integrationStatus?.metrics || {};
  const env = integrationStatus?.environment || {};
  const isN8nConfigured = env.n8nConfigured;
  const isWhatsAppConfigured = env.whatsappConfigured;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[90] flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-xl animate-in fade-in slide-in-from-bottom-3">
          <Check className="size-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-200/60 bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900 p-6 text-white shadow-xl dark:border-emerald-950 sm:p-8">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold backdrop-blur-md">
                <span className="size-2 rounded-full bg-emerald-300 animate-pulse" />
                n8n + WhatsApp Cloud API Integration
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-100">
                <ShieldCheck className="size-3" /> E.164 Validated
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-100">
                <Zap className="size-3" /> Zero Paid Middleware
              </span>
            </div>

            <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
              WhatsApp Parent Communication System
            </h1>
            <p className="mt-1.5 text-sm text-emerald-100/90 leading-relaxed">
              Automate student notifications—absence alerts, fee reminders, payment receipts, exam marks, homework & announcements—directly to parents via official WhatsApp Cloud API and n8n workflows with full consent & multi-school data isolation.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              onClick={() => {
                loadStatus();
                if (activeTab === "contacts") loadContacts();
                if (activeTab === "history") loadHistory();
                if (activeTab === "students") loadStudents();
                showToast("Data refreshed.");
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-bold text-white hover:bg-white/20 transition backdrop-blur-md"
            >
              <RefreshCw className={`size-3.5 ${statusLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Readiness Badges */}
        <div className="mt-6 grid grid-cols-2 gap-3 pt-5 border-t border-white/15 sm:grid-cols-4">
          <div className="flex items-center gap-2.5 rounded-xl bg-white/10 p-3 backdrop-blur-md">
            <div className={`grid size-7 place-items-center rounded-lg ${isN8nConfigured ? "bg-emerald-500 text-white" : "bg-amber-400 text-slate-900"}`}>
              <Server className="size-4" />
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-200">n8n Engine</div>
              <div className="text-xs font-bold text-white">
                {isN8nConfigured ? "Webhook Configured" : "Standby / Direct"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-xl bg-white/10 p-3 backdrop-blur-md">
            <div className={`grid size-7 place-items-center rounded-lg ${env.state === "Configured and Enabled" ? "bg-emerald-500 text-white" : env.state === "Configured but Disabled" ? "bg-amber-400 text-slate-900" : "bg-sky-400 text-slate-900"}`}>
              <Zap className="size-4" />
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-200">System Lifecycle</div>
              <div className="text-xs font-bold text-white">
                {env.state || (isWhatsAppConfigured ? "Cloud API Configured" : "Click-to-Chat Active")}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-xl bg-white/10 p-3 backdrop-blur-md">
            <div className="grid size-7 place-items-center rounded-lg bg-emerald-500 text-white">
              <UserCheck className="size-4" />
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-200">Active Consents</div>
              <div className="text-xs font-bold text-white">
                {metrics.consentsGranted ?? 0} Granted
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-xl bg-white/10 p-3 backdrop-blur-md">
            <div className="grid size-7 place-items-center rounded-lg bg-emerald-500 text-white">
              <CheckCircle2 className="size-4" />
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-200">Delivered Msgs</div>
              <div className="text-xs font-bold text-white">
                {metrics.messagesDelivered ?? 0} Messages
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="dashboard-card p-4">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-bold uppercase tracking-wider">Parent Contacts</span>
            <Phone className="size-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-foreground">{metrics.totalContacts ?? 0}</div>
          <div className="mt-1 text-[11px] text-muted">Active parent mobile numbers</div>
        </div>

        <div className="dashboard-card p-4">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-bold uppercase tracking-wider">Consent Granted</span>
            <UserCheck className="size-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-600">{metrics.consentsGranted ?? 0}</div>
          <div className="mt-1 text-[11px] text-muted">Compliant for notifications</div>
        </div>

        <div className="dashboard-card p-4">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-bold uppercase tracking-wider">Consent Pending</span>
            <Clock className="size-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-amber-500">{metrics.consentsPending ?? 0}</div>
          <div className="mt-1 text-[11px] text-muted">Unset / Needs review</div>
        </div>

        <div className="dashboard-card p-4">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-bold uppercase tracking-wider">Messages Sent</span>
            <Send className="size-4 text-sky-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-foreground">{metrics.messagesSent ?? 0}</div>
          <div className="mt-1 text-[11px] text-muted">Dispatched through system</div>
        </div>

        <div className="dashboard-card p-4">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-bold uppercase tracking-wider">Delivered</span>
            <CheckCircle2 className="size-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-600">{metrics.messagesDelivered ?? 0}</div>
          <div className="mt-1 text-[11px] text-muted">Verified delivered & read</div>
        </div>

        <div className="dashboard-card p-4">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-bold uppercase tracking-wider">Failed</span>
            <AlertCircle className="size-4 text-red-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-red-500">{metrics.messagesFailed ?? 0}</div>
          <div className="mt-1 text-[11px] text-muted">Invalid phone / rejected</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border bg-panel p-1.5 shadow-sm">
        <button
          onClick={() => setActiveTab("students")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
            activeTab === "students"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-muted hover:bg-canvas hover:text-foreground"
          }`}
        >
          <Send className="size-3.5" />
          <span>Students & Instant Share</span>
        </button>

        <button
          onClick={() => setActiveTab("contacts")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
            activeTab === "contacts"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-muted hover:bg-canvas hover:text-foreground"
          }`}
        >
          <Users className="size-3.5" />
          <span>Parent Contacts & Consent</span>
        </button>

        <button
          onClick={() => setActiveTab("workflows")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
            activeTab === "workflows"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-muted hover:bg-canvas hover:text-foreground"
          }`}
        >
          <Zap className="size-3.5" />
          <span>n8n Automated Workflows</span>
          <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px] font-extrabold">8</span>
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
            activeTab === "history"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-muted hover:bg-canvas hover:text-foreground"
          }`}
        >
          <Clock className="size-3.5" />
          <span>Message Logs & Delivery</span>
        </button>

        <button
          onClick={() => setActiveTab("templates")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
            activeTab === "templates"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-muted hover:bg-canvas hover:text-foreground"
          }`}
        >
          <FileText className="size-3.5" />
          <span>Message Templates (EN / KN)</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: STUDENTS & INSTANT SHARE (Click-to-chat + Event Dispatch)          */}
      {/* ========================================================================= */}
      {activeTab === "students" && (
        <div className="space-y-4">
          <div className="dashboard-card p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 flex-wrap items-center gap-2">
                <div className="relative min-w-[220px] flex-1">
                  <Search className="absolute left-3 top-2.5 size-4 text-muted" />
                  <input
                    type="text"
                    placeholder="Search by student name, parent or admission number..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    className="h-9 w-full rounded-xl border bg-canvas pl-9 pr-3 text-xs outline-none focus:border-emerald-500"
                  />
                </div>

                <select
                  value={classFilter}
                  onChange={(e) => {
                    setClassFilter(e.target.value);
                    setPage(1);
                  }}
                  className="h-9 rounded-xl border bg-canvas px-3 text-xs outline-none focus:border-emerald-500"
                >
                  <option value="ALL">All Classes</option>
                  {classOptions.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                <select
                  value={hasWhatsAppFilter}
                  onChange={(e) => {
                    setHasWhatsAppFilter(e.target.value as any);
                    setPage(1);
                  }}
                  className="h-9 rounded-xl border bg-canvas px-3 text-xs outline-none focus:border-emerald-500"
                >
                  <option value="all">All Contacts</option>
                  <option value="yes">Has WhatsApp Number</option>
                  <option value="no">Missing WhatsApp Number</option>
                </select>
              </div>

              <div className="text-xs text-muted">
                Showing {students.length} of {totalStudents} students
              </div>
            </div>
          </div>

          {/* Student Table */}
          <div className="dashboard-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-canvas/80 text-[11px] font-bold uppercase tracking-wider text-muted border-b">
                  <tr>
                    <th className="p-3.5">Student</th>
                    <th className="p-3.5">Class & Section</th>
                    <th className="p-3.5">Parent / Guardian</th>
                    <th className="p-3.5">WhatsApp Mobile</th>
                    <th className="p-3.5">Consent Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {studentsLoading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted">
                        <RefreshCw className="mx-auto size-5 animate-spin text-emerald-600 mb-2" />
                        Loading student records...
                      </td>
                    </tr>
                  ) : students.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted">
                        No students match the current filters.
                      </td>
                    </tr>
                  ) : (
                    students.map((student) => {
                      const hasPhone = Boolean(student.parentPhone && student.parentPhone.trim().length >= 10);
                      return (
                        <tr key={student.id} className="hover:bg-canvas/50 transition">
                          <td className="p-3.5">
                            <div className="font-bold text-foreground">{student.name}</div>
                            <div className="text-[11px] text-muted">Adm: {student.admission} • Roll: {student.rollNumber || "—"}</div>
                          </td>
                          <td className="p-3.5">
                            <span className="inline-flex rounded-lg bg-canvas px-2.5 py-1 font-semibold text-foreground border">
                              {student.className} - {student.section}
                            </span>
                          </td>
                          <td className="p-3.5 font-medium text-foreground">
                            {student.parent || "Parent"}
                          </td>
                          <td className="p-3.5">
                            {hasPhone ? (
                              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                                {student.maskedPhone}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-600">
                                <AlertTriangle className="size-3" /> Missing Phone
                              </span>
                            )}
                          </td>
                          <td className="p-3.5">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600">
                              <CheckCircle2 className="size-3" /> Active
                            </span>
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              onClick={() => handleOpenShare(student, "STUDENT_INFO")}
                              className="btn-primary h-8 px-3 text-xs font-bold gap-1.5"
                            >
                              <MessageCircle className="size-3.5" />
                              Share via WhatsApp
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalStudents > pageSize && (
              <div className="flex items-center justify-between p-3.5 border-t text-xs text-muted">
                <div>Page {page} of {Math.ceil(totalStudents / pageSize)}</div>
                <div className="flex items-center gap-1">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="btn-secondary h-8 w-8 p-0 grid place-items-center disabled:opacity-40"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    disabled={page >= Math.ceil(totalStudents / pageSize)}
                    onClick={() => setPage((p) => p + 1)}
                    className="btn-secondary h-8 w-8 p-0 grid place-items-center disabled:opacity-40"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PARENT CONTACTS & CONSENT MANAGEMENT                                */}
      {/* ========================================================================= */}
      {activeTab === "contacts" && (
        <div className="space-y-4">
          <div className="dashboard-card p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 flex-wrap items-center gap-2">
                <div className="relative min-w-[220px] flex-1">
                  <Search className="absolute left-3 top-2.5 size-4 text-muted" />
                  <input
                    type="text"
                    placeholder="Search parent name, student, or phone..."
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    className="h-9 w-full rounded-xl border bg-canvas pl-9 pr-3 text-xs outline-none focus:border-emerald-500"
                  />
                </div>

                <select
                  value={contactClassFilter}
                  onChange={(e) => setContactClassFilter(e.target.value)}
                  className="h-9 rounded-xl border bg-canvas px-3 text-xs outline-none focus:border-emerald-500"
                >
                  <option value="ALL">All Classes</option>
                  {classOptions.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                <select
                  value={contactConsentFilter}
                  onChange={(e) => setContactConsentFilter(e.target.value)}
                  className="h-9 rounded-xl border bg-canvas px-3 text-xs outline-none focus:border-emerald-500"
                >
                  <option value="ALL">All Consent States</option>
                  <option value="GRANTED">Consent Granted</option>
                  <option value="PENDING">Consent Pending</option>
                  <option value="OPTED_OUT">Opted Out</option>
                </select>
              </div>

              <div className="text-xs text-muted">
                {contacts.length} parent contacts loaded
              </div>
            </div>
          </div>

          <div className="dashboard-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-canvas/80 text-[11px] font-bold uppercase tracking-wider text-muted border-b">
                  <tr>
                    <th className="p-3.5">Parent / Guardian</th>
                    <th className="p-3.5">Associated Student</th>
                    <th className="p-3.5">Normalized Mobile (E.164)</th>
                    <th className="p-3.5">Number Validity</th>
                    <th className="p-3.5">Consent Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {contactsLoading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted">
                        <RefreshCw className="mx-auto size-5 animate-spin text-emerald-600 mb-2" />
                        Loading parent contacts...
                      </td>
                    </tr>
                  ) : contacts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted">
                        No contacts found.
                      </td>
                    </tr>
                  ) : (
                    contacts.map((contact) => (
                      <tr key={contact.studentId} className="hover:bg-canvas/50 transition">
                        <td className="p-3.5">
                          <div className="font-bold text-foreground">{contact.parentName}</div>
                          <div className="text-[11px] text-muted">Country: {contact.countryCode}</div>
                        </td>
                        <td className="p-3.5">
                          <div className="font-semibold text-foreground">{contact.studentName}</div>
                          <div className="text-[11px] text-muted">{contact.className} - {contact.section} • Adm: {contact.admissionNumber}</div>
                        </td>
                        <td className="p-3.5 font-mono text-xs">
                          {contact.maskedPhone}
                        </td>
                        <td className="p-3.5">
                          {contact.isValidNumber ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-extrabold text-emerald-600">
                              <Check className="size-3" /> Valid Indian Format
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-extrabold text-red-600">
                              <AlertCircle className="size-3" /> Needs Correction
                            </span>
                          )}
                        </td>
                        <td className="p-3.5">
                          {contact.isOptedOut ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-extrabold text-red-600">
                              <UserX className="size-3" /> Opted Out
                            </span>
                          ) : contact.hasConsent ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-extrabold text-emerald-600">
                              <UserCheck className="size-3" /> Consent Granted
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-extrabold text-amber-600">
                              <Clock className="size-3" /> Pending Record
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => setEditingContact({ ...contact })}
                              className="btn-secondary h-8 px-2.5 text-xs font-semibold"
                              title="Edit Phone & Consent"
                            >
                              <Edit2 className="size-3.5" /> Edit
                            </button>
                            {!contact.isOptedOut && (
                              <button
                                onClick={() => handleOptOut(contact.studentId, contact.studentName)}
                                className="btn-secondary h-8 px-2 text-xs font-semibold text-red-600 hover:border-red-300"
                                title="Opt Out Parent"
                              >
                                <UserX className="size-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Edit Contact Modal */}
          {editingContact && (
            <div className="fixed inset-0 z-[85] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm">
              <div className="w-full max-w-lg rounded-3xl border bg-panel p-6 shadow-2xl">
                <div className="flex items-center justify-between pb-3 border-b">
                  <h3 className="text-base font-bold text-foreground">
                    Edit WhatsApp Contact & Consent
                  </h3>
                  <button onClick={() => setEditingContact(null)}>
                    <X className="size-5" />
                  </button>
                </div>

                <div className="mt-4 space-y-4">
                  <div>
                    <div className="text-xs text-muted">Student:</div>
                    <div className="text-sm font-bold text-foreground">{editingContact.studentName} ({editingContact.className} - {editingContact.section})</div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      Parent WhatsApp Mobile Number:
                    </label>
                    <input
                      type="tel"
                      value={editingContact.rawPhone || ""}
                      onChange={(e) => setEditingContact({ ...editingContact, rawPhone: e.target.value })}
                      placeholder="+919876543210 or 10-digit mobile"
                      className="h-10 w-full rounded-xl border bg-canvas px-3 text-xs font-mono outline-none focus:border-emerald-500"
                    />
                    <span className="text-[11px] text-muted mt-1 block">
                      Indian numbers will be automatically formatted to +91 international standard.
                    </span>
                  </div>

                  <div className="rounded-xl border bg-canvas p-3 space-y-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingContact.hasConsent}
                        onChange={(e) => setEditingContact({ ...editingContact, hasConsent: e.target.checked })}
                        className="rounded"
                      />
                      <span>Parent Communication Consent Established</span>
                    </label>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingContact.categories?.attendance ?? true}
                          onChange={(e) => setEditingContact({
                            ...editingContact,
                            categories: { ...editingContact.categories, attendance: e.target.checked },
                          })}
                        />
                        <span>Attendance Alerts</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingContact.categories?.fees ?? true}
                          onChange={(e) => setEditingContact({
                            ...editingContact,
                            categories: { ...editingContact.categories, fees: e.target.checked },
                          })}
                        />
                        <span>Fee Reminders</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingContact.categories?.academics ?? true}
                          onChange={(e) => setEditingContact({
                            ...editingContact,
                            categories: { ...editingContact.categories, academics: e.target.checked },
                          })}
                        />
                        <span>Marks & Homework</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingContact.categories?.notices ?? true}
                          onChange={(e) => setEditingContact({
                            ...editingContact,
                            categories: { ...editingContact.categories, notices: e.target.checked },
                          })}
                        />
                        <span>School Notices</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-end gap-2 pt-3 border-t">
                  <button
                    onClick={() => setEditingContact(null)}
                    className="btn-secondary h-9 px-4 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={savingContact}
                    onClick={handleSaveContact}
                    className="btn-primary h-9 px-4 text-xs font-bold"
                  >
                    {savingContact ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: n8n AUTOMATION WORKFLOWS (Workflows A to H)                         */}
      {/* ========================================================================= */}
      {activeTab === "workflows" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-xs text-sky-950 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-200">
            <div className="flex items-start gap-3">
              <Zap className="size-5 text-sky-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-sm">How n8n Automation Works with EduLedger:</span>
                <p className="leading-relaxed">
                  EduLedger triggers signed HTTP webhooks when school events happen. n8n executes the logic, validates student consent, retrieves parent details, formats messages, and delivers them directly via the official WhatsApp Business Cloud API.
                </p>
                <div className="flex flex-wrap gap-3 pt-1 font-mono text-[11px]">
                  <span>• Webhook Auth: HMAC-SHA256</span>
                  <span>• Target: Official Cloud API</span>
                  <span>• Retry: Exponential Backoff</span>
                  <span>• Workflows: 8 Ready to Import</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {N8N_WORKFLOWS_CATALOG.map((wf) => (
              <div key={wf.id} className="dashboard-card flex flex-col justify-between p-5 hover:border-emerald-300 transition">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-lg bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] font-black text-emerald-600">
                      {wf.code}
                    </span>
                    <span className="rounded-full bg-canvas px-2 py-0.5 text-[10px] font-bold text-muted border">
                      {wf.category}
                    </span>
                  </div>

                  <h3 className="mt-2.5 text-sm font-bold text-foreground">
                    {wf.name}
                  </h3>
                  <p className="mt-1 text-[11px] text-muted line-clamp-2">
                    {wf.summary}
                  </p>

                  <div className="mt-3 rounded-xl bg-canvas p-2.5 text-[11px]">
                    <span className="font-bold text-muted block mb-1">Trigger Event:</span>
                    <code className="text-emerald-600 font-mono text-[10px]">{wf.trigger}</code>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t flex items-center justify-between">
                  <button
                    onClick={() => handleOpenWorkflowModal(wf)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700"
                  >
                    <FileCode className="size-3.5" /> View / Copy JSON
                  </button>
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
              </div>
            ))}
          </div>

          {/* Workflow JSON Modal */}
          {viewingWorkflow && (
            <div className="fixed inset-0 z-[85] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm">
              <div className="w-full max-w-3xl rounded-3xl border bg-panel p-6 shadow-2xl">
                <div className="flex items-center justify-between pb-3 border-b">
                  <div>
                    <h3 className="text-base font-bold text-foreground">
                      {viewingWorkflow.code}: {viewingWorkflow.name} (n8n Workflow JSON)
                    </h3>
                    <p className="text-xs text-muted mt-0.5">
                      Copy and import this JSON directly into your n8n workspace via &quot;Import from JSON&quot;.
                    </p>
                  </div>
                  <button onClick={() => setViewingWorkflow(null)}>
                    <X className="size-5" />
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-muted">File: {viewingWorkflow.filename}</span>
                    <button
                      onClick={copyWorkflowJson}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition"
                    >
                      {copiedWorkflow ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      {copiedWorkflow ? "Copied to Clipboard!" : "Copy Workflow JSON"}
                    </button>
                  </div>

                  <pre className="max-h-96 overflow-y-auto rounded-2xl border bg-slate-950 p-4 font-mono text-[11px] text-emerald-300 leading-relaxed">
                    {workflowJsonString}
                  </pre>
                </div>

                <div className="mt-4 pt-3 border-t flex items-center justify-end">
                  <button
                    onClick={() => setViewingWorkflow(null)}
                    className="btn-secondary h-9 px-4 text-xs font-semibold"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: MESSAGE LOGS & DELIVERY TRACKING (Live from DB)                    */}
      {/* ========================================================================= */}
      {activeTab === "history" && (
        <div className="space-y-4">
          <div className="dashboard-card p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 flex-wrap items-center gap-2">
                <div className="relative min-w-[220px] flex-1">
                  <Search className="absolute left-3 top-2.5 size-4 text-muted" />
                  <input
                    type="text"
                    placeholder="Search message history by student or recipient..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="h-9 w-full rounded-xl border bg-canvas pl-9 pr-3 text-xs outline-none focus:border-emerald-500"
                  />
                </div>

                <select
                  value={historyStatusFilter}
                  onChange={(e) => setHistoryStatusFilter(e.target.value)}
                  className="h-9 rounded-xl border bg-canvas px-3 text-xs outline-none focus:border-emerald-500"
                >
                  <option value="ALL">All Delivery Statuses</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Sent">Sent</option>
                  <option value="Queued">Queued / Sending</option>
                  <option value="Failed">Failed</option>
                </select>
              </div>

              <div className="text-xs text-muted">
                {totalHistory} total communication records
              </div>
            </div>
          </div>

          <div className="dashboard-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-canvas/80 text-[11px] font-bold uppercase tracking-wider text-muted border-b">
                  <tr>
                    <th className="p-3.5">Recipient (Masked)</th>
                    <th className="p-3.5">Student</th>
                    <th className="p-3.5">Category / Template</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Dispatched By</th>
                    <th className="p-3.5">Date & Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {historyLoading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted">
                        <RefreshCw className="mx-auto size-5 animate-spin text-emerald-600 mb-2" />
                        Loading communication history...
                      </td>
                    </tr>
                  ) : history.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted">
                        No WhatsApp communication records found.
                      </td>
                    </tr>
                  ) : (
                    history.map((item) => {
                      const isDelivered = item.status === "Delivered" || item.status === "Read";
                      const isFailed = item.status === "Failed";
                      const isQueued = item.status === "Queued" || item.status === "Sending";

                      return (
                        <tr key={item.id} className="hover:bg-canvas/50 transition">
                          <td className="p-3.5">
                            <div className="font-bold text-foreground">{item.recipientName}</div>
                            <div className="font-mono text-[11px] text-muted">{item.recipientPhone}</div>
                          </td>
                          <td className="p-3.5">
                            <div className="font-semibold text-foreground">{item.studentName || "—"}</div>
                            <div className="text-[11px] text-muted">{item.className} {item.section}</div>
                          </td>
                          <td className="p-3.5">
                            <div className="font-semibold text-foreground">{item.messageType}</div>
                            <div className="text-[11px] text-muted font-mono">{item.templateName}</div>
                          </td>
                          <td className="p-3.5">
                            {isDelivered ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-600">
                                <CheckCircle2 className="size-3" /> Delivered
                              </span>
                            ) : isFailed ? (
                              <div>
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-[10px] font-extrabold text-red-600">
                                  <AlertCircle className="size-3" /> Failed
                                </span>
                                {item.errorMessage && (
                                  <div className="text-[10px] text-red-500 mt-0.5 max-w-xs truncate" title={item.errorMessage}>
                                    {item.errorMessage}
                                  </div>
                                )}
                              </div>
                            ) : isQueued ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-600">
                                <Clock className="size-3" /> {item.status}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2.5 py-0.5 text-[10px] font-extrabold text-sky-600">
                                <Send className="size-3" /> {item.status}
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-muted">
                            {item.sentBy || "System Auto"}
                          </td>
                          <td className="p-3.5 text-muted whitespace-nowrap">
                            {new Date(item.createdAt).toLocaleString("en-IN", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: MESSAGE TEMPLATES (English, Kannada, Custom)                        */}
      {/* ========================================================================= */}
      {activeTab === "templates" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground">Message Templates</h2>
              <p className="text-xs text-muted">Multi-language WhatsApp templates with verified placeholders.</p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={templateLangFilter}
                onChange={(e) => setTemplateLangFilter(e.target.value as any)}
                className="h-8 rounded-xl border bg-canvas px-3 text-xs outline-none focus:border-emerald-500"
              >
                <option value="all">All Languages</option>
                <option value="en">English Templates</option>
                <option value="kn">ಕನ್ನಡ (Kannada) Templates</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SYSTEM_TEMPLATES.filter((t) => templateLangFilter === "all" || t.language === templateLangFilter).map((tmpl) => (
              <div key={tmpl.id} className="dashboard-card flex flex-col justify-between p-5">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-lg bg-canvas px-2.5 py-0.5 font-bold text-[10px] uppercase text-muted border">
                      {tmpl.category}
                    </span>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                      {tmpl.languageName}
                    </span>
                  </div>

                  <h3 className="mt-2 text-sm font-bold text-foreground">{tmpl.title}</h3>

                  <div className="mt-3 rounded-xl border bg-canvas p-3 font-mono text-[11px] leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {tmpl.body}
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t flex flex-wrap gap-1 text-[10px] text-muted">
                  <span className="font-bold">Placeholders:</span>
                  {tmpl.placeholders.slice(0, 4).map((p) => (
                    <code key={p} className="bg-canvas px-1 rounded">{`{{${p}}}`}</code>
                  ))}
                  {tmpl.placeholders.length > 4 && <span>+{tmpl.placeholders.length - 4} more</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Global WhatsApp Share Modal (Click-to-chat + Send Event) */}
      {modalStudentId && (
        <WhatsAppShareModal
          isOpen={isModalOpen}
          studentId={modalStudentId}
          studentName={modalStudentName}
          initialCategory={modalCategory}
          userRole={userRole}
          onClose={() => {
            setIsModalOpen(false);
            setModalStudentId(null);
          }}
          onShareInitiated={(cat, phone) => {
            showToast(`WhatsApp communication initiated for ${modalStudentName} (${cat})`);
            loadStatus();
            if (activeTab === "history") loadHistory();
          }}
        />
      )}
    </div>
  );
}
