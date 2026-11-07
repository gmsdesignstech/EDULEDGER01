"use client";

import { readApiJson } from "@/lib/api-response";
import { useState } from "react";
import {
  Building2,
  Calendar,
  CheckCircle2,
  GraduationCap,
  KeyRound,
  Link as LinkIcon,
  Loader2,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  User,
  UserCheck,
} from "lucide-react";
import { useParentContext } from "@/components/parent-context";
import { StudentPhotoImage } from "@/components/student-photo-image";

export default function ParentProfilePage() {
  const { selectedChild, children: childList, refreshChildren } = useParentContext();
  const [linking, setLinking] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [admissionNo, setAdmissionNo] = useState("");
  const [phoneNo, setPhoneNo] = useState("");
  const [linkMode, setLinkMode] = useState<"code" | "admission">("code");
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [linkSuccess, setLinkSuccess] = useState("");

  if (!selectedChild) {
    return (
      <div className="py-12 text-center text-sm text-muted">
        Select a child from the top bar to view profile details.
      </div>
    );
  }

  async function handleLinkChild(e: React.FormEvent) {
    e.preventDefault();
    setLinkLoading(true);
    setLinkError("");
    setLinkSuccess("");

    try {
      const payload: Record<string, string> = {};
      if (linkMode === "code") {
        payload.invitationCode = inviteCode.trim();
      } else {
        payload.admission = admissionNo.trim();
        payload.parentPhone = phoneNo.trim();
      }

      // Re-use activate API with current parent user's info or link endpoint
      const res = await fetch("/api/parent/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          name: selectedChild?.parent || "Parent",
          email: selectedChild?.parentEmail || "parent@eduledger.invalid",
          password: "dummyTemporaryPassword123!", // handled if user already exists
        }),
      });

      const data = await readApiJson(res);
      if (!res.ok) {
        throw new Error(data.error || "Failed to link child.");
      }

      setLinkSuccess("Child linked to your account successfully!");
      setInviteCode("");
      setAdmissionNo("");
      setPhoneNo("");
      setLinking(false);
      await refreshChildren();
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : "Linking failed.");
    } finally {
      setLinkLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground">Student Profile</h1>
          <p className="mt-1 text-xs text-muted">
            Academic, personal, and guardian records for {selectedChild.name}
          </p>
        </div>

        <button
          onClick={() => setLinking(!linking)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-blue-500"
        >
          <LinkIcon className="size-3.5" />
          Link Another Child
        </button>
      </div>

      {/* Link Child Modal / Collapsible Section */}
      {linking && (
        <div className="rounded-3xl border border-blue-500/30 bg-panel p-6 shadow-md">
          <h2 className="text-sm font-bold text-foreground">Link Another Child to Your Parent Account</h2>
          <p className="mt-1 text-xs text-muted">
            Enter a school-issued invitation code or the student&apos;s admission number with your registered phone number.
          </p>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setLinkMode("code")}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
                linkMode === "code" ? "bg-blue-600 text-white" : "border text-muted"
              }`}
            >
              Invitation Code
            </button>
            <button
              type="button"
              onClick={() => setLinkMode("admission")}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
                linkMode === "admission" ? "bg-blue-600 text-white" : "border text-muted"
              }`}
            >
              Admission & Phone
            </button>
          </div>

          {linkError && (
            <p className="mt-3 text-xs text-red-500 font-semibold">{linkError}</p>
          )}

          <form onSubmit={handleLinkChild} className="mt-4 space-y-3">
            {linkMode === "code" ? (
              <div>
                <input
                  type="text"
                  required
                  placeholder="PRNT-XXXXXX"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  className="w-full max-w-sm rounded-xl border bg-canvas px-3.5 py-2 text-xs font-mono uppercase text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                <input
                  type="text"
                  required
                  placeholder="Admission No. (e.g. ADM-001)"
                  value={admissionNo}
                  onChange={(e) => setAdmissionNo(e.target.value)}
                  className="rounded-xl border bg-canvas px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <input
                  type="tel"
                  required
                  placeholder="Registered Phone No."
                  value={phoneNo}
                  onChange={(e) => setPhoneNo(e.target.value)}
                  className="rounded-xl border bg-canvas px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={linkLoading}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                {linkLoading ? "Linking..." : "Confirm & Link"}
              </button>
              <button
                type="button"
                onClick={() => setLinking(false)}
                className="rounded-xl border px-4 py-2 text-xs font-bold text-muted"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {linkSuccess && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-bold text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="size-4" />
          <span>{linkSuccess}</span>
        </div>
      )}

      {/* Main Student Card */}
      <div className="rounded-3xl border bg-panel p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-6">
          <div className="flex items-center gap-4">
            <StudentPhotoImage studentId={selectedChild.id} name={selectedChild.name} size={56} className="rounded-2xl object-cover shadow-md" />
            <div>
              <h2 className="text-xl font-black text-foreground">{selectedChild.name}</h2>
              <p className="text-xs text-muted">
                Class {selectedChild.className} - {selectedChild.section} • Roll No: {selectedChild.rollNumber || "—"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
              Relationship: {selectedChild.relationship || "Parent"}
            </span>
            {selectedChild.isPrimary && (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                Primary Contact
              </span>
            )}
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 gap-6 pt-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Academic Details */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Academic Information</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b py-1.5">
                <span className="text-muted">Admission No:</span>
                <span className="font-mono font-bold text-foreground">{selectedChild.admission}</span>
              </div>
              <div className="flex justify-between border-b py-1.5">
                <span className="text-muted">Class & Section:</span>
                <span className="font-semibold text-foreground">
                  {selectedChild.className} - {selectedChild.section}
                </span>
              </div>
              <div className="flex justify-between border-b py-1.5">
                <span className="text-muted">Academic Year:</span>
                <span className="font-semibold text-foreground">{selectedChild.academicYear}</span>
              </div>
              <div className="flex justify-between border-b py-1.5">
                <span className="text-muted">Admission Date:</span>
                <span className="font-semibold text-foreground">{selectedChild.admissionDate || "—"}</span>
              </div>
              <div className="flex justify-between border-b py-1.5">
                <span className="text-muted">Student Status:</span>
                <span className="font-bold text-emerald-600">{selectedChild.status}</span>
              </div>
            </div>
          </div>

          {/* Personal Details */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Personal Information</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b py-1.5">
                <span className="text-muted">Gender:</span>
                <span className="font-semibold text-foreground">{selectedChild.gender || "—"}</span>
              </div>
              <div className="flex justify-between border-b py-1.5">
                <span className="text-muted">Date of Birth:</span>
                <span className="font-semibold text-foreground">{selectedChild.dateOfBirth || "—"}</span>
              </div>
              <div className="flex justify-between border-b py-1.5">
                <span className="text-muted">Guardian Name:</span>
                <span className="font-semibold text-foreground">{selectedChild.parent || "—"}</span>
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Contact & Address</h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 border-b py-1.5">
                <Phone className="size-3.5 text-blue-600" />
                <span className="text-muted">Phone:</span>
                <span className="font-semibold text-foreground">{selectedChild.parentPhone || "—"}</span>
              </div>
              <div className="flex items-center gap-2 border-b py-1.5">
                <Mail className="size-3.5 text-blue-600" />
                <span className="text-muted">Email:</span>
                <span className="font-semibold text-foreground truncate">{selectedChild.parentEmail || "—"}</span>
              </div>
              <div className="flex items-start gap-2 border-b py-1.5">
                <MapPin className="size-3.5 mt-0.5 text-blue-600 shrink-0" />
                <div>
                  <span className="text-muted block">Address:</span>
                  <span className="font-semibold text-foreground">{selectedChild.address || "—"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

