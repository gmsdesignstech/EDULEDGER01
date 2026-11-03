import { z } from "zod";
import { STANDARD_CLASS_NAMES } from "./class-config";

export const standardTeacherClasses = [...STANDARD_CLASS_NAMES];

const canonical = new Map(standardTeacherClasses.map(name => [name.toLowerCase(), name]));

export function parseTeacherClasses(value: string | null | undefined): string[] {
  const found = new Set<string>();
  const result: string[] = [];
  for (const part of (value || "").split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const name = canonical.get(trimmed.toLowerCase()) || trimmed;
    const key = name.toLocaleLowerCase();
    if (found.has(key)) continue;
    found.add(key);
    result.push(name);
  }
  return result;
}

export function serializeTeacherClasses(values: readonly string[]): string {
  return parseTeacherClasses(values.join(",")).join(", ");
}

export const teacherClassesSchema = z.array(
  z.string().trim().min(1).max(50).regex(/^[\p{L}\p{N}\p{Zs}.'’/-]+$/u, "Invalid class name"),
).max(30).refine(values => new Set(values.map(value => value.toLocaleLowerCase())).size === values.length, "Select each class only once");

export const teacherClassesInputSchema = z.union([teacherClassesSchema, z.string().trim().max(1000)])
  .transform(value => Array.isArray(value) ? value : parseTeacherClasses(value));
