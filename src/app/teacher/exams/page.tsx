"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Award,
  CheckCircle2,
  ChevronRight,
  FileCheck2,
  GraduationCap,
  Loader2,
  Lock,
  Save,
  Unlock,
  Users,
} from "lucide-react";

type ExaminationItem = {
  id: string;
  name: string;
  academicYear: string;
  className: string;
  section: string;
  startDate: string;
  endDate: string;
  status: string;
};

type ExamDetail = {
  exam: ExaminationItem;
  subjects: {
    id: string;
    subject: string;
    maximumMarks: number;
    passingMarks: number;
    maximumCent: number;
    passingCent: number;
    required: boolean;
  }[];
  students: {
    id: string;
    name: string;
    admission: string;
    rollNumber: string;
    subjects: {
      subjectId: string;
      marks: number | null;
      marksCent: number | null;
      markStatus: "Scored" | "Absent" | "Exempt";
      grade: string;
      status: string;
      remarks: string;
    }[];
  }[];
};

type MarkEntryRow = {
  studentId: string;
  name: string;
  admission: string;
  rollNumber: string;
  markStatus: "Scored" | "Absent" | "Exempt";
  obtainedMarks: number | string;
  remarks: string;
  grade?: string;
};

export default function TeacherExamsPage() {
  const [exams, setExams] = useState<ExaminationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [examDetail, setExamDetail] = useState<ExamDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");

  const [markRows, setMarkRows] = useState<MarkEntryRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/teacher/exams")
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load examinations");
        return res.json();
      })
      .then((data) => {
        setExams(data.items || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load examinations");
        setLoading(false);
      });
  }, []);

  function selectExam(examId: string) {
    setSelectedExamId(examId);
    setDetailLoading(true);
    setError("");
    setSuccess("");

    fetch(`/api/teacher/exams?examId=${examId}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.error || "Could not load exam details");
        }
        return res.json();
      })
      .then((data) => {
        const detail: ExamDetail = data.detail;
        setExamDetail(detail);
        if (detail.subjects.length > 0) {
          const firstSub = detail.subjects[0].id;
          setSelectedSubjectId(firstSub);
          populateRows(detail, firstSub);
        }
        setDetailLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to open exam");
        setDetailLoading(false);
      });
  }

  function populateRows(detail: ExamDetail, subjectId: string) {
    const rows: MarkEntryRow[] = detail.students.map((st) => {
      const existing = st.subjects.find((s) => s.subjectId === subjectId);
      return {
        studentId: st.id,
        name: st.name,
        admission: st.admission,
        rollNumber: st.rollNumber,
        markStatus: existing?.markStatus || "Scored",
        obtainedMarks: existing?.marks != null ? existing.marks : "",
        remarks: existing?.remarks || "",
        grade: existing?.grade || "—",
      };
    });
    setMarkRows(rows);
  }

  function handleSubjectChange(subId: string) {
    setSelectedSubjectId(subId);
    if (examDetail) {
      populateRows(examDetail, subId);
    }
  }

  function updateRow(studentId: string, updates: Partial<MarkEntryRow>) {
    setMarkRows((prev) =>
      prev.map((r) => (r.studentId === studentId ? { ...r, ...updates } : r))
    );
  }

  const activeSubject = examDetail?.subjects.find((s) => s.id === selectedSubjectId);
  const isEditable =
    examDetail?.exam.status === "Marks Entry Open" || examDetail?.exam.status === "Draft";

  async function saveMarks(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedExamId || !selectedSubjectId || !activeSubject) return;
    setError("");
    setSuccess("");

    // Validate marks before submitting
    for (const r of markRows) {
      if (r.markStatus === "Scored") {
        if (r.obtainedMarks === "" || isNaN(Number(r.obtainedMarks))) {
          setError(`Please enter a valid numeric mark for ${r.name}`);
          return;
        }
        const val = Number(r.obtainedMarks);
        if (val < 0) {
          setError(`Mark for ${r.name} cannot be negative`);
          return;
        }
        if (val > activeSubject.maximumMarks) {
          setError(`Mark for ${r.name} (${val}) exceeds the maximum marks (${activeSubject.maximumMarks})`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      const payload = {
        examId: selectedExamId,
        subjectId: selectedSubjectId,
        items: markRows.map((r) => ({
          studentId: r.studentId,
          markStatus: r.markStatus,
          obtainedMarks: r.markStatus === "Scored" ? Number(r.obtainedMarks) : null,
          remarks: r.remarks || "",
        })),
      };

      const res = await fetch("/api/teacher/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Could not save marks");
      }

      const result = await res.json();
      setExamDetail(result.detail);
      populateRows(result.detail, selectedSubjectId);
      setSuccess("Marks saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save marks");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-muted">
        <Loader2 className="size-8 animate-spin text-blue-600" />
        <p className="text-sm font-semibold">Loading examinations…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Examination Marks Entry</h1>
          <p className="text-xs text-muted sm:text-sm">
            Input student scores for assigned examination subjects
          </p>
        </div>

        {selectedExamId && (
          <button
            onClick={() => {
              setSelectedExamId(null);
              setExamDetail(null);
            }}
            className="rounded-2xl border bg-panel px-4 py-2 text-xs font-bold text-muted transition hover:text-foreground"
          >
            ← Back to All Exams
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-950 dark:bg-red-950/30 dark:text-red-300">
          <AlertCircle className="size-5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-300">
          <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {/* Screen 1: Exam List */}
      {!selectedExamId ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {exams.length > 0 ? (
            exams.map((exam) => {
              const openForEntry =
                exam.status === "Marks Entry Open" || exam.status === "Draft";

              return (
                <div
                  key={exam.id}
                  onClick={() => selectExam(exam.id)}
                  className="group flex cursor-pointer flex-col justify-between rounded-3xl border bg-panel p-5 shadow-sm transition hover:border-blue-500 hover:shadow-md"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="rounded-lg bg-blue-100 px-2 py-0.5 text-xs font-black text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                        {exam.className} - {exam.section}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          openForEntry
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {openForEntry ? (
                          <Unlock className="size-2.5 text-emerald-600" />
                        ) : (
                          <Lock className="size-2.5 text-slate-500" />
                        )}
                        {exam.status}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-foreground group-hover:text-blue-600">
                      {exam.name}
                    </h3>
                    <p className="text-xs text-muted">
                      Dates: {exam.startDate} to {exam.endDate}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs font-bold text-blue-600">
                    <span>{openForEntry ? "Enter Marks →" : "View Record →"}</span>
                    <ChevronRight className="size-4 transition group-hover:translate-x-1" />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full rounded-3xl border border-dashed bg-panel p-12 text-center">
              <FileCheck2 className="mx-auto size-10 text-muted" />
              <h3 className="mt-3 text-base font-bold">No examinations found</h3>
              <p className="mt-1 text-xs text-muted">
                There are no examinations currently configured for your assigned classes.
              </p>
            </div>
          )}
        </div>
      ) : detailLoading ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-muted">
          <Loader2 className="size-8 animate-spin text-blue-600" />
          <p className="text-sm font-semibold">Loading exam marksheet…</p>
        </div>
      ) : examDetail ? (
        /* Screen 2: Marks Entry Sheet */
        <div className="space-y-4">
          {/* Exam Summary Banner */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border bg-panel p-5 shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                  {examDetail.exam.className} - {examDetail.exam.section}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    isEditable
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                      : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {isEditable ? <Unlock className="size-3" /> : <Lock className="size-3" />}
                  Status: {examDetail.exam.status}
                </span>
              </div>
              <h2 className="mt-1 text-xl font-black">{examDetail.exam.name}</h2>
            </div>

            {/* Subject Selector */}
            {examDetail.subjects.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted">
                  Subject:
                </label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => handleSubjectChange(e.target.value)}
                  className="rounded-2xl border bg-canvas px-4 py-2 text-xs font-bold shadow-sm focus:border-blue-500 focus:outline-none"
                >
                  {examDetail.subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.subject} (Max: {sub.maximumMarks}, Pass: {sub.passingMarks})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {!isEditable && (
            <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-medium text-amber-900 dark:border-amber-950/50 dark:bg-amber-950/30 dark:text-amber-200">
              <Lock className="size-4 shrink-0 text-amber-600" />
              <span>
                Marks entry is currently locked for this examination. School administrator must set status to &quot;Marks Entry Open&quot; to allow edits.
              </span>
            </div>
          )}

          {/* Marks Table */}
          {activeSubject && markRows.length > 0 ? (
            <form onSubmit={saveMarks} className="space-y-4">
              <div className="rounded-3xl border bg-panel shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b bg-canvas/70 font-bold uppercase tracking-wider text-muted">
                      <tr>
                        <th className="px-5 py-3.5">Roll No</th>
                        <th className="px-5 py-3.5">Student Name</th>
                        <th className="px-5 py-3.5">Mark Status</th>
                        <th className="px-5 py-3.5">
                          Score (Max: {activeSubject.maximumMarks})
                        </th>
                        <th className="px-5 py-3.5">Grade</th>
                        <th className="px-5 py-3.5">Teacher Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {markRows.map((row) => (
                        <tr key={row.studentId} className="transition hover:bg-canvas/30">
                          <td className="px-5 py-3 font-mono font-bold text-blue-600">
                            {row.rollNumber || "—"}
                          </td>
                          <td className="px-5 py-3 font-bold text-foreground">
                            {row.name}
                          </td>
                          <td className="px-5 py-3">
                            <select
                              disabled={!isEditable}
                              value={row.markStatus}
                              onChange={(e) =>
                                updateRow(row.studentId, {
                                  markStatus: e.target.value as "Scored" | "Absent" | "Exempt",
                                })
                              }
                              className="rounded-xl border bg-canvas px-2.5 py-1.5 text-xs font-semibold disabled:opacity-60"
                            >
                              <option value="Scored">Scored</option>
                              <option value="Absent">Absent</option>
                              <option value="Exempt">Exempt</option>
                            </select>
                          </td>
                          <td className="px-5 py-3">
                            <input
                              type="number"
                              disabled={!isEditable || row.markStatus !== "Scored"}
                              min={0}
                              max={activeSubject.maximumMarks}
                              step="0.5"
                              placeholder={row.markStatus === "Scored" ? "0 - " + activeSubject.maximumMarks : "—"}
                              value={row.markStatus === "Scored" ? row.obtainedMarks : ""}
                              onChange={(e) =>
                                updateRow(row.studentId, { obtainedMarks: e.target.value })
                              }
                              className="w-24 rounded-xl border bg-canvas px-3 py-1.5 font-mono text-xs font-bold focus:border-blue-500 focus:outline-none disabled:opacity-50"
                            />
                          </td>
                          <td className="px-5 py-3 font-bold">
                            <span className="rounded bg-canvas px-2 py-0.5 border">
                              {row.grade || "—"}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <input
                              type="text"
                              disabled={!isEditable}
                              placeholder="Feedback / Remarks…"
                              value={row.remarks}
                              onChange={(e) =>
                                updateRow(row.studentId, { remarks: e.target.value })
                              }
                              className="w-full rounded-xl border bg-canvas px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none disabled:opacity-60"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {isEditable && (
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-xs font-bold text-white shadow-lg shadow-blue-900/20 transition hover:bg-blue-700 active:scale-95 disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Saving Marks…
                      </>
                    ) : (
                      <>
                        <Save className="size-4" />
                        Save Examination Marks
                      </>
                    )}
                  </button>
                </div>
              )}
            </form>
          ) : (
            <div className="rounded-3xl border border-dashed bg-panel p-12 text-center">
              <Users className="mx-auto size-10 text-muted" />
              <h3 className="mt-3 text-base font-bold">No assigned subjects</h3>
              <p className="mt-1 text-xs text-muted">
                You do not have assigned subjects for this examination.
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

