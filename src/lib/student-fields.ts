import { z } from "zod";

export const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown", "Not Provided"] as const;

export const bloodGroupSchema = z.preprocess(
  value => value === null ? "" : value,
  z.union([z.enum(bloodGroups), z.literal("")]).optional(),
);

export const motherNameSchema = z.preprocess(
  value => value === null ? "" : value,
  z.string().trim().max(100, "Mother name must be 100 characters or fewer.")
    .regex(/^[\p{L}\p{M}\p{Zs}.'’\-]*$/u, "Enter a valid mother name.").optional(),
);

export function studentImportValue(row: Record<string, string | number | null>, aliases: string[]) {
  const normalized = new Set(aliases.map(key => key.toLowerCase().replace(/[^a-z0-9]/g, "")));
  const match = Object.entries(row).find(([key]) => normalized.has(key.toLowerCase().replace(/[^a-z0-9]/g, "")));
  return String(match?.[1] ?? "").trim();
}
