import { z } from "zod";

export const sessionFormSchema = z.object({
  problemStatement: z
    .string()
    .min(10, "Problem statement must be at least 10 characters")
    .max(2000, "Problem statement must be less than 2000 characters"),
  expertIds: z
    .array(z.string())
    .min(2, "Select at least 2 experts")
    .max(10, "Select at most 10 experts"),
  maxMessages: z
    .number()
    .int("Max messages must be a whole number")
    .min(5, "Max messages must be at least 5")
    .max(200, "Max messages must be at most 200")
    .default(30),
});

export type SessionFormValues = z.infer<typeof sessionFormSchema>;

