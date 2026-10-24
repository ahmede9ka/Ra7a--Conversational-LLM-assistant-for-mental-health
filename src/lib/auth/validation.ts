import { z } from "zod";

const email = z.string().trim().email().max(254, "Email address is too long.");
const password = z.string().min(8, "Use at least 8 characters.").max(72, "Password is too long.");

export const signInSchema = z.object({ email, password });
export const signUpSchema = z.object({
  email,
  password,
  displayName: z.string().trim().max(80, "Name must be 80 characters or fewer.").optional().default(""),
});

export type AuthActionState = { error?: string; message?: string };
