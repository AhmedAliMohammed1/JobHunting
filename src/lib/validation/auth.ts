import { z } from "zod";

export const emailSchema = z.string().trim().email("Enter a valid email address.").max(320);
export const signInSchema = z.object({ email: emailSchema, password: z.string().min(8, "Password must be at least 8 characters.").max(1_000) });
export const registrationSchema = z.object({ email: emailSchema, password: z.string().min(12, "Password must be at least 12 characters.").max(1_000) });
export const resetRequestSchema = z.object({ email: emailSchema });
export const passwordUpdateSchema = z.object({ password: z.string().min(12, "Password must be at least 12 characters.").max(1_000) });
