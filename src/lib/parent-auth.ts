import "server-only";
import { NextResponse } from "next/server";
import { currentUser } from "./session";
import { parentChildren } from "./db";

const noStore = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Pragma: "no-cache",
};

export async function parentApiContext(studentId?: string | null) {
  const user = await currentUser();
  if (!user) {
    return { response: NextResponse.json({ error: "Unauthenticated" }, { status: 401, headers: noStore }) };
  }
  if (user.role !== "PARENT") {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403, headers: noStore }) };
  }

  const children = await parentChildren(user.institutionId, user.id);
  if (studentId) {
    const authorized = children.some((c) => c.id === studentId);
    if (!authorized) {
      return {
        response: NextResponse.json(
          { error: "You are not authorized to access this student." },
          { status: 403, headers: noStore },
        ),
      };
    }
  }

  return { user, children, noStore };
}

export const parentNoStore = noStore;

