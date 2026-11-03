import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getUserBySession } from "./db";
import { roleHome, safeParentRedirect, safeSchoolRedirect, safeTeacherRedirect } from "./auth-redirect";
import type { AppRole } from "./rbac";
export const SESSION_COOKIE = "eduledger_session";
export const currentUser = cache(async function currentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? await getUserBySession(token) : undefined;
});
export async function requireUser(next = "/dashboard") {
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(safeSchoolRedirect(next))}`);
  return user;
}

export async function requireRole(role: AppRole, next = roleHome(role)) {
  const user = await currentUser();
  if (!user) {
    if (role === "TEACHER") {
      redirect(`/teacher/login?next=${encodeURIComponent(safeTeacherRedirect(next))}`);
    }
    if (role === "PARENT") {
      redirect(`/parent/login?next=${encodeURIComponent(safeParentRedirect(next))}`);
    }
    redirect(`/login?next=${encodeURIComponent(safeSchoolRedirect(next))}`);
  }
  if (user.role !== role) redirect(roleHome(user.role));
  return user;
}
