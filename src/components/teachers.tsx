"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Eye, Loader2, Pencil, Plus, Search, X } from "lucide-react";
import { DataActions } from "./data-actions";
import { DeleteRecordButton } from "./delete-record-button";
import { parseTeacherClasses, standardTeacherClasses } from "@/lib/teacher-classes";
import { useEduCache, useEduQuery } from "./edu-cache-provider";

type Teacher = {
  id: string; name: string; employeeId: string; email: string; phone: string;
  department: string; subject: string; classes: string; assignedClasses?: string[];
  joiningDate: string; salary: number; status: string; createdAt: string;
};
const empty = {
  name: "", employeeId: "", email: "", phone: "", department: "", subject: "",
  classes: "", joiningDate: new Date().toISOString().slice(0, 10), salary: 0, status: "Active",
};

export function Teachers() {
  const [data, setData] = useState<Teacher[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [classOptions, setClassOptions] = useState<string[]>(standardTeacherClasses);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Teacher | null>(null);
  const [view, setView] = useState<Teacher | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");

  const { data: teacherPayload, error: queryError, isLoading: loading, mutate } = useEduQuery<{ teachers: Teacher[]; canEdit: boolean; classOptions: string[] }>("/api/teachers");
  const { invalidate } = useEduCache();
  async function load() { await mutate(); await invalidate("/api/timetable", "/api/classes", "/api/salaries", "/api/dashboard"); }
  useEffect(() => { if (teacherPayload) { setData(teacherPayload.teachers || []); setCanEdit(Boolean(teacherPayload.canEdit)); setClassOptions(teacherPayload.classOptions || standardTeacherClasses) } }, [teacherPayload]);
  useEffect(() => { if (queryError) setMessage(queryError instanceof Error ? queryError.message : "Could not load teachers.") }, [queryError]);

  const rows = useMemo(() => data.filter(teacher =>
    [teacher.name, teacher.employeeId, teacher.subject, teacher.department, teacher.classes]
      .join(" ").toLowerCase().includes(query.toLowerCase()),
  ), [data, query]);

  async function submit(event: React.FormEvent<HTMLFormElement>, classes: string[]) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    const raw = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, unknown>;
    if (!raw.password) delete raw.password;
    const body = { ...raw, classes };
    try {
      const response = await fetch(edit ? `/api/teachers/${edit.id}` : "/api/teachers", {
        method: edit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save the teacher.");
      setOpen(false);
      setEdit(null);
      setMessage(edit ? "Teacher updated." : "Teacher added.");
      await load();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not save the teacher.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="mx-auto max-w-7xl">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="label">People</p><h1 className="mt-2 text-3xl font-black">Teachers</h1><p className="mt-1 text-muted">Manage faculty profiles, subjects and assigned classes.</p></div>
      {canEdit && <div className="flex flex-wrap gap-2"><DataActions type="teachers" onDeleted={() => setData([])} /><button className="btn-primary" onClick={() => { setEdit(null); setFormError(""); setOpen(true); }}><Plus className="size-4" />Add teacher</button></div>}
    </div>
    {message && <p role="status" className="mt-5 rounded-xl border bg-panel p-3 text-sm">{message}</p>}
    <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[["Total teachers", data.length], ["Active", data.filter(x => x.status === "Active").length], ["On leave", data.filter(x => x.status === "On Leave").length], ["Departments", new Set(data.map(x => x.department)).size]].map(([label, value]) =>
        <div className="card p-5" key={label}><p className="text-sm text-muted">{label}</p><b className="mt-2 block text-3xl">{value}</b></div>)}
    </section>
    <div className="card mt-5 overflow-hidden">
      <div className="border-b p-4"><label className="flex max-w-md items-center gap-2 rounded-xl border px-3"><Search className="size-4" /><input className="w-full bg-transparent py-2.5 outline-none" placeholder="Name, employee ID, subject, class..." value={query} onChange={event => setQuery(event.target.value)} /></label></div>
      {loading ? <div className="grid min-h-64 place-items-center"><Loader2 className="animate-spin text-brand" /></div> : <div className="overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-sm">
        <thead className="bg-canvas text-xs uppercase text-muted"><tr>{["Teacher", "Employee ID", "Department", "Primary subject", "Assigned classes", "Phone / Email", "Joining date", "Status", "Actions"].map(label => <th className="px-4 py-4" key={label}>{label}</th>)}</tr></thead>
        <tbody className="divide-y">{rows.map(teacher => <tr key={teacher.id}>
          <td className="px-4 py-4 font-bold">{teacher.name}</td><td className="px-4">{teacher.employeeId}</td><td className="px-4">{teacher.department}</td><td className="px-4">{teacher.subject}</td>
          <td className="px-4"><div className="flex max-w-sm flex-wrap gap-1.5">{(teacher.assignedClasses || parseTeacherClasses(teacher.classes)).length ? (teacher.assignedClasses || parseTeacherClasses(teacher.classes)).map(name => <span key={name} className="rounded-lg bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-700">{name}</span>) : <span className="text-muted">—</span>}</div></td>
          <td className="px-4"><b className="block">{teacher.phone}</b><span className="text-xs text-muted">{teacher.email}</span></td><td className="px-4">{teacher.joiningDate}</td><td className="px-4"><span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">{teacher.status}</span></td>
          <td className="px-4"><div className="flex gap-1"><button className="icon-btn" aria-label={`View ${teacher.name}`} onClick={() => setView(teacher)}><Eye /></button>{canEdit && <><button className="icon-btn" aria-label={`Edit ${teacher.name}`} onClick={() => { setEdit(teacher); setFormError(""); setOpen(true); }}><Pencil /></button><DeleteRecordButton label={`teacher ${teacher.name}`} details={`Employee ${teacher.employeeId} · ${teacher.department}`} url={`/api/teachers/${teacher.id}`} onComplete={async () => { await load(); setMessage("Teacher archived successfully."); }} onError={setMessage} action="Archive" /></>}</div></td>
        </tr>)}</tbody>
      </table>{!rows.length && <p className="p-12 text-center text-muted">No teachers found. Add your first teacher to get started.</p>}</div>}
    </div>
    {open && <TeacherModal key={edit?.id || "new"} teacher={edit} classOptions={classOptions} saving={saving} error={formError} close={() => { setOpen(false); setEdit(null); }} submit={submit} />}
    {view && <TeacherDetails teacher={view} close={() => setView(null)} />}
  </div>;
}

function TeacherModal({ teacher, classOptions, saving, error, close, submit }: {
  teacher: Teacher | null; classOptions: string[]; saving: boolean; error: string;
  close: () => void; submit: (event: React.FormEvent<HTMLFormElement>, classes: string[]) => void;
}) {
  const data = teacher || empty;
  const [selected, setSelected] = useState<string[]>(teacher?.assignedClasses || parseTeacherClasses(data.classes));
  const fields: [keyof typeof empty, string, string?][] = [["name", "Teacher name"], ["employeeId", "Employee ID"], ["department", "Department"], ["subject", "Primary subject"], ["phone", "Phone", "tel"], ["email", "Email", "email"], ["joiningDate", "Joining date", "date"], ["salary", "Salary", "number"]];
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-black/45 p-4"><form onSubmit={event => submit(event, selected)} className="card max-h-[90vh] w-full max-w-2xl overflow-y-auto p-5 sm:p-7">
    <div className="flex justify-between"><h2 className="text-xl font-bold">{teacher ? "Edit teacher" : "Add teacher"}</h2><button type="button" aria-label="Close teacher form" onClick={close}><X /></button></div>
    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      {fields.map(([key, label, type]) => <label className="text-sm font-bold" key={key}>{label}<input required={!(["email"] as string[]).includes(key)} name={key} type={type || "text"} min={key === "salary" ? "0" : undefined} defaultValue={String(data[key])} className="mt-2 w-full rounded-xl border bg-canvas px-4 py-3 font-normal" /></label>)}
      <div className="sm:col-span-2"><AssignedClassesSelect options={classOptions} selected={selected} onChange={setSelected} /></div>
      <label className="text-sm font-bold">Portal Password (Optional)<input name="password" type="password" minLength={8} placeholder={teacher ? "Leave blank to keep existing" : "Min 8 characters"} className="mt-2 w-full rounded-xl border bg-canvas px-4 py-3 font-normal" /></label>
      <label className="text-sm font-bold">Status<select name="status" defaultValue={data.status} className="mt-2 w-full rounded-xl border bg-canvas px-4 py-3 font-normal"><option>Active</option><option>Inactive</option><option>On Leave</option></select></label>
    </div>
    {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="mt-6 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={close}>Cancel</button><button className="btn-primary" disabled={saving}>{saving && <Loader2 className="size-4 animate-spin" />}{saving ? "Saving teacher..." : "Save teacher"}</button></div>
  </form></div>;
}

function AssignedClassesSelect({ options, selected, onChange }: { options: string[]; selected: string[]; onChange: (values: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const allOptions = useMemo(() => {
    const seen = new Set<string>();
    return [...standardTeacherClasses, ...options, ...selected].filter(name => {
      const key = name.toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [options, selected]);
  const visible = allOptions.filter(name => name.toLowerCase().includes(search.trim().toLowerCase()));
  const isSelected = (name: string) => selected.some(item => item.toLocaleLowerCase() === name.toLocaleLowerCase());
  useEffect(() => {
    if (!open) return;
    searchInput.current?.focus();
    const outside = (event: PointerEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  function toggle(name: string) {
    onChange(isSelected(name) ? selected.filter(item => item.toLocaleLowerCase() !== name.toLocaleLowerCase()) : [...selected, name]);
  }
  return <div ref={root} className="relative text-sm"><span id="assigned-classes-label" className="font-bold">Assigned Classes</span>
    <button ref={trigger} type="button" aria-labelledby="assigned-classes-label" aria-expanded={open} aria-controls="assigned-classes-options" onClick={() => setOpen(value => !value)} className="mt-2 flex min-h-12 w-full items-center justify-between rounded-xl border bg-canvas px-4 py-3 text-left font-normal focus:outline-none focus:ring-2 focus:ring-brand">
      <span className={selected.length ? "font-semibold" : "text-muted"}>{selected.length ? `${selected.length} class${selected.length === 1 ? "" : "es"} selected` : "Select assigned classes"}</span><ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
    {selected.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{selected.map(name => <button key={name} type="button" aria-label={`Remove ${name}`} onClick={() => toggle(name)} className="inline-flex items-center gap-1 rounded-lg bg-violet-100 px-2.5 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-200">{name}<X className="size-3" /></button>)}<button type="button" onClick={() => onChange([])} className="px-2 text-xs font-semibold text-muted underline hover:text-red-600">Clear all</button></div>}
    {open && <div id="assigned-classes-options" className="absolute left-0 right-0 top-full z-30 mt-2 rounded-xl border bg-panel p-2 shadow-xl">
      <div className="flex items-center gap-2 rounded-lg border px-3"><Search className="size-4 text-muted" /><input ref={searchInput} type="search" aria-label="Search classes" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search classes..." className="w-full bg-transparent py-2.5 outline-none" /></div>
      <div className="mt-2 max-h-56 overflow-y-auto">{visible.length ? visible.map(name => <label key={name} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-canvas"><input type="checkbox" checked={isSelected(name)} onChange={() => toggle(name)} className="size-4 accent-violet-600" /><span className="flex-1">{name}</span>{isSelected(name) && <Check className="size-4 text-violet-600" />}</label>) : <p className="px-3 py-4 text-center text-muted">No classes found</p>}</div>
    </div>}
  </div>;
}

function TeacherDetails({ teacher, close }: { teacher: Teacher; close: () => void }) {
  const classes = teacher.assignedClasses || parseTeacherClasses(teacher.classes);
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-black/45 p-4"><div role="dialog" aria-modal="true" aria-label={`Teacher details for ${teacher.name}`} className="card max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
    <div className="flex items-start justify-between"><div><p className="label">Teacher profile</p><h2 className="mt-2 text-2xl font-bold">{teacher.name}</h2><p className="text-sm text-muted">{teacher.employeeId} · {teacher.department}</p></div><button type="button" aria-label="Close teacher details" onClick={close}><X /></button></div>
    <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">{[["Primary subject", teacher.subject], ["Email", teacher.email], ["Phone", teacher.phone], ["Joining date", teacher.joiningDate], ["Status", teacher.status]].map(([label, value]) => <div key={label}><dt className="text-muted">{label}</dt><dd className="mt-1 font-semibold">{value || "—"}</dd></div>)}</dl>
    <div className="mt-6"><h3 className="font-bold">Assigned Classes</h3><div className="mt-3 flex flex-wrap gap-2">{classes.length ? classes.map(name => <span key={name} className="rounded-lg bg-violet-100 px-3 py-1.5 text-sm font-semibold text-violet-700">{name}</span>) : <span className="text-sm text-muted">No classes assigned</span>}</div></div>
  </div></div>;
}
