import { z } from "zod";

export const chatRequestSchema = z.object({
  conversationId: z.string().uuid(),
  requestId: z.string().uuid(),
  message: z.string().trim().min(1).max(2000),
  language: z.enum(["en-GB", "en-US", "ar-SA", "fr-FR"]).default("en-GB"),
}).strict();

export const createConversationSchema = z.object({ title: z.string().trim().min(1).max(120).optional() }).strict();

export type ChatRequest = z.infer<typeof chatRequestSchema>;
