import { z } from "zod";

export const specialQuotas = [
  "General", "RTE", "EWS", "Sports", "Disability / PwD",
  "Single Girl Child", "Staff Quota", "Management Quota", "Other",
] as const;

export const specialQuotaSchema = z.preprocess(
  value => value == null || value === "No Special Quota" ? "" : value,
  z.union([z.enum(specialQuotas), z.literal("")]).optional(),
);

export const quotaDescriptionSchema = z.preprocess(
  value => value == null ? "" : value,
  z.string().trim().max(100, "Quota description must be 100 characters or fewer.")
    .regex(/^[\p{L}\p{M}\p{N}\p{Zs}.,'’()\/-]*$/u, "Enter a valid quota description.").optional(),
);

export function quotaPairError(quota?: string, description?: string) {
  if (quota === "Other" && !description?.trim()) return "Enter a description for Other quota.";
  if (quota !== "Other" && description?.trim()) return "Quota description is only allowed for Other quota.";
  return null;
}
