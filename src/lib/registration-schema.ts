import { z } from "zod";

export const registrationSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  institution: z.string().trim().min(2).max(150),
  phone: z.string().trim().regex(/^\+?[0-9][0-9\s-]{7,18}$/, "Enter a valid phone number."),
  password: z.string().min(8).max(128)
    .regex(/[a-z]/, "Password must include a lowercase letter.")
    .regex(/[A-Z]/, "Password must include an uppercase letter.")
    .regex(/[0-9]/, "Password must include a number."),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: "You must accept the Terms of Service and Privacy Policy." }),
  }),
  studentCount: z.coerce.number().int().min(1).max(100000),
  subscriptionStartMonth: z.string(),
  subscriptionEndMonth: z.string(),
});

