"use client";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  X,
  Send,
  Copy,
  Check,
  Edit2,
  AlertTriangle,
  GraduationCap,
  CalendarCheck2,
  IndianRupee,
  FileCheck2,
  BookOpen,
  CalendarDays,
  Clock,
  Megaphone,
  MessageSquare,
  Phone,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  CheckCheck,
} from "lucide-react";
import {
  WHATSAPP_CATEGORIES,
  DEFAULT_TEMPLATES,
  normalizeWhatsAppPhone,
  buildWhatsAppClickToChatUrl,
  renderWhatsAppTemplate,
  type WhatsAppCategory,
  type WhatsAppTemplateData,
} from "@/lib/whatsapp-click-to-chat";
import type { StudentWhatsAppContext } from "@/lib/whatsapp-click-to-chat-db";
import { readApiJson } from "@/lib/api-response";

interface WhatsAppShareModalProps {
  studentId: string;
  studentName?: string;
  initialCategory?: WhatsAppCategory;
  userRole?: string;
  isOpen: boolean;
  onClose: () => void;
  onShareInitiated?: (category: WhatsAppCategory, phone: string) => void;
}

export function WhatsAppShareModal({
  studentId,
  studentName,
  initialCategory = "STUDENT_INFO",
  userRole = "SCHOOL_ADMIN",
  isOpen,
  onClose,
  onShareInitiated,
}: WhatsAppShareModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<StudentWhatsAppContext | null>(null);
  const [category, setCategory] = useState<WhatsAppCategory>(initialCategory);

  // Customization & editing states
  const [isEditing, setIsEditing] = useState(false);
  const [editedMessage, setEditedMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [customPhone, setCustomPhone] = useState("");
  const [overridePhone, setOverridePhone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Sub-selections for categories
  const [selectedExamId, setSelectedExamId] = useState<string>("");
  const [selectedHomeworkId, setSelectedHomeworkId] = useState<string>("");
  const [customTitle, setCustomTitle] = useState("Important Student Notice");
  const [customBody, setCustomBody] = useState("");

  const isTeacher = userRole === "TEACHER";

  // Fetch full student context
  const loadContext = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/whatsapp/click-to-chat/student-context?studentId=${encodeURIComponent(studentId)}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await readApiJson(res).catch(() => ({}));
        throw new Error(body.error || "Failed to load student communication details.");
      }
      const data: StudentWhatsAppContext = await readApiJson(res);
      setContext(data);

      if (data.results.length > 0) setSelectedExamId(data.results[0].examId);
      if (data.homework.length > 0) setSelectedHomeworkId(data.homework[0].id);
      setCustomPhone(data.student.parentPhone || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load student data.");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (isOpen) {
      loadContext();
      setIsEditing(false);
      setOverridePhone(false);
    }
  }, [isOpen, loadContext]);

  // Handle active phone number
  const activePhone = overridePhone ? customPhone : (context?.student.parentPhone || customPhone);
  const phoneNorm = useMemo(() => normalizeWhatsAppPhone(activePhone), [activePhone]);

  // Construct template variables dynamically from database context
  const templateData = useMemo<WhatsAppTemplateData>(() => {
    if (!context) return {};
    const { student, school, attendance, fees, results, homework, timetable, leaves, announcements } = context;

    // Filter results if exam selected
    const activeResult = results.find((r) => r.examId === selectedExamId) || results[0];
    const subjectScoresText = results
      .filter((r) => !selectedExamId || r.examId === selectedExamId)
      .map((r) => `  • ${r.subject}: ${r.marks}/${r.maxMarks} (${r.grade}) - ${r.status}`)
      .join("\n") || "  • General Evaluation: Satisfactory (Pass)";

    // Filter homework
    const activeHw = homework.find((h) => h.id === selectedHomeworkId) || homework[0];

    // Timetable summary
    const timetableText = timetable.length > 0
      ? timetable.slice(0, 6).map((t) => `  • Period: ${t.subject} (${t.startTime} - ${t.endTime}) - ${t.teacherName}`).join("\n")
      : "  • Please check regular class schedule on the school notice board.";

    // Leave summary
    const latestLeave = leaves[0];

    // Announcement summary
    const latestAnn = announcements[0];

    return {
      school_name: school.name,
      school_phone: school.phone,
      school_email: school.email,
      school_address: school.address,
      student_name: student.name,
      admission_number: student.admission,
      class_name: student.className,
      section: student.section,
      roll_number: student.rollNumber || "—",
      academic_year: student.academicYear || school.academicYear,
      gender: student.gender || "—",
      blood_group: student.bloodGroup || "Not specified",
      parent_name: student.parent || "Parent / Guardian",
      parent_phone: phoneNorm.formatted,
      // Attendance
      attendance_date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
      attendance_status: attendance.todayStatus,
      attendance_percentage: attendance.monthlyPercentage,
      present_count: attendance.presentCount,
      absent_count: attendance.absentCount,
      attendance_summary: attendance.recentDates.length > 0
        ? `Recent records: ${attendance.recentDates.map((d) => `${d.date.slice(5)} (${d.status})`).join(", ")}`
        : "",
      // Fees
      total_fee: fees ? fees.totalFee.toLocaleString("en-IN") : "0",
      paid_fee: fees ? fees.paidFee.toLocaleString("en-IN") : "0",
      pending_fee: fees ? fees.pendingFee.toLocaleString("en-IN") : "0",
      fee_due_date: fees?.dueDate || "As communicated",
      fee_status: fees?.status || "Pending",
      invoice_number: fees?.latestInvoice || "",
      // Exam Results
      exam_name: activeResult?.examName || "Term Examination",
      percentage: activeResult?.percentage ?? 0,
      grade: activeResult?.grade || "A",
      total_marks: activeResult?.marks ?? 0,
      max_marks: activeResult?.maxMarks ?? 100,
      result_status: activeResult?.status || "Pass",
      subject_scores: subjectScoresText,
      // Homework
      subject: activeHw?.subject || "General Academic",
      homework_title: activeHw?.title || "Class Assignment",
      due_date: activeHw?.dueDate || "Next Class Period",
      instructions: activeHw?.instructions || "Complete all exercises given in class notebook.",
      // Timetable
      timetable_schedule: timetableText,
      // Leave
      leave_status: latestLeave?.status || "Recorded",
      leave_dates: latestLeave?.dates || "Current Session",
      leave_reason: latestLeave?.reason || "Authorized absence",
      leave_remarks: latestLeave?.remarks || "Approved by school authority",
      // Announcement
      announcement_title: latestAnn?.title || "School Notice",
      announcement_content: latestAnn?.content || "Please contact the school office for recent updates.",
      announcement_date: latestAnn?.date || new Date().toISOString().slice(0, 10),
      // Custom
      custom_title: customTitle,
      custom_content: customBody || "We are pleased to inform you about recent academic progress.",
    };
  }, [context, selectedExamId, selectedHomeworkId, customTitle, customBody, phoneNorm]);

  // Generated default message for active category
  const generatedMessage = useMemo(() => {
    const rawTemplate = DEFAULT_TEMPLATES[category] || DEFAULT_TEMPLATES.STUDENT_INFO;
    return renderWhatsAppTemplate(rawTemplate, templateData);
  }, [category, templateData]);

  // Keep edited message synced when not manually editing
  useEffect(() => {
    if (!isEditing) {
      setEditedMessage(generatedMessage);
    }
  }, [generatedMessage, isEditing]);

  const activeMessage = isEditing ? editedMessage : generatedMessage;

  // Handle clipboard copy
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  // Handle Send via WhatsApp Click-to-Chat
  const handleSend = async () => {
    if (!phoneNorm.isValid) {
      alert("Please provide a valid 10-digit Indian or international mobile number.");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Log the initiation event in EduLedger database
      await fetch("/api/whatsapp/click-to-chat/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: context?.student.id,
          recipientPhone: phoneNorm.normalized,
          recipientName: context?.student.parent || "Parent",
          category,
          messagePreview: activeMessage.slice(0, 250),
        }),
      });

      // 2. Generate official wa.me link
      const waUrl = buildWhatsAppClickToChatUrl(phoneNorm.normalized, activeMessage);

      // 3. Open in a new tab or trigger the WhatsApp mobile application
      window.open(waUrl, "_blank", "noopener,noreferrer");

      if (onShareInitiated) {
        onShareInitiated(category, phoneNorm.normalized);
      }
      onClose();
    } catch (err) {
      console.error("Failed to initiate WhatsApp share:", err);
      // Even if logging fails, still offer to open the WhatsApp chat link
      const waUrl = buildWhatsAppClickToChatUrl(phoneNorm.normalized, activeMessage);
      window.open(waUrl, "_blank", "noopener,noreferrer");
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Category Icon helper
  const getCategoryIcon = (catId: WhatsAppCategory) => {
    switch (catId) {
      case "STUDENT_INFO": return <GraduationCap className="size-4" />;
      case "ATTENDANCE": return <CalendarCheck2 className="size-4" />;
      case "FEES": return <IndianRupee className="size-4" />;
      case "EXAM_RESULTS": return <FileCheck2 className="size-4" />;
      case "HOMEWORK": return <BookOpen className="size-4" />;
      case "TIMETABLE": return <CalendarDays className="size-4" />;
      case "LEAVE": return <Clock className="size-4" />;
      case "ANNOUNCEMENT": return <Megaphone className="size-4" />;
      case "CUSTOM": return <MessageSquare className="size-4" />;
      default: return <MessageSquare className="size-4" />;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="whatsapp-share-title"
      className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-5"
    >
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col rounded-3xl border border-slate-200 bg-panel shadow-2xl overflow-hidden dark:border-slate-800">
        {/* Header */}
        <header className="flex items-center justify-between border-b bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-white/15 text-white shadow-inner">
              <Phone className="size-5" />
            </span>
            <div>
              <h2 id="whatsapp-share-title" className="text-lg font-black tracking-tight">
                Share via WhatsApp
              </h2>
              <p className="text-xs text-emerald-100">
                {context ? `${context.student.name} • Class ${context.student.className}-${context.student.section}` : (studentName || "Direct Parent Communication")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-white/80 transition hover:bg-white/20 hover:text-white"
            aria-label="Close modal"
          >
            <X className="size-5" />
          </button>
        </header>

        {/* Body Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center p-16 text-center">
            <div className="size-10 animate-spin rounded-full border-4 border-emerald-600 border-r-transparent" />
            <p className="mt-4 text-sm font-semibold text-muted">Preparing student information from database...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <AlertTriangle className="mx-auto size-10 text-amber-500" />
            <h3 className="mt-3 text-base font-bold text-foreground">Could not load student information</h3>
            <p className="mt-1 text-sm text-muted">{error}</p>
            <button onClick={loadContext} className="btn-secondary mt-4">
              <RefreshCw className="size-4" /> Try Again
            </button>
          </div>
        ) : context ? (
          <div className="grid flex-1 overflow-y-auto lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x dark:divide-slate-800">
            {/* Left Column: Categories & Settings (5 cols) */}
            <div className="p-5 lg:col-span-5 space-y-5 overflow-y-auto">
              {/* Recipient Status Card */}
              <div className={`rounded-2xl border p-4 transition ${phoneNorm.isValid ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/20" : "border-amber-200 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Parent Recipient</span>
                    <b className="block text-sm font-extrabold text-foreground">{context.student.parent || "Parent / Guardian"}</b>
                    <p className="mt-0.5 font-mono text-xs text-foreground">
                      {phoneNorm.isValid ? phoneNorm.formatted : (phoneNorm.raw || "No number configured")}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${phoneNorm.isValid ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300"}`}>
                    {phoneNorm.isValid ? (
                      <>
                        <ShieldCheck className="size-3.5" /> Ready
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="size-3.5" /> Missing / Invalid
                      </>
                    )}
                  </span>
                </div>

                {!phoneNorm.isValid && (
                  <div className="mt-3 rounded-xl bg-white/80 p-3 text-xs text-amber-900 dark:bg-slate-900/80 dark:text-amber-200 border border-amber-200/50">
                    <p className="font-semibold">Parent mobile number is required to open WhatsApp chat.</p>
                    <button
                      type="button"
                      onClick={() => setOverridePhone(true)}
                      className="mt-2 text-xs font-bold text-emerald-700 underline hover:text-emerald-800 dark:text-emerald-400"
                    >
                      Enter mobile number manually
                    </button>
                  </div>
                )}

                {overridePhone && (
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <label className="block text-xs font-bold text-foreground">
                      Mobile Number (with country code or 10-digit Indian):
                    </label>
                    <input
                      type="text"
                      value={customPhone}
                      onChange={(e) => setCustomPhone(e.target.value)}
                      placeholder="e.g. 9876543210 or +91 98765 43210"
                      className="mt-1 h-9 w-full rounded-xl border bg-canvas px-3 text-xs font-mono outline-none focus:border-emerald-500"
                    />
                  </div>
                )}
              </div>

              {/* Message Categories Grid */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">
                  Select Communication Category
                </label>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {WHATSAPP_CATEGORIES.map((cat) => {
                    const isSelected = category === cat.id;
                    const isFeeRestricted = cat.requiresFinancePermission && isTeacher;

                    return (
                      <button
                        key={cat.id}
                        type="button"
                        disabled={isFeeRestricted}
                        onClick={() => {
                          setCategory(cat.id);
                          setIsEditing(false);
                        }}
                        title={isFeeRestricted ? "Teachers cannot share financial fee statements." : cat.description}
                        className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-left text-xs transition ${isFeeRestricted
                          ? "cursor-not-allowed opacity-40 bg-slate-100 dark:bg-slate-900"
                          : isSelected
                            ? "border-emerald-500 bg-emerald-500/10 font-bold text-emerald-700 ring-2 ring-emerald-500/30 dark:text-emerald-300"
                            : "border-slate-200 bg-canvas hover:border-slate-300 hover:bg-slate-100/50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                          }`}
                      >
                        <span className={`grid size-7 shrink-0 place-items-center rounded-lg ${isSelected ? "bg-emerald-600 text-white" : "bg-slate-200/70 text-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}>
                          {getCategoryIcon(cat.id)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="block truncate">{cat.shortTitle}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {isTeacher && (
                  <p className="mt-2 text-[11px] text-muted italic">
                    Note: Financial and fee modules are restricted to school administrative staff.
                  </p>
                )}
              </div>

              {/* Category-Specific Sub-Options */}
              {category === "EXAM_RESULTS" && context.results.length > 0 && (
                <div className="rounded-2xl border bg-canvas p-3.5">
                  <label className="block text-xs font-bold text-foreground">Select Examination:</label>
                  <select
                    value={selectedExamId}
                    onChange={(e) => setSelectedExamId(e.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border bg-panel px-3 text-xs outline-none focus:border-emerald-500"
                  >
                    {context.results.map((r) => (
                      <option key={r.examId} value={r.examId}>
                        {r.examName} ({r.subject} - {r.marks}/{r.maxMarks})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {category === "HOMEWORK" && context.homework.length > 0 && (
                <div className="rounded-2xl border bg-canvas p-3.5">
                  <label className="block text-xs font-bold text-foreground">Select Homework:</label>
                  <select
                    value={selectedHomeworkId}
                    onChange={(e) => setSelectedHomeworkId(e.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border bg-panel px-3 text-xs outline-none focus:border-emerald-500"
                  >
                    {context.homework.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.subject}: {h.title} (Due: {h.dueDate})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {category === "CUSTOM" && (
                <div className="rounded-2xl border bg-canvas p-3.5 space-y-2">
                  <label className="block text-xs font-bold text-foreground">Message Heading:</label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    className="h-9 w-full rounded-xl border bg-panel px-3 text-xs outline-none focus:border-emerald-500"
                    placeholder="e.g. Science Fair Invitation"
                  />
                  <label className="block text-xs font-bold text-foreground">Custom Note / Details:</label>
                  <textarea
                    rows={3}
                    value={customBody}
                    onChange={(e) => setCustomBody(e.target.value)}
                    className="w-full rounded-xl border bg-panel p-2.5 text-xs outline-none focus:border-emerald-500"
                    placeholder="Enter details for the parent..."
                  />
                </div>
              )}
            </div>

            {/* Right Column: WhatsApp Live Preview & Actions (7 cols) */}
            <div className="flex flex-col p-5 lg:col-span-7 bg-slate-50/60 dark:bg-slate-900/40 overflow-y-auto">
              <div className="flex items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted">
                    WhatsApp Message Preview
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing((prev) => !prev)}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${isEditing
                      ? "bg-emerald-600 text-white"
                      : "border bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
                      }`}
                  >
                    <Edit2 className="size-3.5" />
                    {isEditing ? "Viewing Live" : "Edit Message"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1 rounded-lg border bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 transition"
                  >
                    {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>

              {/* Chat Bubble Container */}
              <div className="flex-1 rounded-2xl border border-emerald-200 bg-[#efeae2] p-4 shadow-inner dark:border-emerald-950 dark:bg-[#0c1317]">
                {isEditing ? (
                  <textarea
                    rows={14}
                    value={editedMessage}
                    onChange={(e) => setEditedMessage(e.target.value)}
                    className="w-full rounded-xl border border-emerald-300 bg-white p-3 font-sans text-xs leading-relaxed text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-emerald-900 dark:bg-slate-950 dark:text-slate-100"
                    placeholder="Type or customize your WhatsApp message..."
                  />
                ) : (
                  <div className="relative max-w-full rounded-2xl bg-white p-4 text-xs font-sans leading-relaxed text-slate-900 shadow-sm dark:bg-[#1f2c34] dark:text-slate-100">
                    <pre className="whitespace-pre-wrap font-sans text-xs select-text">
                      {activeMessage}
                    </pre>
                    <div className="mt-3 flex items-center justify-end gap-1 text-[10px] text-slate-400">
                      <span>Now</span>
                      <CheckCheck className="size-3.5 text-blue-500" />
                    </div>
                  </div>
                )}
              </div>

              {/* Compliance & Send Bar */}
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
                <div className="text-[11px] text-muted leading-tight">
                  <p>• Clicking Send opens the official WhatsApp chat.</p>
                  <p>• You will review and tap Send inside WhatsApp.</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn-secondary h-11 px-4 text-xs font-semibold"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={!phoneNorm.isValid || submitting}
                    onClick={handleSend}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-5 text-xs font-black text-white shadow-lg shadow-emerald-500/25 transition hover:bg-[#20ba5a] hover:shadow-xl active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? (
                      <span className="size-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    <span>Send via WhatsApp</span>
                    <ExternalLink className="size-3.5 opacity-70" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

