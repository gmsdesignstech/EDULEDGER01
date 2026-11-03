import { generateMissingStudentIds } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { logServerError } from "@/lib/server-errors";

export const runtime = "nodejs";

export async function POST() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthenticated" }, { status: 401 });
  if (!["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(user.role))
    return Response.json({ error: "Only school administrators can generate Student IDs." }, { status: 403 });
  try {
    return Response.json({ summary: await generateMissingStudentIds(user.institutionId, user.id) });
  } catch (error) {
    if (error instanceof Error && /School code must/.test(error.message))
      return Response.json({ error: error.message }, { status: 400 });
    logServerError("students.generate-ids", error);
    return Response.json({ error: "Student IDs could not be generated. No partial changes were saved." }, { status: 500 });
  }
}
