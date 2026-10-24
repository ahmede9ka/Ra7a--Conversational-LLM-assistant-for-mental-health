import { z } from "zod";
import { activityCategories } from "./content";

const boundedText = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) => boundedText(max).optional().default("");

export const recordSchemas = {
  mood: z.object({
    rating: z.number().int().min(1).max(5),
    emotions: z.array(z.string().trim().min(1).max(40)).max(8).default([]),
    stress: z.number().int().min(1).max(5).nullable().default(null),
    note: optionalText(1000),
    context: z.array(z.enum(["Sleep", "Movement", "Time outdoors", "Connection", "Work or study", "Health", "Significant event", "Other"])).max(8).default([]),
  }).strict(),
  reflection: z.object({
    answers: z.object({
      situation: optionalText(1200),
      thought: optionalText(1200),
      emotions: z.array(z.string().trim().min(1).max(40)).max(8).default([]),
      intensity: z.number().int().min(1).max(5).nullable().default(null),
      supports: optionalText(1000),
      otherPerspective: optionalText(1000),
      friendPerspective: optionalText(1000),
      alternative: optionalText(1200),
      reflection: optionalText(1000),
    }).strict(),
    status: z.enum(["draft", "completed"]),
  }).strict(),
  activity: z.object({
    title: z.string().trim().min(1).max(120),
    category: z.enum(activityCategories),
    scheduledAt: z.string().datetime().nullable().default(null),
    durationMinutes: z.number().int().min(1).max(240),
    difficulty: z.enum(["easy", "manageable"]),
    status: z.enum(["planned", "completed", "skipped"]),
    reflection: optionalText(500),
    moodBefore: z.number().int().min(1).max(5).nullable().default(null),
    moodAfter: z.number().int().min(1).max(5).nullable().default(null),
  }).strict(),
  exercise: z.object({
    exerciseId: z.enum(["comfortable-breathing", "five-senses-grounding"]),
    contentVersion: z.number().int().positive(),
    status: z.enum(["completed", "stopped"]),
    feedback: z.enum(["helpful", "not-for-me", "skip"]).nullable().default(null),
    durationSeconds: z.number().int().min(0).max(3600),
  }).strict(),
  weekly_reflection: z.object({
    periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    sources: z.array(z.enum(["mood", "activity"])).max(2),
    moodCheckIns: z.number().int().min(0).max(200),
    activitiesCompleted: z.number().int().min(0).max(200),
    summary: z.string().trim().min(1).max(600),
    answers: z.object({ manageable: optionalText(800), difficult: optionalText(800), repeat: optionalText(800), differently: optionalText(800) }).strict(),
    status: z.enum(["saved", "dismissed"]),
  }).strict(),
} as const;

export const createRecordSchema = z.discriminatedUnion("recordType", [
  z.object({ recordType: z.literal("mood"), data: recordSchemas.mood }).strict(),
  z.object({ recordType: z.literal("reflection"), data: recordSchemas.reflection }).strict(),
  z.object({ recordType: z.literal("activity"), data: recordSchemas.activity }).strict(),
  z.object({ recordType: z.literal("exercise"), data: recordSchemas.exercise }).strict(),
  z.object({ recordType: z.literal("weekly_reflection"), data: recordSchemas.weekly_reflection }).strict(),
]);

export const updateRecordSchema = z.discriminatedUnion("recordType", [
  z.object({ recordType: z.literal("reflection"), data: recordSchemas.reflection }).strict(),
  z.object({ recordType: z.literal("activity"), data: recordSchemas.activity }).strict(),
  z.object({ recordType: z.literal("exercise"), data: recordSchemas.exercise }).strict(),
  z.object({ recordType: z.literal("weekly_reflection"), data: recordSchemas.weekly_reflection }).strict(),
]);

export const moodRatingLabels = ["Very low", "Low", "In between", "Good", "Very good"] as const;
