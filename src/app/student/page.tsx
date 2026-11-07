export default function StudentHomePage() {
  return (
    <section className="mx-auto max-w-3xl rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-950 shadow-sm sm:p-9">
      <h1 className="text-2xl font-black">Student records are not linked yet</h1>
      <p className="mt-3 text-sm leading-6">
        Your school account is signed in, but EduLedger does not yet have a verified link between this account and a student record. No student, attendance, fee, or result information is being shown.
      </p>
      <p className="mt-3 text-sm leading-6">Contact your school administrator to activate and link your student profile.</p>
    </section>
  );
}
