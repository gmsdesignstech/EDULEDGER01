import "server-only";
import { NextResponse } from "next/server";
import { currentUser } from "./session";
import { teacherPortalScope } from "./db";

const noStore = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Pragma: "no-cache",
};

export async function teacherApiContext() {
  const user = await currentUser();
  if (!user)
    return { response: NextResponse.json({ error: "Unauthenticated" }, { status: 401, headers: noStore }) };
  if (user.role !== "TEACHER")
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403, headers: noStore }) };
  try {
    return { user, scope: await teacherPortalScope(user.institutionId, user.email) };
  } catch (error) {
    return {
      response: NextResponse.json(
        { error: error instanceof Error ? error.message : "Teacher account is not linked." },
        { status: 403, headers: noStore },
      ),
    };
  }
}

export const teacherNoStore = noStore;
