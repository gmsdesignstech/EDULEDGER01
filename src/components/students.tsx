"use client";
import Image from "next/image";
import { StudentPhotoImage } from "./student-photo-image";
import { readApiJson } from "@/lib/api-response";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Eye,
  IdCard,
  Loader2,
  MoreHorizontal,
  Pencil,
  Search,
  Sparkles,
  UserPlus,
  X,
} from "lucide-react";
import { DataActions } from "./data-actions";
import { DeleteRecordButton } from "./delete-record-button";
import { bloodGroups } from "@/lib/student-fields";
import { specialQuotas } from "@/lib/student-quota";
import { StudentDemotion } from "./student-demotion";
import { useEduCache, useEduQuery } from "./edu-cache-provider";
import { SubscriptionCapacityModal } from "./subscription-capacity-modal";
import type { SubscriptionSummary } from "@/lib/db";
type Student = {
  id: string;
  name: string;
  admission: string;
  gender: string;
  bloodGroup: string;
  motherName: string;
  specialQuota: string;
  specialQuotaDescription: string;
  dateOfBirth: string;
  className: string;
  section: string;
  academicYear: string;
  grade: string;
  rollNumber: string;
  parent: string;
  parentPhone: string;
  whatsappEnabled: boolean;
  whatsappAttendance: boolean;
  whatsappAcademics: boolean;
  whatsappFees: boolean;
  whatsappNotices: boolean;
  whatsappGeneral: boolean;
  parentEmail: string;
  address: string;
  admissionDate: string;
  attendance: number;
  fee: "Paid" | "Partially Paid" | "Pending" | "Overdue";
  totalFee: number;
  paidFee: number;
  pendingFee: number;
  status: string;
  createdAt: string;
  photoPath?: string;
};
type ConfiguredClass = { name: string; sections: string[] };
type StudentsPayload = {
  students: Student[];
  configuredClasses: ConfiguredClass[];
  academicYears: string[];
  canDemote: boolean;
  canGenerateIds: boolean;
  rollPreview: string;
  rollError: string;
  schoolCode: string;
  academicYear: string;
};
const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
const today = () => new Date().toISOString().slice(0, 10);
const initial = {
  name: "",
  admission: "",
  gender: "Male",
  bloodGroup: "",
  motherName: "",
  specialQuota: "",
  specialQuotaDescription: "",
  dateOfBirth: "",
  className: "",
  section: "",
  rollNumber: "",
  parent: "",
  parentPhone: "",
  whatsappEnabled: false,
  whatsappAttendance: false,
  whatsappAcademics: false,
  whatsappFees: false,
  whatsappNotices: false,
  whatsappGeneral: false,
  parentEmail: "",
  address: "",
  admissionDate: today(),
  totalFee: "",
  dueDate: `${new Date().getFullYear()}-12-31`,
};
export function Students() {
  const [data, setData] = useState<Student[]>([]),
    [configuredClasses, setConfiguredClasses] = useState<ConfiguredClass[]>([]),
    [academicYears, setAcademicYears] = useState<string[]>([]),
    [canDemote, setCanDemote] = useState(false),
    [canGenerateIds, setCanGenerateIds] = useState(false),
    [generatingIds, setGeneratingIds] = useState(false),
    [demoting, setDemoting] = useState<Student | null>(null),
    [query, setQuery] = useState(""),
    [classFilter, setClassFilter] = useState(""),
    [section, setSection] = useState(""),
    [fee, setFee] = useState(""),
    [studentStatus, setStudentStatus] = useState(""),
    [quotaFilter, setQuotaFilter] = useState(""),
    [sort, setSort] = useState("name"),
    [page, setPage] = useState(1),
    [open, setOpen] = useState(false),
    [capacityModal, setCapacityModal] = useState(false),
    [subscription, setSubscription] = useState<SubscriptionSummary>(),
    [editing, setEditing] = useState<Student | null>(null),
    [view, setView] = useState<Student | null>(null),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [formError, setFormError] = useState(""),
    [success, setSuccess] = useState(""),
    [academicYear, setAcademicYear] = useState(""),
    [rollPreview, setRollPreview] = useState(""),
    [rollError, setRollError] = useState(""),
    [schoolCode, setSchoolCode] = useState("");
  const studentsUrl = `/api/students${academicYear ? `?year=${encodeURIComponent(academicYear)}` : ""}`;
  const {
    data: studentPayload,
    error: queryError,
    isLoading: loading,
    mutate,
  } = useEduQuery<StudentsPayload>(studentsUrl);
  const { invalidate } = useEduCache();
  useEffect(() => {
    if (studentPayload) {
      setData(studentPayload.students);
      setConfiguredClasses(studentPayload.configuredClasses || []);
      setAcademicYears(studentPayload.academicYears || []);
      setCanDemote(Boolean(studentPayload.canDemote));
      setCanGenerateIds(Boolean(studentPayload.canGenerateIds));
      setRollPreview(studentPayload.rollPreview || "");
      setRollError(studentPayload.rollError || "");
      setSchoolCode(studentPayload.schoolCode || "");
      if (!academicYear) setAcademicYear(studentPayload.academicYear);
    }
  }, [studentPayload, academicYear]);
  useEffect(() => {
    if (queryError)
      setError(
        queryError instanceof Error
          ? queryError.message
          : "Could not load students.",
      );
  }, [queryError]);
  const load = useCallback(async () => {
    await mutate();
    await invalidate(
      "/api/dashboard",
      "/api/classes",
      "/api/attendance",
      "/api/finance/options",
      "/api/fees",
      "/api/student-payments",
      "/api/accounts",
    );
  }, [mutate, invalidate]);
  useEffect(() => {
    const params = new URLSearchParams(location.search),
      preset = params.get("class") || "";
    if (preset) setClassFilter(preset);
    if (params.get("status"))
      setStudentStatus(
        params.get("status") === "Left"
          ? "Left Out"
          : params.get("status") || "",
      );
    if (params.get("search")) setQuery(params.get("search") || "");
    if (params.get("add") === "1") setOpen(true);
  }, []);
  const filtered = useMemo(
    () =>
      data
        .filter(
          (s) =>
            (
              s.name +
              s.admission +
              s.rollNumber +
              s.className +
              s.section +
              s.parent +
              s.motherName +
              s.bloodGroup +
              s.specialQuota +
              s.specialQuotaDescription +
              s.status
            )
              .toLowerCase()
              .includes(query.toLowerCase()) &&
            (!classFilter || s.className === classFilter) &&
            (!section || s.section === section) &&
            (!fee || s.fee === fee) &&
            (!studentStatus || s.status === studentStatus) &&
            (!quotaFilter ||
              (quotaFilter === "__none__"
                ? !s.specialQuota
                : s.specialQuota === quotaFilter)),
        )
        .sort((a, b) =>
          sort === "attendance"
            ? b.attendance - a.attendance
            : sort === "pending"
              ? b.pendingFee - a.pendingFee
              : sort === "quota"
                ? (a.specialQuota || "").localeCompare(b.specialQuota || "")
                : sort === "roll"
                  ? a.rollNumber.localeCompare(b.rollNumber)
                  : a.name.localeCompare(b.name),
        ),
    [data, query, classFilter, section, fee, studentStatus, quotaFilter, sort],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 10)),
    rows = filtered.slice((page - 1) * 10, page * 10);
  useEffect(
    () => setPage(1),
    [query, classFilter, section, fee, studentStatus, quotaFilter],
  );
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget,
      invalidField = form.querySelector<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >(":invalid");
    if (invalidField) {
      const label =
        invalidField.closest("label")?.firstChild?.textContent?.trim() ||
        invalidField.name;
      setFormError(
        `${label}: ${invalidField.validationMessage || "Enter a valid value."}`,
      );
      invalidField.focus();
      invalidField.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSaving(true);
    setFormError("");
    setError("");
    setSuccess("");
    const f = new FormData(form),
      body: { [key: string]: FormDataEntryValue | string | boolean } = {
        ...Object.fromEntries(f.entries()),
        totalFee: String(f.get("totalFee") || 0),
        academicYear,
      };
    const photoFile = f.get("studentPhoto");
    delete body.studentPhoto;
    if (!editing) {
      body.whatsappEnabled = false;
      body.whatsappAttendance = false;
      body.whatsappAcademics = false;
      body.whatsappFees = false;
      body.whatsappNotices = false;
      body.whatsappGeneral = false;
    }
    try {
      const wasEditing = Boolean(editing),
        r = await fetch(
          editing ? `/api/students/${editing.id}` : "/api/students",
          {
            method: editing ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
      const contentType = r.headers.get("content-type") ?? "";
      const j = contentType.includes("application/json")
        ? await readApiJson(r)
        : null;
      if (!r.ok)
        throw new Error(
          j?.error || `Could not save the student (${r.status}).`,
        );
      const savedStudent = j.student || editing;
      let photoFailure = "";
      if (photoFile instanceof File && photoFile.size > 0) {
        const photoBody = new FormData();
        photoBody.set("photo", photoFile);
        try {
          const photoResponse = await fetch(`/api/students/${savedStudent.id}/photo`, { method: "PUT", body: photoBody });
          const photoResult = await readApiJson(photoResponse);
          if (!photoResponse.ok) photoFailure = photoResult.error || "The photo could not be uploaded.";
        } catch {
          photoFailure = "The photo upload could not be completed.";
        }
      }
      await load();
      setOpen(false);
      setEditing(null);
      setSuccess(
        wasEditing
          ? "Student updated successfully."
          : `Student added successfully. Roll Number: ${j.student?.rollNumber || ""}${photoFailure ? " Photo upload failed; edit this student to retry." : ""}`,
      );
      if (photoFailure) setError(`Student was saved, but the photo was not: ${photoFailure}`);
    } catch (e) {
      setFormError(
        e instanceof Error
          ? e.message
          : "Could not save student. Check your connection and try again.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function generateIds() {
    if (
      !confirm(
        "Generate Student IDs for missing, malformed, or duplicate records? Valid existing IDs will be preserved.",
      )
    )
      return;
    setGeneratingIds(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/students/generate-ids", {
          method: "POST",
        }),
        body = await readApiJson(response);
      if (!response.ok)
        throw new Error(body.error || "Could not generate Student IDs.");
      await load();
      const s = body.summary;
      setSuccess(
        `${s.checked} students checked · ${s.generated} IDs generated · ${s.preserved} existing IDs preserved · ${s.errors} errors.`,
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not generate Student IDs.",
      );
    } finally {
      setGeneratingIds(false);
    }
  }
  function edit(s: Student) {
    setEditing(s);
    setFormError("");
    setOpen(true);
  }
  async function addStudent() {
    setError("");
    try {
      const response = await fetch("/api/subscription/status", {
          cache: "no-store",
        }),
        payload = (await readApiJson(response)) as {
          subscription: SubscriptionSummary;
        };
      if (!response.ok)
        throw new Error("Unable to verify subscription capacity.");
      setSubscription(payload.subscription);
      const item = payload.subscription;
      if (item.studentCapacity && item.studentUsage >= item.studentCapacity) {
        setCapacityModal(true);
        return;
      }
      setEditing(null);
      setFormError("");
      setOpen(true);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to verify subscription capacity.",
      );
    }
  }
  const classes = [
      ...new Set([
        ...configuredClasses.map((x) => x.name),
        ...data.map((s) => s.className).filter(Boolean),
      ]),
    ].sort(),
    sections = [
      ...new Set([
        ...configuredClasses.flatMap((x) => x.sections),
        ...data.map((s) => s.section).filter(Boolean),
      ]),
    ].sort();
  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHead
        eyebrow="People"
        title="Students"
        text="Manage enrollment, attendance and fee records from one source of truth."
      >
        <select
          aria-label="Academic year"
          className="rounded-full border bg-panel px-4 py-2.5 text-sm font-bold"
          value={academicYear}
          onChange={(e) => setAcademicYear(e.target.value)}
        >
          {academicYears.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <DataActions
          type="students"
          exportQuery={`search=${encodeURIComponent(query)}&class=${encodeURIComponent(classFilter)}&section=${encodeURIComponent(section)}&status=${encodeURIComponent(fee)}&year=${encodeURIComponent(academicYear)}`}
          onDeleted={() => setData([])}
        />
        {canGenerateIds && (
          <button
            className="btn-secondary"
            disabled={generatingIds}
            onClick={generateIds}
          >
            {generatingIds ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {generatingIds ? "Generating…" : "Generate Missing IDs"}
          </button>
        )}
        <Link className="btn-secondary" href="/dashboard/students/id-cards">
          <IdCard className="size-4" />
          ID Cards
        </Link>
        {canGenerateIds && (
          <Link className="btn-secondary" href="/dashboard/students/lifecycle">
            Lifecycle
          </Link>
        )}
        <Link
          className="btn-secondary border-violet-300 text-violet-700"
          href="/dashboard/students/promote"
        >
          <ArrowUpRight className="size-4" />
          Promote
        </Link>
        <button
          className="btn-primary"
          onClick={() => void addStudent()}
        >
          <UserPlus className="size-4" />
          Add student
        </button>
      </PageHead>
      {(error || success) && (
        <div
          role="alert"
          className={`mt-5 rounded-xl border p-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}
        >
          {error || success}
        </div>
      )}
      <div className="card mt-7 overflow-hidden">
        <div className="grid gap-3 border-b p-4 md:grid-cols-6">
          <label className="flex items-center gap-2 rounded-xl border px-3 md:col-span-2">
            <Search className="size-4 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent py-2.5 outline-none"
              placeholder="Name, admission no., class..."
            />
          </label>
          <Select
            value={classFilter}
            set={setClassFilter}
            label="All classes"
            options={classes}
          />
          <Select
            value={section}
            set={setSection}
            label="All sections"
            options={sections}
          />
          <Select
            value={fee}
            set={setFee}
            label="All fee statuses"
            options={["Paid", "Partially Paid", "Pending", "Overdue"]}
          />
          <Select
            value={studentStatus}
            set={setStudentStatus}
            label="All student statuses"
            options={[
              "Active",
              "Left Out",
              "Transferred",
              "Graduated",
              "Inactive",
              "Archived",
            ]}
          />
          <select
            aria-label="Filter by special quota"
            className="rounded-xl border bg-panel px-3 py-2.5 text-sm"
            value={quotaFilter}
            onChange={(e) => setQuotaFilter(e.target.value)}
          >
            <option value="">All quotas</option>
            <option value="__none__">No Special Quota</option>
            {specialQuotas.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
          <select
            className="rounded-xl border bg-panel px-3 py-2 text-sm md:col-start-6"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="name">Sort: Name</option>
            <option value="attendance">Sort: Attendance</option>
            <option value="pending">Sort: Pending fee</option>
            <option value="quota">Sort: Special Quota</option>
            <option value="roll">Sort: Roll Number</option>
          </select>
        </div>
        {loading ? (
          <Loading text="Loading students..." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-left text-sm">
              <thead className="bg-canvas text-xs uppercase tracking-wider text-muted">
                <tr>
                  {[
                    "Student",
                    "Admission number",
                    "Class",
                    "Section",
                    "Academic Year",
                    "Roll no.",
                    "Blood Group",
                    "Mother Name",
                    "Special Quota",
                    "Parent / Phone",
                    "Attendance",
                    "Total fee",
                    "Paid fee",
                    "Pending fee",
                    "Fee status",
                    "Status",
                    "Actions",
                  ].map((h) => (
                    <th className="px-4 py-4" key={h}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((s) => (
                  <tr className="hover:bg-canvas/60" key={s.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {s.photoPath ? <StudentPhotoImage studentId={s.id} name={s.name} size={36} className="size-9 rounded-full object-cover"/> : <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-brand/10 font-bold text-brand">{s.name.split(" ").map((x) => x[0]).slice(0, 2).join("")}</span>}
                        <b>{s.name}</b>
                      </div>
                    </td>
                    <td className="px-4">{s.admission}</td>
                    <td className="px-4">{s.className}</td>
                    <td className="px-4">{s.section || "—"}</td>
                    <td className="px-4">{s.academicYear}</td>
                    <td className="px-4">{s.rollNumber || "—"}</td>
                    <td className="px-4">{s.bloodGroup || "Not provided"}</td>
                    <td className="px-4">{s.motherName || "—"}</td>
                    <td className="px-4">
                      {s.specialQuota || "No Quota"}
                      {s.specialQuota === "Other" && s.specialQuotaDescription
                        ? ` - ${s.specialQuotaDescription}`
                        : ""}
                    </td>
                    <td className="px-4">
                      <b className="block">{s.parent}</b>
                      <span className="text-xs text-muted">
                        {s.parentPhone || "No phone"}
                      </span>
                    </td>
                    <td
                      className={`px-4 font-bold ${s.attendance < 75 ? "text-red-600" : s.attendance < 90 ? "text-orange-600" : ""}`}
                    >
                      {s.attendance}%
                    </td>
                    <td className="px-4">{money(s.totalFee)}</td>
                    <td className="px-4 text-emerald-600">
                      {money(s.paidFee)}
                    </td>
                    <td className="px-4 font-bold">{money(s.pendingFee)}</td>
                    <td className="px-4">
                      <Badge status={s.fee} />
                    </td>
                    <td className="px-4">{s.status}</td>
                    <td className="px-4">
                      <div className="flex gap-1">
                        <button
                          className="icon-btn"
                          title="View"
                          onClick={() => setView(s)}
                        >
                          <Eye />
                        </button>
                        <button
                          className="icon-btn"
                          title="Edit"
                          onClick={() => edit(s)}
                        >
                          <Pencil />
                        </button>
                        <Link
                          className="icon-btn"
                          title="View fees and add payment"
                          href={`/dashboard/payments?search=${encodeURIComponent(s.admission)}`}
                        >
                          <MoreHorizontal />
                        </Link>
                        {canDemote &&
                          s.status === "Active" &&
                          configuredClasses.findIndex(
                            (item) => item.name === s.className,
                          ) > 0 && (
                            <button
                              className="btn-secondary"
                              onClick={() => setDemoting(s)}
                            >
                              Demote
                            </button>
                          )}
                        <DeleteRecordButton
                          label={`student ${s.name}`}
                          details={`${s.admission} · ${s.className}-${s.section} · Roll ${s.rollNumber || "—"}`}
                          url={`/api/students/${s.id}`}
                          onComplete={async () => {
                            await load();
                            setSuccess("Student archived successfully.");
                          }}
                          onError={setError}
                          action="Archive"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && (
              <Empty
                title="No students found"
                text="Try changing your filters or add a new student."
              />
            )}
          </div>
        )}
        <div className="flex items-center justify-between border-t p-4 text-sm text-muted">
          <span>
            Showing {rows.length} of {filtered.length} students
          </span>
          <div className="flex items-center gap-2">
            <button
              className="btn-secondary !px-3 !py-1.5"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <span>
              {page} / {pages}
            </span>
            <button
              className="btn-secondary !px-3 !py-1.5"
              disabled={page === pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
      {subscription && (
        <SubscriptionCapacityModal
          open={capacityModal}
          onClose={() => setCapacityModal(false)}
          subscription={subscription}
        />
      )}
      {open && (
        <StudentModal
          classes={configuredClasses}
          rollPreview={rollPreview}
          rollError={rollError}
          schoolCode={schoolCode}
          academicYear={academicYear}
          student={editing}
          initialData={{ ...initial, className: classFilter }}
          error={formError}
          onClose={() => {
            setOpen(false);
            setEditing(null);
            setFormError("");
          }}
          onSubmit={submit}
          saving={saving}
        />
      )}{" "}
      {view && (
        <StudentView
          student={view}
          onClose={() => setView(null)}
          onEdit={() => { setEditing(view); setView(null); setFormError(""); setOpen(true); }}
          onDemote={() => {
            setDemoting(view);
            setView(null);
          }}
          canDemote={canDemote}
          hasLowerClass={
            configuredClasses.findIndex(
              (item) => item.name === view.className,
            ) > 0
          }
        />
      )}{" "}
      {demoting && (
        <StudentDemotion
          student={demoting}
          onClose={() => setDemoting(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
function PageHead({
  eyebrow,
  title,
  text,
  children,
}: {
  eyebrow: string;
  title: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start justify-between gap-4 xl:flex-row xl:items-end">
      <div>
        <p className="label">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-black">{title}</h1>
        <p className="mt-1 text-muted">{text}</p>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
function Select({
  value,
  set,
  label,
  options,
}: {
  value: string;
  set: (v: string) => void;
  label: string;
  options: string[];
}) {
  return (
    <select
      className="rounded-xl border bg-panel px-3 py-2.5 text-sm"
      value={value}
      onChange={(e) => set(e.target.value)}
    >
      <option value="">{label}</option>
      {options.map((x) => (
        <option key={x}>{x}</option>
      ))}
    </select>
  );
}
function Badge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-bold ${status === "Paid" ? "bg-emerald-100 text-emerald-700" : status === "Overdue" ? "bg-red-100 text-red-700" : status === "Partially Paid" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}
    >
      {status}
    </span>
  );
}
function Loading({ text }: { text: string }) {
  return (
    <div className="grid min-h-72 place-items-center text-sm text-muted">
      <div className="text-center">
        <Loader2 className="mx-auto mb-3 animate-spin text-brand" />
        {text}
      </div>
    </div>
  );
}
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="p-12 text-center">
      <b>{title}</b>
      <p className="mt-1 text-sm text-muted">{text}</p>
    </div>
  );
}
function StudentModal({
  student,
  initialData,
  error,
  onClose,
  onSubmit,
  saving,
  classes,
  rollPreview,
  rollError,
  schoolCode,
  academicYear,
}: {
  student: Student | null;
  rollPreview: string;
  rollError: string;
  schoolCode: string;
  academicYear: string;
  initialData: typeof initial;
  error: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  saving: boolean;
  classes: ConfiguredClass[];
}) {
  const d = student ?? initialData,
    [selectedClass, setSelectedClass] = useState(
      d.className || classes[0]?.name || "",
    ),
    availableSections =
      classes.find((x) => x.name === selectedClass)?.sections || [],
    [selectedQuota, setSelectedQuota] = useState(d.specialQuota || ""),
    [photoUrl,setPhotoUrl]=useState(student?.photoPath?`/api/students/${student.id}/photo`:""),
    [photoError,setPhotoError]=useState(""),
    [photoBusy,setPhotoBusy]=useState(false),
    photoInput=useRef<HTMLInputElement>(null);
  useEffect(()=>()=>{if(photoUrl.startsWith("blob:"))URL.revokeObjectURL(photoUrl)},[photoUrl]);
  function rejectPhoto(message:string){setPhotoError(message);if(photoInput.current)photoInput.current.value=""}
  async function uploadPhoto(file:File){
    setPhotoError("");if(file.size===0){rejectPhoto("The selected file is empty.");return}if(file.size>5*1024*1024){rejectPhoto("Photo must be 5 MB or smaller.");return}
    if(!["image/jpeg","image/png","image/webp"].includes(file.type)){rejectPhoto("Choose a JPG, PNG, or WebP photo.");return}
    let decoded:ImageBitmap;try{decoded=await createImageBitmap(file)}catch{rejectPhoto("This image is corrupted or cannot be decoded.");return}const validSize=decoded.width>=120&&decoded.height>=120&&decoded.width<=8000&&decoded.height<=8000;decoded.close();if(!validSize){rejectPhoto("Photo dimensions must be between 120 × 120 and 8000 × 8000 pixels.");return}
    const preview=URL.createObjectURL(file);setPhotoUrl(preview);if(!student)return;
    setPhotoBusy(true);const body=new FormData();body.set("photo",file);
    try{const response=await fetch(`/api/students/${student.id}/photo`,{method:"PUT",body}),payload=await readApiJson(response);if(!response.ok)throw new Error(payload.error||"Could not save photo.");setPhotoUrl(`${payload.photoUrl}?v=${Date.now()}`)}catch(error){setPhotoUrl(student.photoPath?`/api/students/${student.id}/photo`:"");setPhotoError(error instanceof Error?error.message:"Could not save photo.")}finally{setPhotoBusy(false)}
  }
  async function removePhoto(){
    if(typeof window!=="undefined"&&!window.confirm("Are you sure you want to remove this student's photograph?"))return;
    if(!student){setPhotoUrl("");if(photoInput.current)photoInput.current.value="";return}setPhotoBusy(true);try{const response=await fetch(`/api/students/${student.id}/photo`,{method:"DELETE"});if(!response.ok)throw new Error("Could not remove photo.");setPhotoUrl("")}catch(error){setPhotoError(error instanceof Error?error.message:"Could not remove photo.")}finally{setPhotoBusy(false)}
  }
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/45 p-4">
      <form
        noValidate
        onSubmit={onSubmit}
        className="card max-h-[92vh] w-full max-w-3xl overflow-y-auto p-6 sm:p-8"
      >
        <div className="flex justify-between">
          <div>
            <h2 className="text-xl font-bold">
              {student ? "Edit student" : "Add student"}
            </h2>
            <p className="text-sm text-muted">
              Enrollment and annual fee information.
            </p>
          </div>
          <button type="button" onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-4 rounded-2xl border p-4 sm:col-span-2">
            {photoUrl?<Image src={photoUrl} unoptimized width={80} height={80} alt="Student photo preview" className="size-20 rounded-2xl object-cover"/>:<div className="grid size-20 place-items-center rounded-2xl bg-violet-100 font-black text-violet-700">{(d.name||"Student").split(/\s+/).map(word=>word[0]).slice(0,2).join("")}</div>}
            <div className="flex-1"><p className="font-bold">Student photograph</p><p className="text-xs text-muted">JPG, PNG or WebP · up to 5 MB · minimum 120 × 120 pixels</p><div className="mt-2 flex flex-wrap gap-2"><label className="btn-secondary cursor-pointer">{photoUrl?"Change photo":"Upload photo"}<input ref={photoInput} name="studentPhoto" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={photoBusy} onChange={event=>{const file=event.target.files?.[0];if(file)void uploadPhoto(file)}}/></label>{photoUrl&&<button type="button" className="btn-secondary" disabled={photoBusy} onClick={()=>void removePhoto()}>Remove</button>}{photoBusy&&<span className="text-sm text-muted">Saving…</span>}</div>{photoError&&<p role="alert" className="mt-2 text-sm text-red-600">{photoError}</p>}</div>
          </div>
          <Field name="name" label="Student name" value={d.name} />
          <Field
            name="admission"
            label="Admission number"
            value={d.admission}
          />
          <Field
            name="gender"
            label="Gender"
            select={["Male", "Female", "Other"]}
            value={d.gender}
          />
          <Field
            name="dateOfBirth"
            label="Date of birth"
            type="date"
            value={d.dateOfBirth}
          />
          <label className="text-sm font-bold">
            Blood Group
            <select
              name="bloodGroup"
              defaultValue={d.bloodGroup || ""}
              className="mt-2 w-full rounded-xl border bg-canvas px-4 py-3 font-normal"
            >
              <option value="">Select blood group</option>
              {bloodGroups.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          </label>
          <Field
            name="motherName"
            label="Mother Name"
            value={d.motherName || ""}
          />
          <label className="text-sm font-bold">
            Special Quota
            <select
              name="specialQuota"
              value={selectedQuota}
              onChange={(e) => setSelectedQuota(e.target.value)}
              className="mt-2 w-full rounded-xl border bg-canvas px-4 py-3 font-normal"
            >
              <option value="">No Special Quota</option>
              {specialQuotas.map((quota) => (
                <option key={quota} value={quota}>
                  {quota}
                </option>
              ))}
            </select>
          </label>
          {selectedQuota === "Other" && (
            <Field
              name="specialQuotaDescription"
              label="Quota Name / Description"
              value={d.specialQuotaDescription || ""}
            />
          )}
          <label className="text-sm font-bold">
            Class
            <select
              required
              name="className"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="mt-2 w-full rounded-xl border bg-canvas px-4 py-3 font-normal"
            >
              <option value="">Select class</option>
              {classes.map((x) => (
                <option key={x.name}>{x.name}</option>
              ))}
            </select>
          </label>
          <Field
            name="section"
            label="Section"
            select={availableSections.length ? availableSections : undefined}
            value={availableSections.includes(d.section) ? d.section : ""}
          />
          <label className="text-sm font-bold">
            Roll Number
            <input
              readOnly
              aria-label="Roll Number"
              value={
                student
                  ? d.rollNumber
                  : rollPreview || (rollError ? "Unavailable" : "Generating...")
              }
              className="mt-2 w-full rounded-xl border bg-canvas px-4 py-3 font-normal"
            />
            <span className="mt-1 block text-xs font-normal text-muted">
              {schoolCode || "Set school code in Settings"} ·{" "}
              {academicYear || "Select academic year"}
              {!student && " · Finalized when saved"}
            </span>
            {!student && rollError && (
              <span className="mt-1 block text-xs font-semibold text-red-600">
                {rollError}
              </span>
            )}
          </label>
          <Field
            name="admissionDate"
            label="Admission date"
            type="date"
            value={d.admissionDate}
          />
          <Field name="parent" label="Parent / guardian" value={d.parent} />
          <Field
            name="parentPhone"
            label="Parent phone"
            value={d.parentPhone}
          />
          <Field
            name="parentEmail"
            label="Parent email"
            type="email"
            value={d.parentEmail}
          />
          <Field
            name="totalFee"
            label="Total annual fee"
            type="number"
            min="0"
            value={String(d.totalFee)}
          />
          {!student && (
            <Field
              name="dueDate"
              label="Fee due date"
              type="date"
              value={initialData.dueDate}
            />
          )}
          <label className="text-sm font-bold sm:col-span-2">
            Address
            <textarea
              name="address"
              defaultValue={d.address}
              className="mt-2 min-h-20 w-full rounded-xl border bg-canvas px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-brand"
            />
          </label>
        </div>
        {error && (
          <p
            role="alert"
            aria-live="assertive"
            className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        <div className="mt-7 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || (!student && Boolean(rollError))}
            className="btn-primary disabled:cursor-wait disabled:opacity-70"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? "Saving student..." : "Save student"}
          </button>
        </div>
      </form>
    </div>
  );
}
function Field({
  name,
  label,
  value,
  type = "text",
  select,
  disabled = false,
  min,
}: {
  name: string;
  label: string;
  value: string;
  type?: string;
  select?: string[];
  disabled?: boolean;
  min?: string;
}) {
  const fee = name === "totalFee";
  return (
    <label className="text-sm font-bold">
      {fee ? `${label} (₹)` : label}
      {select ? (
        <select
          name={name}
          defaultValue={value}
          className="mt-2 w-full rounded-xl border bg-canvas px-4 py-3 font-normal"
        >
          {select.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      ) : (
        <input
          required={
            ![
              "rollNumber",
              "motherName",
              "parentPhone",
              "parentEmail",
              "totalFee",
            ].includes(name)
          }
          name={name}
          type={type}
          min={min}
          max={fee ? "100000000" : undefined}
          step={fee ? "0.01" : undefined}
          inputMode={fee ? "decimal" : undefined}
          maxLength={
            name === "motherName" || name === "specialQuotaDescription"
              ? 100
              : undefined
          }
          defaultValue={value}
          disabled={disabled}
          aria-describedby={fee ? "total-fee-help" : undefined}
          className="mt-2 w-full rounded-xl border bg-canvas px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-brand disabled:opacity-60"
        />
      )}
      {fee && (
        <small
          id="total-fee-help"
          className="mt-1 block font-normal text-muted"
        >
          Enter the student&apos;s total fee. Recorded payments will remain
          unchanged.
        </small>
      )}
    </label>
  );
}
function StudentView({
  student: s,
  onClose,
  onEdit,
  onDemote,
  canDemote,
  hasLowerClass,
}: {
  student: Student;
  onClose: () => void;
  onEdit: () => void;
  onDemote: () => void;
  canDemote: boolean;
  hasLowerClass: boolean;
}) {
  const [history, setHistory] = useState<
    {
      academicYear: string;
      className: string;
      section: string;
      status: string;
      promotedAt: string | null;
    }[]
  >([]);
  useEffect(() => {
    fetch(`/api/student-promotions?mode=student-history&studentId=${s.id}`)
      .then((r) => (r.ok ? readApiJson(r) : { history: [] }))
      .then((j) => setHistory(j.history || []));
  }, [s.id]);
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/45 p-4">
      <div className="card max-h-[92vh] w-full max-w-xl overflow-y-auto p-7">
        <div className="flex justify-between">
          <div>
            {s.photoPath ? <StudentPhotoImage studentId={s.id} name={s.name} size={72} className="mb-3 size-[72px] rounded-2xl object-cover"/> : <span aria-hidden="true" className="mb-3 grid size-[72px] place-items-center rounded-2xl bg-violet-100 text-xl font-black text-violet-700">{s.name.split(/\s+/).map(part=>part[0]).slice(0,2).join("").toUpperCase()}</span>}
            <p className="label">Student profile</p>
            <h2 className="mt-2 text-2xl font-black">{s.name}</h2>
            <p className="text-muted">
              {s.admission} · {s.className}-{s.section}
            </p>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 rounded-2xl bg-canvas p-4 text-sm">
          <div>
            <span className="text-muted">Attendance</span>
            <b className="block text-xl">{s.attendance}%</b>
          </div>
          <div>
            <span className="text-muted">Fee status</span>
            <b className="block text-xl">{s.fee}</b>
          </div>
          <div>
            <span className="text-muted">Total fee</span>
            <b className="block">{money(s.totalFee)}</b>
          </div>
          <div>
            <span className="text-muted">Paid / pending</span>
            <b className="block">
              {money(s.paidFee)} / {money(s.pendingFee)}
            </b>
          </div>
        </div>
        <section className="mt-5 rounded-2xl border p-4">
          <h3 className="font-bold">Personal &amp; Family Information</h3>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            {[
              ["Student Name", s.name],
              ["Date of Birth", s.dateOfBirth || "—"],
              ["Gender", s.gender || "—"],
              ["Blood Group", s.bloodGroup || "Not provided"],
              ["Father / Guardian Name", s.parent || "—"],
              ["Mother Name", s.motherName || "—"],
              ["Phone Number", s.parentPhone || "—"],
              ["Email", s.parentEmail || "—"],
              ["Address", s.address || "—"],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="mt-1 break-words font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="mt-5 rounded-2xl border p-4">
          <h3 className="font-bold">Admission Information</h3>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted">Roll Number</dt>
              <dd className="mt-1 font-semibold">{s.rollNumber || "-"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Admission Number</dt>
              <dd className="mt-1 font-semibold">{s.admission}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Academic Year</dt>
              <dd className="mt-1 font-semibold">{s.academicYear}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">School Code</dt>
              <dd className="mt-1 font-semibold">
                {/^[A-Z]{3}[0-9]{7,}$/.test(s.rollNumber)
                  ? s.rollNumber.slice(0, 3)
                  : "-"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Special Quota</dt>
              <dd className="mt-1 font-semibold">
                {s.specialQuota || "No Quota"}
              </dd>
            </div>
            {s.specialQuota === "Other" && (
              <div>
                <dt className="text-xs text-muted">Quota Description</dt>
                <dd className="mt-1 break-words font-semibold">
                  {s.specialQuotaDescription || "-"}
                </dd>
              </div>
            )}
          </dl>
        </section>
        <div className="mt-5">
          <b className="text-sm">Academic History</b>
          <div className="mt-2 space-y-2">
            {history.map((x) => (
              <div
                key={x.academicYear}
                className="rounded-xl border bg-canvas p-3 text-sm"
              >
                <b>
                  {x.academicYear} — {x.className}
                  {x.section ? ` — ${x.section}` : ""}
                </b>
                <p className="text-xs text-muted">
                  {x.status}
                  {x.promotedAt
                    ? ` · Promoted ${new Date(x.promotedAt + "Z").toLocaleDateString("en-IN")}`
                    : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <button className="btn-secondary" onClick={onEdit}>Edit student and photo</button>
          <Link
            className="btn-secondary"
            href={`/dashboard/payment-history?studentId=${s.id}`}
          >
            Payment history
          </Link>
          {canDemote && (
            <button className="btn-secondary" onClick={onDemote}>
              {hasLowerClass ? "Demote Student" : "Demotion history"}
            </button>
          )}
          <Link
            className="btn-primary"
            href={`/dashboard/students/promote?studentId=${s.id}&sourceYear=${encodeURIComponent(s.academicYear)}&sourceClass=${encodeURIComponent(s.className)}&sourceSection=${encodeURIComponent(s.section)}`}
          >
            Promote Student
          </Link>
        </div>
      </div>
    </div>
  );
}
