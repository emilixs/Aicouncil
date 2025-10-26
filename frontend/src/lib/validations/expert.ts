import { z } from "zod";
import { DriverType } from "@/types";

export const expertFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  specialty: z.string().min(1, "Specialty is required").max(200, "Specialty must be less than 200 characters"),
  systemPrompt: z.string().min(10, "System prompt must be at least 10 characters").max(5000, "System prompt must be less than 5000 characters"),
  driverType: z.nativeEnum(DriverType, {
    required_error: "Driver type is required",
  }),
  config: z.object({
    model: z.string().min(1, "Model is required"),
    temperature: z.number().min(0, "Temperature must be at least 0").max(2, "Temperature must be at most 2").optional(),
    maxTokens: z.number().int().positive("Max tokens must be positive").optional(),
    topP: z.number().min(0, "Top P must be at least 0").max(1, "Top P must be at most 1").optional(),
  }),
});

export type ExpertFormValues = z.infer<typeof expertFormSchema>;

