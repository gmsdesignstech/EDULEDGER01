"use client";

import { useEffect, useState } from "react";
import {
  Award,
  BookOpen,
  CheckCircle2,
  FileCheck2,
  GraduationCap,
  Loader2,
  Printer,
  XCircle,
} from "lucide-react";
import { useParentContext } from "@/components/parent-context";

type ExamResult = {
  id: string;
  examId: string;
  examName: string;
  subject: string;
  examDate: string;
  maxMarks: number;
  passingMarks: number;
  marks: number;
  grade: string;
  status: string;
  remarks: string;
};

export default function ParentResultsPage() {
  const { selectedChild } = useParentContext();
  const [results, setResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectedChild?.id) return;
    let active = true;
    setLoading(true);
    setError("");

    fetch(`/api/parent/children/${selectedChild.id}/results`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to load examination results.");
        }
        return res.json();
      })
      .then((data) => {
        if (active) setResults(data.results || []);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Error loading results.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedChild?.id]);

  if (!selectedChild) {
    return (
      <div className="py-12 text-center text-sm text-muted">
        Select a child from the top bar to view examination records.
      </div>
    );
  }

  const totalExams = results.length;
  const totalScored = results.reduce((acc, r) => acc + (r.marks || 0), 0);
  const totalMax = results.reduce((acc, r) => acc + (r.maxMarks || 0), 0);
  const overallPercentage = totalMax > 0 ? Math.round((totalScored / totalMax) * 100) : 0;
  const passedCount = results.filter((r) => r.status === "Pass" || (r.marks >= r.passingMarks)).length;

  return (
    <div className="space-y-6">
      {/* Title & Action */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground">Examination Results & Grades</h1>
          <p className="mt-1 text-xs text-muted">
            Official marks and performance reports for {selectedChild.name} (Class {selectedChild.className}-{selectedChild.section})
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-xl border bg-panel px-4 py-2 text-xs font-bold text-foreground shadow-sm transition hover:border-blue-400 print:hidden"
        >
          <Printer className="size-4 text-blue-600" />
          Print Report Card
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border bg-panel p-5 shadow-sm">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-bold uppercase tracking-wider">Overall Score</span>
            <Award className="size-4 text-blue-600" />
          </div>
          <p className="mt-2 text-3xl font-black text-foreground">{overallPercentage}%</p>
          <p className="mt-1 text-[11px] text-muted">
            {totalScored} out of {totalMax} total marks across {totalExams} subjects
          </p>
        </div>

        <div className="rounded-3xl border bg-panel p-5 shadow-sm">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-bold uppercase tracking-wider">Pass Rate</span>
            <CheckCircle2 className="size-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-3xl font-black text-emerald-600">
            {totalExams > 0 ? `${passedCount} / ${totalExams}` : "—"}
          </p>
          <p className="mt-1 text-[11px] text-muted">Exams meeting required minimum threshold</p>
        </div>

        <div className="rounded-3xl border bg-panel p-5 shadow-sm">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-bold uppercase tracking-wider">Academic Level</span>
            <GraduationCap className="size-4 text-purple-600" />
          </div>
          <p className="mt-2 text-3xl font-black text-foreground">
            Class {selectedChild.className} - {selectedChild.section}
          </p>
          <p className="mt-1 text-[11px] text-muted">Admission: {selectedChild.admission}</p>
        </div>
      </div>

      {/* Results Table */}
      <div className="rounded-3xl border bg-panel p-6 shadow-sm">
        <h2 className="text-base font-bold text-foreground mb-4">
          Subject-Wise Evaluation
        </h2>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-blue-600" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-center text-xs text-red-500">
            {error}
          </div>
        ) : results.length === 0 ? (
          <p className="py-12 text-center text-xs text-muted">
            No published examination results available yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b text-[11px] font-bold uppercase tracking-wider text-muted">
                  <th className="pb-3 pr-4">Exam Name</th>
                  <th className="pb-3 px-4">Subject</th>
                  <th className="pb-3 px-4">Marks Scored</th>
                  <th className="pb-3 px-4">Max Marks</th>
                  <th className="pb-3 px-4">Passing</th>
                  <th className="pb-3 px-4">Grade</th>
                  <th className="pb-3 px-4">Status</th>
                  <th className="pb-3 pl-4">Teacher Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {results.map((r) => {
                  const passed = r.marks >= r.passingMarks;
                  return (
                    <tr key={r.id} className="transition hover:bg-canvas">
                      <td className="py-3.5 pr-4 font-bold text-foreground">{r.examName}</td>
                      <td className="py-3.5 px-4 font-medium">{r.subject}</td>
                      <td className="py-3.5 px-4 font-bold text-foreground">{r.marks}</td>
                      <td className="py-3.5 px-4 text-muted">{r.maxMarks}</td>
                      <td className="py-3.5 px-4 text-muted">{r.passingMarks}</td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-foreground">{r.grade || "—"}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            passed
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                          }`}
                        >
                          {passed ? "Pass" : "Fail"}
                        </span>
                      </td>
                      <td className="py-3.5 pl-4 text-muted">{r.remarks || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

