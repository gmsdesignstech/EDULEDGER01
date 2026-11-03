"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Filter,
  GraduationCap,
  Loader2,
  Phone,
  Search,
  User,
  Users,
} from "lucide-react";

type StudentRecord = {
  id: string;
  name: string;
  admission: string;
  rollNumber: string;
  className: string;
  section: string;
  gender?: string;
  parent?: string;
  parentPhone?: string;
  bloodGroup?: string;
  attendance?: number;
};

type Assignment = {
  academicYear: string;
  className: string;
  section: string;
  subject: string;
};

export default function TeacherStudentsPage() {
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedScope, setSelectedScope] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/teacher/students")
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.error || "Could not load students");
        }
        return res.json();
      })
      .then((data) => {
        setStudents(data.students || []);
        setAssignments(data.assignments || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load student list");
        setLoading(false);
      });
  }, []);

  const classSectionOptions = useMemo(() => {
    const set = new Set<string>();
    for (const a of assignments) {
      set.add(`${a.className} - ${a.section}`);
    }
    return Array.from(set).sort();
  }, [assignments]);

  const filtered = useMemo(() => {
    return students.filter((s) => {
      if (selectedScope !== "ALL") {
        const [cls, sec] = selectedScope.split(" - ");
        if (s.className !== cls || s.section !== sec) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const matches =
          s.name.toLowerCase().includes(q) ||
          s.admission.toLowerCase().includes(q) ||
          s.rollNumber?.toLowerCase().includes(q) ||
          s.parent?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [students, selectedScope, search]);

  if (loading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-muted">
        <Loader2 className="size-8 animate-spin text-blue-600" />
        <p className="text-sm font-semibold">Loading your students…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">My Students</h1>
          <p className="text-xs text-muted sm:text-sm">
            Enrolled learners in your assigned classes and sections
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border bg-panel px-3 py-1.5 text-xs font-bold shadow-sm">
          <Users className="size-4 text-blue-600" />
          <span>{filtered.length} Students</span>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-950 dark:bg-red-950/30 dark:text-red-300">
          <AlertCircle className="size-5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Class Filter */}
        <div className="relative sm:w-64">
          <select
            value={selectedScope}
            onChange={(e) => setSelectedScope(e.target.value)}
            className="w-full appearance-none rounded-2xl border bg-panel px-4 py-2.5 pr-10 text-xs font-semibold shadow-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="ALL">All Assigned Classes ({classSectionOptions.length})</option>
            {classSectionOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <Filter className="pointer-events-none absolute right-3.5 top-3 size-4 text-muted" />
        </div>

        {/* Search */}
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by student name, roll no, admission no..."
            className="w-full rounded-2xl border bg-panel px-4 py-2.5 pl-10 text-xs shadow-sm focus:border-blue-500 focus:outline-none"
          />
          <Search className="pointer-events-none absolute left-3.5 top-3 size-4 text-muted" />
        </div>
      </div>

      {/* Student List View */}
      {filtered.length > 0 ? (
        <div className="rounded-3xl border bg-panel shadow-sm overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-canvas/70 font-bold uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-3.5">Roll No</th>
                  <th className="px-5 py-3.5">Student Name</th>
                  <th className="px-5 py-3.5">Class & Section</th>
                  <th className="px-5 py-3.5">Admission No</th>
                  <th className="px-5 py-3.5">Parent / Guardian</th>
                  <th className="px-5 py-3.5">Parent Phone</th>
                  <th className="px-5 py-3.5">Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((s) => (
                  <tr key={s.id} className="transition hover:bg-canvas/50">
                    <td className="px-5 py-3.5 font-mono font-bold text-blue-600">
                      {s.rollNumber || "—"}
                    </td>
                    <td className="px-5 py-3.5 font-bold">
                      <div className="flex items-center gap-2">
                        <span className="grid size-7 place-items-center rounded-lg bg-blue-100 text-[11px] font-bold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                          {s.name.charAt(0)}
                        </span>
                        <span>{s.name}</span>
                        {s.bloodGroup && (
                          <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
                            {s.bloodGroup}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="rounded-lg bg-canvas px-2.5 py-1 font-semibold border">
                        {s.className} - {s.section}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-muted">{s.admission}</td>
                    <td className="px-5 py-3.5 text-foreground">{s.parent || "—"}</td>
                    <td className="px-5 py-3.5 font-mono text-muted">
                      {s.parentPhone ? (
                        <a
                          href={`tel:${s.parentPhone}`}
                          className="inline-flex items-center gap-1 hover:text-blue-600 hover:underline"
                        >
                          <Phone className="size-3" /> {s.parentPhone}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${(s.attendance ?? 100) >= 75
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                          }`}
                      >
                        {s.attendance ?? 100}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="divide-y md:hidden">
            {filtered.map((s) => (
              <div key={s.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="grid size-8 place-items-center rounded-xl bg-blue-100 text-xs font-black text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                      {s.name.charAt(0)}
                    </span>
                    <div>
                      <b className="block text-sm font-bold">{s.name}</b>
                      <span className="text-[11px] text-muted font-mono">
                        Roll: {s.rollNumber || "—"} • Adm: {s.admission}
                      </span>
                    </div>
                  </div>
                  <span className="rounded-lg bg-canvas px-2 py-0.5 text-[11px] font-bold border">
                    {s.className}-{s.section}
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted pt-2 border-t">
                  <span>Parent: <strong className="text-foreground">{s.parent || "—"}</strong></span>
                  {s.parentPhone && (
                    <a
                      href={`tel:${s.parentPhone}`}
                      className="inline-flex items-center gap-1 font-mono text-blue-600 hover:underline"
                    >
                      <Phone className="size-3" /> {s.parentPhone}
                    </a>
                  )}
                  <span className="ml-auto font-bold text-foreground">
                    Att: {s.attendance ?? 100}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed bg-panel p-12 text-center">
          <GraduationCap className="mx-auto size-10 text-muted" />
          <h3 className="mt-3 text-base font-bold">No students found</h3>
          <p className="mt-1 text-xs text-muted">
            {search
              ? "No students match your search criteria. Try a different query."
              : "No students are enrolled in this class yet."}
          </p>
        </div>
      )}
    </div>
  );
}

