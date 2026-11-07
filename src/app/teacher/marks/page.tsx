import { redirect } from "next/navigation";

export default function TeacherMarksRedirect() {
  redirect("/teacher/exams");
}

