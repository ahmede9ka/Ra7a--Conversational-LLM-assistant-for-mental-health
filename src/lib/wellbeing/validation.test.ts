import { describe, expect, it } from "vitest";
import { createRecordSchema, recordSchemas, updateRecordSchema } from "@/lib/wellbeing/validation";

describe("wellbeing record validation", () => {
  it("accepts a valid mood entry with optional details", () => {
    expect(recordSchemas.mood.safeParse({ rating: 4, emotions: ["Calm"], stress: null, note: "A quiet afternoon", context: ["Time outdoors"] }).success).toBe(true);
  });

  it("rejects mood ratings outside the labeled 1–5 scale", () => {
    for (const rating of [0, 6, -1, 2.5]) expect(recordSchemas.mood.safeParse({ rating }).success).toBe(false);
  });

  it("rejects client-supplied owner identity and unknown record properties", () => {
    expect(createRecordSchema.safeParse({ recordType: "mood", user_id: "someone-else", data: { rating: 3 } }).success).toBe(false);
    expect(createRecordSchema.safeParse({ recordType: "mood", data: { rating: 3, role: "admin" } }).success).toBe(false);
  });

  it("allows a voluntary partial thought-journal draft and validates completion state", () => {
    const emptyAnswers = { situation: "", thought: "", emotions: [], intensity: null, supports: "", otherPerspective: "", friendPerspective: "", alternative: "", reflection: "" };
    expect(recordSchemas.reflection.safeParse({ answers: emptyAnswers, status: "draft" }).success).toBe(true);
    expect(recordSchemas.reflection.safeParse({ answers: emptyAnswers, status: "diagnosed" }).success).toBe(false);
  });

  it("validates manageable activities, schedule, and optional mood ratings", () => {
    const valid = { title: "Take a short walk", category: "Movement", scheduledAt: null, durationMinutes: 10, difficulty: "easy", status: "planned", reflection: "", moodBefore: 3, moodAfter: null };
    expect(createRecordSchema.safeParse({ recordType: "activity", data: valid }).success).toBe(true);
    expect(createRecordSchema.safeParse({ recordType: "activity", data: { ...valid, moodAfter: 6 } }).success).toBe(false);
  });

  it("accepts optional feedback and rejects editing an unsupported record kind", () => {
    const data = { exerciseId: "five-senses-grounding", contentVersion: 1, status: "completed", feedback: "not-for-me", durationSeconds: 60 };
    expect(recordSchemas.exercise.safeParse(data).success).toBe(true);
    expect(updateRecordSchema.safeParse({ recordType: "exercise", data }).success).toBe(true);
    expect(updateRecordSchema.safeParse({ recordType: "mood", data: { rating: 2 } }).success).toBe(false);
  });
});
