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
  Settings,
  RotateCw,
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
    "students" | "contacts" | "history" | "templates" | "configuration"
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
  const [retryingId, setRetryingId] = useState<string | null>(null);

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
  }, [page, classFilter, sectionFilter, search, hasWhatsAppFilter]);

  // 3. Fetch Parent Contacts & Consent
  const loadContacts = useCallback(async () => {
    setContactsLoading(true);
    try {
      const params = new URLSearchParams({
        limit: "100",
        consent: contactConsentFilter,
      });
      if (contactClassFilter !== "ALL") params.set("className", contactClassFilter);
      if (contactSearch.trim()) params.set("search", contactSearch.trim());

      const res = await fetch(`/api/whatsapp/contacts?${params.toString()}`, { cache: "no-store" });
      if (res.ok) {
        const data = await readApiJson(res);
        setContacts(data.contacts || []);
      }
    } catch (err) {
      console.error("Error loading contacts:", err);
    } finally {
      setContactsLoading(false);
    }
  }, [contactClassFilter, contactConsentFilter, contactSearch]);

  // 4. Fetch Communication History (from DB)
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({
        page: "1",
        limit: "50",
        status: historyStatusFilter,
      });
      if (historySearch.trim()) params.set("search", historySearch.trim());

      const res = await fetch(`/api/whatsapp/history?${params.toString()}`, { cache: "no-store" });
      if (res.ok) {
        const data = await readApiJson(res);
        setHistory(data.messages || []);
        setTotalHistory(data.pagination?.total || 0);
      }
    } catch (err) {
      console.error("Error loading history:", err);
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

  // Retry a failed message directly via Cloud API
  const handleRetryMessage = async (messageId: string) => {
    setRetryingId(messageId);
    try {
      const res = await fetch("/api/whatsapp/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: messageId }),
      });
      const data = await readApiJson(res);
      if (res.ok) {
        showToast("Message retry initiated successfully.");
        loadHistory();
        loadStatus();
      } else {
        showToast(`Retry failed: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      showToast("Network error while retrying message.");
    } finally {
      setRetryingId(null);
    }
  };

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
    students.forEach((s) => {
      if (s.className) set.add(s.className);
    });
    return Array.from(set).sort();
  }, [students]);

  const openShareModal = (studentId: string, studentName: string, category: WhatsAppCategory) => {
    setModalStudentId(studentId);
    setModalStudentName(studentName);
    setModalCategory(category);
    setIsModalOpen(true);
  };

  // Save Contact & Consent
  const handleSaveContact = async () => {
    if (!editingContact) return;
    setSavingContact(true);
    try {
      const res = await fetch("/api/whatsapp/contacts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: editingContact.studentId,
          parentPhone: editingContact.parentPhone,
          parentWhatsapp: editingContact.parentWhatsapp,
          consentStatus: editingContact.consentStatus,
          notes: editingContact.notes || "Updated via Communication Hub",
        }),
      });
      if (res.ok) {
        showToast("Contact and consent updated successfully.");
        setEditingContact(null);
        loadContacts();
        loadStatus();
      } else {
        const err = await readApiJson(res);
        showToast(`Failed to update: ${err.error || "Unknown error"}`);
      }
    } catch (err) {
      showToast("Network error updating contact.");
    } finally {
      setSavingContact(false);
    }
  };

  // Save Custom Template
  const handleSaveTemplate = async () => {
    if (!editingTemplate || !editingTemplate.title.trim() || !editingTemplate.content.trim()) {
      showToast("Please provide both title and template content.");
      return;
    }
    setTemplateSaving(true);
    try {
      const res = await fetch("/api/whatsapp/click-to-chat/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingTemplate),
      });
      if (res.ok) {
        showToast("Custom template saved.");
        setEditingTemplate(null);
        loadTemplates();
      } else {
        const err = await readApiJson(res);
        showToast(`Error: ${err.error || "Could not save template"}`);
      }
    } catch (err) {
      showToast("Network error saving template.");
    } finally {
      setTemplateSaving(false);
    }
  };

  const env = integrationStatus?.environment || {};
  const metrics = integrationStatus?.metrics || {};
  const isDirectCloudConfigured = Boolean(env.configured && env.whatsappConfigured);
  const isDispatchReady = Boolean(env.ready);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-2xl transition animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-slate-400 hover:text-white">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Top Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-800 via-teal-900 to-slate-950 p-6 text-white shadow-xl sm:p-8">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 size-80 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute left-1/3 bottom-0 size-60 rounded-full bg-teal-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300 border border-emerald-400/30">
                <MessageCircle className="size-3.5" /> Direct WhatsApp Cloud API
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-100">
                <ShieldCheck className="size-3" /> Meta Cloud API
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-100">
                <Zap className="size-3" /> Zero Intermediaries
              </span>
            </div>

            <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
              WhatsApp Parent Communication System
            </h1>
            <p className="mt-1.5 text-sm text-emerald-100/90 leading-relaxed">
              Send instant, authorized student communications—absence alerts, fee reminders, payment receipts, exam marks, homework & announcements—directly to verified parent WhatsApp numbers with tenant isolation and consent management.
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
            <div
              className={`grid size-7 place-items-center rounded-lg ${
                isDirectCloudConfigured ? "bg-emerald-500 text-white" : "bg-amber-400 text-slate-900"
              }`}
            >
              <Server className="size-4" />
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-200">
                Provider Architecture
              </div>
              <div className="text-xs font-bold text-white">
                {isDirectCloudConfigured ? "Direct Cloud API" : "Pending Setup"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-xl bg-white/10 p-3 backdrop-blur-md">
            <div
              className={`grid size-7 place-items-center rounded-lg ${
                isDispatchReady
                  ? "bg-emerald-500 text-white"
                  : isDirectCloudConfigured
                  ? "bg-amber-400 text-slate-900"
                  : "bg-sky-400 text-slate-900"
              }`}
            >
              <Zap className="size-4" />
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-200">
                Dispatch Status
              </div>
              <div className="text-xs font-bold text-white">
                {env.state || (isDirectCloudConfigured ? "Configured" : "Not Configured")}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-xl bg-white/10 p-3 backdrop-blur-md">
            <div className="grid size-7 place-items-center rounded-lg bg-emerald-500 text-white">
              <UserCheck className="size-4" />
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-200">
                Active Consents
              </div>
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
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-200">
                Delivered Messages
              </div>
              <div className="text-xs font-bold text-white">
                {metrics.messagesDelivered ?? 0} Delivered
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Overview Cards (Strict User Requirements) */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="dashboard-card p-4">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-bold uppercase tracking-wider">Total Messages</span>
            <Send className="size-4 text-sky-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-foreground">
            {metrics.messagesInitiated ?? 0}
          </div>
          <div className="mt-1 text-[11px] text-muted">Dispatched messages</div>
        </div>

        <div className="dashboard-card p-4">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-bold uppercase tracking-wider">Delivered</span>
            <CheckCircle2 className="size-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-600">
            {metrics.messagesDelivered ?? 0}
          </div>
          <div className="mt-1 text-[11px] text-muted">Successfully delivered</div>
        </div>

        <div className="dashboard-card p-4">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-bold uppercase tracking-wider">Read Messages</span>
            <MessageSquare className="size-4 text-teal-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-teal-600">
            {metrics.messagesRead ?? 0}
          </div>
          <div className="mt-1 text-[11px] text-muted">Confirmed read by parent</div>
        </div>

        <div className="dashboard-card p-4">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-bold uppercase tracking-wider">Failed</span>
            <AlertCircle className="size-4 text-red-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-red-500">
            {metrics.messagesFailed ?? 0}
          </div>
          <div className="mt-1 text-[11px] text-muted">Eligible for retry</div>
        </div>

        <div className="dashboard-card p-4">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-bold uppercase tracking-wider">Pending</span>
            <Clock className="size-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-amber-500">
            {metrics.messagesQueued ?? 0}
          </div>
          <div className="mt-1 text-[11px] text-muted">In dispatch queue</div>
        </div>

        <div className="dashboard-card p-4">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-bold uppercase tracking-wider">Opted-Out</span>
            <UserX className="size-4 text-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-rose-500">
            {metrics.optedOut ?? 0}
          </div>
          <div className="mt-1 text-[11px] text-muted">Do Not Contact list</div>
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
          <span>Send Individual Message</span>
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
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
            activeTab === "history"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-muted hover:bg-canvas hover:text-foreground"
          }`}
        >
          <Clock className="size-3.5" />
          <span>Message History & Delivery</span>
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
          <span>Approved Templates</span>
        </button>

        {!isTeacherView && (
          <button
            onClick={() => setActiveTab("configuration")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
              activeTab === "configuration"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-muted hover:bg-canvas hover:text-foreground"
            }`}
          >
            <Settings className="size-3.5" />
            <span>Direct API Configuration</span>
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: SEND INDIVIDUAL MESSAGE / STUDENTS DIRECT DISPATCH                 */}
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
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Search by student, parent name, admission or phone..."
                    className="h-9 w-full rounded-xl border bg-canvas pl-9 pr-3 text-xs outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="absolute right-2.5 top-2.5 text-muted hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>

                <select
                  value={classFilter}
                  onChange={(e) => {
                    setClassFilter(e.target.value);
                    setPage(1);
                  }}
                  className="h-9 rounded-xl border bg-canvas px-3 text-xs font-semibold outline-none focus:border-emerald-500"
                >
                  <option value="ALL">All Classes</option>
                  {classOptions.map((c) => (
                    <option key={c} value={c}>
                      Class {c}
                    </option>
                  ))}
                </select>

                <select
                  value={hasWhatsAppFilter}
                  onChange={(e) => {
                    setHasWhatsAppFilter(e.target.value as any);
                    setPage(1);
                  }}
                  className="h-9 rounded-xl border bg-canvas px-3 text-xs font-semibold outline-none focus:border-emerald-500"
                >
                  <option value="all">All Contacts</option>
                  <option value="yes">Has WhatsApp Number</option>
                  <option value="no">Missing WhatsApp Number</option>
                </select>
              </div>

              <div className="text-xs text-muted font-medium">
                Showing {students.length} of {totalStudents} students
              </div>
            </div>
          </div>

          {/* Student Table */}
          <div className="dashboard-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-canvas/75 text-[11px] font-bold uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-4 py-3">Student Details</th>
                    <th className="px-4 py-3">Class & Section</th>
                    <th className="px-4 py-3">Parent / Guardian</th>
                    <th className="px-4 py-3">WhatsApp Mobile</th>
                    <th className="px-4 py-3">Consent Status</th>
                    <th className="px-4 py-3 text-right">Send Direct Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {studentsLoading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted">
                        <RefreshCw className="mx-auto size-5 animate-spin text-emerald-600 mb-2" />
                        Loading student contacts...
                      </td>
                    </tr>
                  ) : students.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted">
                        No students matching the criteria found.
                      </td>
                    </tr>
                  ) : (
                    students.map((student) => {
                      const hasPhone = Boolean(student.parentWhatsapp || student.parentPhone);
                      const isOptedOut = student.whatsappConsentStatus === "OPTED_OUT";

                      return (
                        <tr key={student.id} className="hover:bg-canvas/50 transition">
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-foreground">{student.name}</div>
                            <div className="text-[11px] text-muted font-mono">{student.admission}</div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="inline-flex rounded-lg bg-canvas px-2 py-0.5 font-semibold text-foreground border">
                              {student.className} - {student.section}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="font-semibold text-foreground">
                              {student.parent || "Parent"}
                            </div>
                            <div className="text-[10px] text-muted">Guardian</div>
                          </td>
                          <td className="px-4 py-3.5">
                            {hasPhone ? (
                              <div className="flex items-center gap-1.5 font-mono text-emerald-600 font-bold">
                                <Phone className="size-3" />
                                {student.parentWhatsapp || student.parentPhone}
                              </div>
                            ) : (
                              <span className="text-amber-600 text-[11px] font-medium">
                                Not Available
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            {student.whatsappConsentStatus === "GRANTED" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600">
                                <CheckCircle2 className="size-3" /> Granted
                              </span>
                            ) : student.whatsappConsentStatus === "OPTED_OUT" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-[10px] font-bold text-red-600">
                                <UserX className="size-3" /> Opted Out
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-600">
                                <Clock className="size-3" /> Pending
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isOptedOut ? (
                                <span className="text-[11px] text-red-500 italic font-medium">
                                  Opted Out
                                </span>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() =>
                                      openShareModal(student.id, student.name, "ATTENDANCE")
                                    }
                                    disabled={!hasPhone}
                                    title="Send Attendance Notice"
                                    className="inline-flex size-7 items-center justify-center rounded-lg border bg-panel text-muted hover:border-emerald-500 hover:text-emerald-600 transition disabled:opacity-40"
                                  >
                                    <CalendarCheck2 className="size-3.5" />
                                  </button>

                                  {!isTeacherView && (
                                    <button
                                      onClick={() => openShareModal(student.id, student.name, "FEES")}
                                      disabled={!hasPhone}
                                      title="Send Fee Reminder"
                                      className="inline-flex size-7 items-center justify-center rounded-lg border bg-panel text-muted hover:border-emerald-500 hover:text-emerald-600 transition disabled:opacity-40"
                                    >
                                      <IndianRupee className="size-3.5" />
                                    </button>
                                  )}

                                  <button
                                    onClick={() =>
                                      openShareModal(student.id, student.name, "EXAM_RESULTS")
                                    }
                                    disabled={!hasPhone}
                                    title="Send Exam / Marks Notice"
                                    className="inline-flex size-7 items-center justify-center rounded-lg border bg-panel text-muted hover:border-emerald-500 hover:text-emerald-600 transition disabled:opacity-40"
                                  >
                                    <FileCheck2 className="size-3.5" />
                                  </button>

                                  <button
                                    onClick={() =>
                                      openShareModal(student.id, student.name, "STUDENT_INFO")
                                    }
                                    disabled={!hasPhone}
                                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition disabled:opacity-40"
                                  >
                                    <Send className="size-3" /> Send
                                  </button>
                                </div>
                              )}
                            </div>
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
              <div className="flex items-center justify-between border-t p-3 text-xs">
                <span className="text-muted">
                  Page {page} of {Math.ceil(totalStudents / pageSize)}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="inline-flex size-7 items-center justify-center rounded-lg border bg-panel text-muted hover:text-foreground disabled:opacity-40"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page * pageSize >= totalStudents}
                    className="inline-flex size-7 items-center justify-center rounded-lg border bg-panel text-muted hover:text-foreground disabled:opacity-40"
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
      {/* TAB 2: PARENT CONTACTS & CONSENT MANAGEMENT                               */}
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
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    placeholder="Search parent contacts by student, guardian or phone..."
                    className="h-9 w-full rounded-xl border bg-canvas pl-9 pr-3 text-xs outline-none focus:border-emerald-500"
                  />
                </div>

                <select
                  value={contactConsentFilter}
                  onChange={(e) => setContactConsentFilter(e.target.value)}
                  className="h-9 rounded-xl border bg-canvas px-3 text-xs font-semibold outline-none focus:border-emerald-500"
                >
                  <option value="ALL">All Consent States</option>
                  <option value="GRANTED">Consent Granted</option>
                  <option value="OPTED_OUT">Opted Out</option>
                  <option value="UNKNOWN">Pending / Unknown</option>
                </select>
              </div>

              <div className="text-xs text-muted">
                Showing {contacts.length} parent contacts
              </div>
            </div>
          </div>

          <div className="dashboard-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-canvas/75 text-[11px] font-bold uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Class</th>
                    <th className="px-4 py-3">Parent Name</th>
                    <th className="px-4 py-3">WhatsApp Number</th>
                    <th className="px-4 py-3">Consent Status</th>
                    <th className="px-4 py-3">Last Updated</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {contactsLoading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted">
                        <RefreshCw className="mx-auto size-5 animate-spin text-emerald-600 mb-2" />
                        Loading contacts...
                      </td>
                    </tr>
                  ) : contacts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted">
                        No parent contacts found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    contacts.map((c) => (
                      <tr key={c.studentId} className="hover:bg-canvas/50 transition">
                        <td className="px-4 py-3 font-bold text-foreground">
                          {c.studentName}
                          <div className="text-[10px] text-muted font-mono">{c.admission}</div>
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {c.className} - {c.section}
                        </td>
                        <td className="px-4 py-3">{c.parentName || "Parent / Guardian"}</td>
                        <td className="px-4 py-3 font-mono font-bold text-emerald-600">
                          {c.parentWhatsapp || c.parentPhone || "—"}
                        </td>
                        <td className="px-4 py-3">
                          {c.consentStatus === "GRANTED" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                              <CheckCircle2 className="size-3" /> Granted
                            </span>
                          ) : c.consentStatus === "OPTED_OUT" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-600">
                              <UserX className="size-3" /> Opted Out
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                              <Clock className="size-3" /> Pending
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted text-[11px]">
                          {c.consentUpdatedAt
                            ? new Date(c.consentUpdatedAt).toLocaleDateString("en-IN")
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setEditingContact({ ...c })}
                            className="inline-flex items-center gap-1 rounded-lg border bg-panel px-2.5 py-1 text-xs font-semibold hover:border-emerald-500 hover:text-emerald-600 transition"
                          >
                            <Edit2 className="size-3" /> Edit
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Edit Contact / Consent Modal */}
          {editingContact && (
            <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-3xl border bg-panel p-6 shadow-2xl">
                <div className="flex items-center justify-between pb-3 border-b">
                  <h3 className="text-base font-bold text-foreground">
                    Edit Parent Contact & Consent
                  </h3>
                  <button onClick={() => setEditingContact(null)}>
                    <X className="size-5" />
                  </button>
                </div>

                <div className="mt-4 space-y-4 text-xs">
                  <div>
                    <label className="font-bold text-muted block mb-1">Student</label>
                    <input
                      type="text"
                      disabled
                      value={`${editingContact.studentName} (${editingContact.className} - ${editingContact.section})`}
                      className="h-9 w-full rounded-xl border bg-canvas px-3 text-muted outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-muted block mb-1">Parent WhatsApp Number (E.164)</label>
                    <input
                      type="text"
                      value={editingContact.parentWhatsapp || editingContact.parentPhone || ""}
                      onChange={(e) =>
                        setEditingContact({
                          ...editingContact,
                          parentWhatsapp: e.target.value,
                          parentPhone: e.target.value,
                        })
                      }
                      placeholder="+919876543210"
                      className="h-9 w-full rounded-xl border bg-canvas px-3 font-mono outline-none focus:border-emerald-500"
                    />
                    <p className="mt-1 text-[11px] text-muted">
                      Use 10-digit mobile or international format (+919876543210).
                    </p>
                  </div>

                  <div>
                    <label className="font-bold text-muted block mb-1">Consent Status</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingContact({ ...editingContact, consentStatus: "GRANTED" })
                        }
                        className={`rounded-xl border p-2 text-center font-bold transition ${
                          editingContact.consentStatus === "GRANTED"
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                            : "bg-canvas text-muted hover:border-slate-400"
                        }`}
                      >
                        Granted
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingContact({ ...editingContact, consentStatus: "UNKNOWN" })
                        }
                        className={`rounded-xl border p-2 text-center font-bold transition ${
                          editingContact.consentStatus === "UNKNOWN"
                            ? "border-amber-500 bg-amber-500/10 text-amber-600"
                            : "bg-canvas text-muted hover:border-slate-400"
                        }`}
                      >
                        Pending
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingContact({ ...editingContact, consentStatus: "OPTED_OUT" })
                        }
                        className={`rounded-xl border p-2 text-center font-bold transition ${
                          editingContact.consentStatus === "OPTED_OUT"
                            ? "border-red-500 bg-red-500/10 text-red-600"
                            : "bg-canvas text-muted hover:border-slate-400"
                        }`}
                      >
                        Opted Out
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-2 pt-3 border-t">
                  <button
                    onClick={() => setEditingContact(null)}
                    className="btn-secondary h-9 px-4 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveContact}
                    disabled={savingContact}
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
      {/* TAB 3: MESSAGE HISTORY & DELIVERY STATUS TRACKING (Direct Meta)           */}
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
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Search history by student, recipient or message type..."
                    className="h-9 w-full rounded-xl border bg-canvas pl-9 pr-3 text-xs outline-none focus:border-emerald-500"
                  />
                </div>

                <select
                  value={historyStatusFilter}
                  onChange={(e) => setHistoryStatusFilter(e.target.value)}
                  className="h-9 rounded-xl border bg-canvas px-3 text-xs font-semibold outline-none focus:border-emerald-500"
                >
                  <option value="ALL">All Delivery Statuses</option>
                  <option value="Sent">Sent to Meta</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Read">Read by Parent</option>
                  <option value="Queued">Queued / Pending</option>
                  <option value="Failed">Failed Messages</option>
                </select>
              </div>

              <div className="text-xs text-muted">
                Total Recorded: {totalHistory} messages
              </div>
            </div>
          </div>

          <div className="dashboard-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-canvas/75 text-[11px] font-bold uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-4 py-3">Student & Recipient</th>
                    <th className="px-4 py-3">Message Type</th>
                    <th className="px-4 py-3">Meta Message ID</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Sent By</th>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {historyLoading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted">
                        <RefreshCw className="mx-auto size-5 animate-spin text-emerald-600 mb-2" />
                        Loading communication history...
                      </td>
                    </tr>
                  ) : history.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted">
                        No communication history found matching filters.
                      </td>
                    </tr>
                  ) : (
                    history.map((msg) => {
                      const isFailed = msg.status === "Failed";
                      return (
                        <tr key={msg.id} className="hover:bg-canvas/50 transition">
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-foreground">
                              {msg.studentName || msg.recipientName || "Parent Contact"}
                            </div>
                            <div className="text-[11px] text-muted font-mono">
                              {msg.recipientPhone}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 font-medium">
                            <span className="rounded-md bg-canvas px-2 py-0.5 text-[11px] font-semibold border">
                              {msg.messageType}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 font-mono text-[11px] text-muted">
                            {msg.providerMessageId ? (
                              <span title={msg.providerMessageId}>
                                {msg.providerMessageId.slice(0, 16)}...
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            {msg.status === "Delivered" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                                <CheckCircle2 className="size-3" /> Delivered
                              </span>
                            ) : msg.status === "Read" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-teal-500/10 px-2 py-0.5 text-[10px] font-bold text-teal-600">
                                <CheckCircle2 className="size-3" /> Read
                              </span>
                            ) : msg.status === "Sent" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-600">
                                <Send className="size-3" /> Sent
                              </span>
                            ) : msg.status === "Failed" ? (
                              <span
                                title={msg.errorMessage || "Delivery failed"}
                                className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-600"
                              >
                                <AlertCircle className="size-3" /> Failed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                                <Clock className="size-3" /> Queued
                              </span>
                            )}
                            {msg.errorMessage && (
                              <div
                                className="text-[10px] text-red-500 mt-0.5 max-w-[200px] truncate"
                                title={msg.errorMessage}
                              >
                                {msg.errorMessage}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-muted text-[11px]">
                            {msg.sentBy || "System"}
                          </td>
                          <td className="px-4 py-3.5 text-muted text-[11px]">
                            {msg.createdAt
                              ? new Date(msg.createdAt).toLocaleString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—"}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            {isFailed && (
                              <button
                                onClick={() => handleRetryMessage(msg.id)}
                                disabled={retryingId === msg.id}
                                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700 hover:bg-red-100 transition disabled:opacity-50 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
                              >
                                <RotateCw
                                  className={`size-3 ${retryingId === msg.id ? "animate-spin" : ""}`}
                                />
                                Retry
                              </button>
                            )}
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
      {/* TAB 4: APPROVED MESSAGE TEMPLATES                                         */}
      {/* ========================================================================= */}
      {activeTab === "templates" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground">Official Message Templates</h2>
              <p className="text-xs text-muted">
                Pre-approved templates for attendance, fee reminders, exams, homework, and announcements.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={templateLangFilter}
                onChange={(e) => setTemplateLangFilter(e.target.value as any)}
                className="h-9 rounded-xl border bg-canvas px-3 text-xs font-semibold outline-none focus:border-emerald-500"
              >
                <option value="all">All Languages</option>
                <option value="en">English (en)</option>
                <option value="kn">Kannada (kn)</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SYSTEM_TEMPLATES.filter((t) =>
              templateLangFilter === "all" ? true : t.language === templateLangFilter
            ).map((tpl) => (
              <div key={tpl.id} className="dashboard-card flex flex-col justify-between p-5">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-lg bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-600">
                      {tpl.category}
                    </span>
                    <span className="rounded-full bg-canvas px-2 py-0.5 text-[10px] font-bold text-muted border uppercase">
                      {tpl.language}
                    </span>
                  </div>

                  <h3 className="mt-2 text-sm font-bold text-foreground">{tpl.name}</h3>
                  <p className="mt-2 text-xs text-muted bg-canvas p-3 rounded-xl whitespace-pre-wrap font-sans leading-relaxed border">
                    {tpl.body}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t text-[11px] text-muted flex items-center justify-between">
                  <span>Variables: {tpl.placeholders?.length || 0}</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                    <ShieldCheck className="size-3" /> Meta Approved
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: DIRECT WHATSAPP CLOUD API CONFIGURATION (Meta Official)            */}
      {/* ========================================================================= */}
      {activeTab === "configuration" && !isTeacherView && (
        <div className="space-y-6">
          <div className="dashboard-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold text-foreground">
                  Direct WhatsApp Cloud API Connection
                </h2>
                <p className="text-xs text-muted mt-1">
                  Server-side connection parameters for official Meta WhatsApp Business Cloud API.
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                  isDirectCloudConfigured
                    ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30"
                    : "bg-red-500/15 text-red-600 border border-red-500/30"
                }`}
              >
                <span
                  className={`size-2 rounded-full ${
                    isDirectCloudConfigured ? "bg-emerald-500" : "bg-red-500"
                  }`}
                />
                {isDirectCloudConfigured ? "Configured on Server" : "Credentials Required"}
              </span>
            </div>

            {!isDirectCloudConfigured && (
              <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-bold text-sm">Configuration Required:</span>
                    <p className="leading-relaxed">
                      WhatsApp Cloud API is not configured. Complete the required server-side configuration to enable messaging.
                    </p>
                    <div className="mt-2 font-mono text-[11px] space-y-1 bg-amber-100/50 dark:bg-amber-900/30 p-2.5 rounded-xl">
                      <div>Missing environment variables:</div>
                      {env.missing?.map((m: string) => (
                        <div key={m} className="text-red-600 dark:text-red-400 font-bold">
                          • {m}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border bg-canvas p-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                  Phone Number ID
                </span>
                <div className="mt-1 font-mono text-sm font-bold text-foreground">
                  {env.details?.phoneNumberIdMasked || "Not Set"}
                </div>
                <div className="mt-1 text-[11px] text-muted">
                  Meta Graph Phone Number ID
                </div>
              </div>

              <div className="rounded-2xl border bg-canvas p-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                  Business Account ID (WABA)
                </span>
                <div className="mt-1 font-mono text-sm font-bold text-foreground">
                  {env.details?.businessAccountIdMasked || "Not Set"}
                </div>
                <div className="mt-1 text-[11px] text-muted">
                  WhatsApp Business Account identifier
                </div>
              </div>

              <div className="rounded-2xl border bg-canvas p-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                  Meta Graph API Version
                </span>
                <div className="mt-1 font-mono text-sm font-bold text-foreground">
                  {env.details?.graphVersion || "v21.0"}
                </div>
                <div className="mt-1 text-[11px] text-muted">Official Meta Cloud API version</div>
              </div>

              <div className="rounded-2xl border bg-canvas p-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                  Incoming Webhook URL
                </span>
                <div className="mt-1 font-mono text-xs font-bold text-emerald-600 truncate">
                  https://eduledger.co.in/api/whatsapp/webhook
                </div>
                <div className="mt-1 text-[11px] text-muted">
                  Configure in Meta App Dashboard under Webhooks
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border bg-panel p-4">
              <h4 className="text-xs font-bold text-foreground mb-2">
                Server Environment Variables Guide
              </h4>
              <p className="text-[11px] text-muted mb-3">
                Place these secrets in your server configuration (<code className="font-mono">.env.local</code> / Vercel Environment Variables):
              </p>
              <pre className="rounded-xl border bg-canvas p-3 font-mono text-[11px] text-emerald-700 dark:text-emerald-300 overflow-x-auto leading-relaxed">
{`WHATSAPP_ENABLED="true"
WHATSAPP_DISPATCH_ENABLED="1"
WHATSAPP_ACCESS_TOKEN="EAA..."
WHATSAPP_PHONE_NUMBER_ID="1029384756..."
WHATSAPP_BUSINESS_ACCOUNT_ID="987654321..."
WHATSAPP_VERIFY_TOKEN="your_random_verify_token_at_least_32_chars"
WHATSAPP_APP_SECRET="your_meta_app_secret"
WHATSAPP_GRAPH_VERSION="v21.0"`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Quick Share Modal for sending with explicit preview & confirmation */}
      {isModalOpen && modalStudentId && (
        <WhatsAppShareModal
          studentId={modalStudentId}
          studentName={modalStudentName}
          initialCategory={modalCategory}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onShareInitiated={() => {
            showToast("WhatsApp message initiated successfully.");
            loadStatus();
            if (activeTab === "history") loadHistory();
          }}
        />
      )}
    </div>
  );
}
