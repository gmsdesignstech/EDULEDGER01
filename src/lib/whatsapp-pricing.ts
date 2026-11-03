import { ANNUAL_PRICE_PER_STUDENT, STARTER_ANNUAL_PRICE, STARTER_STUDENT_LIMIT, annualPricingQuote } from "./subscription-plans";

export const WHATSAPP_ADDON_ANNUAL_PRICE_PER_STUDENT = ANNUAL_PRICE_PER_STUDENT;
export const WHATSAPP_ADDON_FIXED_ANNUAL_PRICE = STARTER_ANNUAL_PRICE;
export const WHATSAPP_ADDON_FIXED_PRICE_LIMIT = STARTER_STUDENT_LIMIT;
export const WHATSAPP_ADDON_MIN_STUDENTS = 1;
export const WHATSAPP_ADDON_MAX_STUDENTS = 100_000;

export type WhatsAppAddonQuote = {
  studentCount: number;
  pricePerStudent: number;
  amount: number;
  billingPeriod: "year";
  pricingMethod: "fixed" | "per-student";
};

export function whatsappAddonQuote(
  studentCount: number,
  minimumEligibleStudents = WHATSAPP_ADDON_MIN_STUDENTS,
): WhatsAppAddonQuote | undefined {
  if (
    !Number.isInteger(studentCount) ||
    studentCount < Math.max(WHATSAPP_ADDON_MIN_STUDENTS, minimumEligibleStudents) ||
    studentCount > WHATSAPP_ADDON_MAX_STUDENTS
  )
    return undefined;

  const quote = annualPricingQuote(studentCount);
  if (!quote) return undefined;
  return {
    studentCount,
    pricePerStudent: WHATSAPP_ADDON_ANNUAL_PRICE_PER_STUDENT,
    amount: quote.amount,
    billingPeriod: "year",
    pricingMethod: quote.pricingMethod,
  };
}
