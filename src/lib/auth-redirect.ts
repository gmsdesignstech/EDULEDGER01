import { WHATSAPP_ADDON_MAX_STUDENTS } from "./whatsapp-pricing";

const SCHOOL_DESTINATIONS = ["/dashboard", "/register", "/subscription", "/whatsapp/subscribe", "/payment/success"] as const;

export function roleHome(role: string) {
  if (role === "SUPER_ADMIN") return "/admin";
  if (role === "TEACHER") return "/teacher";
  if (role === "PARENT") return "/parent";
  if (role === "STUDENT") return "/student";
  return "/dashboard";
}

export function whatsappAddonCheckoutHref(studentCount: number) {
  const count =
    Number.isInteger(studentCount) &&
    studentCount >= 1 &&
    studentCount <= WHATSAPP_ADDON_MAX_STUDENTS
      ? studentCount
      : 1;
  return `/whatsapp/subscribe?students=${count}`;
}

export function annualCheckoutHref(studentCount: number) {
  const count =
    Number.isInteger(studentCount) &&
    studentCount >= 1 &&
    studentCount <= WHATSAPP_ADDON_MAX_STUDENTS
      ? studentCount
      : 1;
  return `/subscription?students=${count}`;
}

export function schoolEnrollmentHref(studentCount: number) {
  const count =
    Number.isInteger(studentCount) &&
    studentCount >= 1 &&
    studentCount <= WHATSAPP_ADDON_MAX_STUDENTS
      ? studentCount
      : 1;
  return `/register?students=${count}`;
}

export function safeTeacherRedirect(value: string | null | undefined, fallback = "/teacher") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  try {
    const url = new URL(value, "https://eduledger.invalid");
    if (url.origin !== "https://eduledger.invalid") return fallback;
    return (url.pathname === "/teacher" || url.pathname.startsWith("/teacher/"))
      ? `${url.pathname}${url.search}${url.hash}`
      : fallback;
  } catch {
    return fallback;
  }
}

export function safeParentRedirect(value: string | null | undefined, fallback = "/parent") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  try {
    const url = new URL(value, "https://eduledger.invalid");
    if (url.origin !== "https://eduledger.invalid") return fallback;
    return (url.pathname === "/parent" || url.pathname.startsWith("/parent/"))
      ? `${url.pathname}${url.search}${url.hash}`
      : fallback;
  } catch {
    return fallback;
  }
}

export function safeStudentRedirect(value: string | null | undefined, fallback = "/student") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  try {
    const url = new URL(value, "https://eduledger.invalid");
    if (url.origin !== "https://eduledger.invalid") return fallback;
    return url.pathname === "/student" || url.pathname.startsWith("/student/")
      ? `${url.pathname}${url.search}${url.hash}`
      : fallback;
  } catch {
    return fallback;
  }
}

export function schoolAccountDestination(input: {
  role: string;
  subscriptionStatus?: string;
  paymentStatus?: string;
  orderId?: string | null;
  requested?: string | null;
}) {
  const home = roleHome(input.role);
  if (input.role === "TEACHER") {
    return safeTeacherRedirect(input.requested);
  }
  if (input.role === "PARENT") {
    return safeParentRedirect(input.requested);
  }
  if (input.role === "STUDENT") {
    return safeStudentRedirect(input.requested);
  }
  if (home !== "/dashboard" || input.role !== "SCHOOL_ADMIN") return home;
  if (["ACTIVE", "EXPIRING_SOON"].includes(input.subscriptionStatus ?? ""))
    return safeSchoolRedirect(input.requested);
  if (
    input.orderId &&
    (["PENDING", "UPCOMING"].includes(input.subscriptionStatus ?? "") ||
      input.paymentStatus === "Paid")
  )
    return `/payment/success?product=subscription&order=${encodeURIComponent(input.orderId)}&next=${encodeURIComponent("/dashboard")}`;
  return "/subscription";
}

export function safeSchoolRedirect(value: string | null | undefined, fallback = "/dashboard") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  try {
    const url = new URL(value, "https://eduledger.invalid");
    if (url.origin !== "https://eduledger.invalid") return fallback;
    const allowed = SCHOOL_DESTINATIONS.some(
      (prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`),
    );
    return allowed ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}
