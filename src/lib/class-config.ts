export const STANDARD_CLASS_NAMES = [
  "Nursery",
  "LKG",
  "UKG",
  ...Array.from({ length: 10 }, (_, index) => `Class ${index + 1}`),
] as const;
