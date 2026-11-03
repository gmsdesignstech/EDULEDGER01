import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFImage } from "pdf-lib";
import sharp from "sharp";
import { getAdminSalary, getSchoolAsset } from "@/lib/db";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
const allowed = (role: string) => ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"].includes(role);
const money = (paise: unknown) => `Rs. ${(Number(paise || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthenticated" }, { status: 401 });
  if (!allowed(user.role)) return Response.json({ error: "Forbidden" }, { status: 403 });
  const salary = await getAdminSalary((await params).id,user.institutionId);
  if (!salary) return Response.json({ error: "Payroll record not found." }, { status: 404 });
  if (Number(salary.paid_paise || 0) <= 0) return Response.json({ error: "A salary slip is available only after a payment is recorded." }, { status: 409 });

  const [logoAsset, signatureAsset] = await Promise.all([getSchoolAsset(user.institutionId, "logo"), getSchoolAsset(user.institutionId, "signature")]);
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(.08, .15, .27), blue = rgb(.15, .28, .55), muted = rgb(.38, .43, .51), line = rgb(.84, .87, .91), panel = rgb(.96, .97, .99), green = rgb(.08, .45, .31);
  const text = (value: unknown, x: number, y: number, size = 9, strong = false, color = navy) => page.drawText(String(value ?? ""), { x, y, size, font: strong ? bold : font, color });
  const right = (value: unknown, x: number, y: number, size = 9, strong = false, color = navy) => { const rendered = String(value ?? ""); text(rendered, x - (strong ? bold : font).widthOfTextAtSize(rendered, size), y, size, strong, color); };
  const field = (label: string, value: unknown, x: number, y: number) => { text(label.toUpperCase(), x, y, 7, true, muted); text(value || "—", x, y - 15, 10, true); };
  const logo = await image(doc, logoAsset, "eduledger-logo.jpeg"), signature = await image(doc, signatureAsset);

  page.drawRectangle({ x: 0, y: 752, width: 595, height: 90, color: navy });
  if (logo) page.drawImage(logo, { x: 44, y: 772, width: 48, height: 48 });
  text(String(salary.school || "School"), 108, 803, 18, true, rgb(1, 1, 1));
  text([salary.address, salary.phone].filter(Boolean).join(" · ") || "School Administration", 108, 783, 8, false, rgb(.84, .88, .94));
  right("SALARY SLIP", 551, 803, 15, true, rgb(1, 1, 1));
  right(`${months[Number(salary.salary_month) - 1]} ${salary.salary_year}`, 551, 783, 9, false, rgb(.84, .88, .94));

  page.drawRectangle({ x: 44, y: 650, width: 507, height: 78, color: panel, borderColor: line, borderWidth: .7 });
  field("Payment reference", salary.payment_reference || salary.payslip_number, 58, 706);
  field("Payment date", salary.payment_date || "—", 310, 706);
  field("Salary month", `${months[Number(salary.salary_month) - 1]} ${salary.salary_year}`, 58, 670);
  field("Payment status", String(salary.payment_status).toUpperCase(), 310, 670);

  text("EMPLOYEE INFORMATION", 44, 620, 9, true, blue);
  page.drawLine({ start: { x: 44, y: 612 }, end: { x: 551, y: 612 }, thickness: .8, color: line });
  field("Staff name", salary.employee_name, 58, 590); field("Staff ID", salary.employee_number, 310, 590);
  field("Designation", salary.designation || salary.employee_role, 58, 552); field("Department", salary.department, 310, 552);

  const table = (title: string, rows: Array<[string, unknown]>, top: number, totalLabel: string, total: unknown) => {
    page.drawRectangle({ x: 44, y: top - 25, width: 507, height: 25, color: blue });
    text(title, 57, top - 17, 9, true, rgb(1, 1, 1)); right("AMOUNT", 537, top - 17, 8, true, rgb(1, 1, 1));
    let y = top - 48;
    for (const [label, value] of rows) { text(label, 58, y, 9); right(money(value), 537, y, 9); page.drawLine({ start: { x: 52, y: y - 9 }, end: { x: 543, y: y - 9 }, thickness: .45, color: line }); y -= 24; }
    page.drawRectangle({ x: 44, y: y - 7, width: 507, height: 29, color: panel }); text(totalLabel, 58, y + 3, 9, true); right(money(total), 537, y + 3, 10, true, blue);
    return y - 25;
  };
  let y = table("EARNINGS", [["Basic salary", salary.basic_paise], ["Allowances", salary.allowances_paise], ["Bonus", salary.bonus_paise], ["Overtime", salary.overtime_paise], ["Other earnings", salary.other_earnings_paise]], 515, "GROSS SALARY", salary.gross_paise);
  y = table("DEDUCTIONS", [["Standard deductions", salary.deductions_paise], ["Advance deduction", salary.advance_deduction_paise], ["Other deductions", salary.other_deductions_paise]], y, "TOTAL DEDUCTIONS", salary.total_deductions_paise);

  page.drawRectangle({ x: 44, y: 128, width: 507, height: 58, color: rgb(.91, .97, .94), borderColor: rgb(.65, .84, .75), borderWidth: .8 });
  text("NET SALARY", 59, 164, 9, true, green); text(money(salary.net_paise), 59, 141, 19, true, green);
  right(`Paid via ${salary.payment_method || "—"}`, 536, 158, 8, true, muted); right(String(salary.payment_status).toUpperCase(), 536, 141, 9, true, green);

  page.drawLine({ start: { x: 55, y: 72 }, end: { x: 190, y: 72 }, thickness: .7, color: navy }); text("Employee Signature", 77, 57, 8, true, muted);
  if (signature) page.drawImage(signature, { x: 405, y: 74, width: 100, height: 38 });
  page.drawLine({ start: { x: 386, y: 72 }, end: { x: 531, y: 72 }, thickness: .7, color: navy }); text(salary.signatureLabel || "Authorized Signatory", 405, 57, 8, true, muted);
  text(salary.footer || "Generated securely by EduLedger", 44, 28, 7, false, muted);

  const bytes = await doc.save();
  return new Response(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="Salary_Slip_${salary.payslip_number}.pdf"`, "Cache-Control": "private, no-store" } });
}

async function image(doc: PDFDocument, asset: { mimeType: string; data: Buffer } | undefined, fallback?: string): Promise<PDFImage | undefined> {
  if (asset?.mimeType === "image/png") return doc.embedPng(asset.data);
  if (asset?.mimeType === "image/jpeg") return doc.embedJpg(asset.data);
  if (asset?.mimeType === "image/webp") return doc.embedPng(await sharp(asset.data).png().toBuffer());
  return fallback ? doc.embedJpg(await readFile(join(process.cwd(), "public", fallback))) : undefined;
}
