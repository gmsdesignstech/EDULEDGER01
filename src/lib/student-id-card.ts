/**
 * Helper utilities for Student Identity Cards in EduLedger
 */

export function formatParentPhone(phone?: string | null): string {
  if (!phone || typeof phone !== "string") return "Not Provided";
  const trimmed = phone.trim();
  if (!trimmed || trimmed === "—" || trimmed === "-" || trimmed.toLowerCase() === "null") {
    return "Not Provided";
  }
  const digits = trimmed.replace(/\D/g, "");
  if (!digits || digits.length < 5) return "Not Provided";

  // Standard 10-digit mobile number (e.g. 9876543210 -> +91 98765 43210)
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }

  // 12-digit number starting with 91 (e.g. 919876543210 -> +91 98765 43210)
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }

  // 11-digit number starting with 0 (e.g. 09876543210 -> +91 98765 43210)
  if (digits.length === 11 && digits.startsWith("0")) {
    return `+91 ${digits.slice(1, 6)} ${digits.slice(6)}`;
  }

  // If already formatted with international code
  if (trimmed.startsWith("+")) {
    // Keep clean format with space if possible
    if (digits.length > 10) {
      const countryCodeLen = digits.length - 10;
      return `+${digits.slice(0, countryCodeLen)} ${digits.slice(countryCodeLen, countryCodeLen + 5)} ${digits.slice(countryCodeLen + 5)}`;
    }
    return trimmed;
  }

  return `+${digits}`;
}

