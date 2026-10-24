import type { MoodData, WellbeingRecord } from "./client";

export type MoodRecord = Pick<WellbeingRecord<MoodData>, "created_at" | "data">;

export function calculateMoodTrend(records: MoodRecord[], fromDate: Date, dayCount: number) {
  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(fromDate);
    date.setDate(date.getDate() + index);
    const dayRecords = records.filter((record) => new Date(record.created_at).toDateString() === date.toDateString());
    return {
      date,
      count: dayRecords.length,
      average: dayRecords.length ? dayRecords.reduce((sum, record) => sum + record.data.rating, 0) / dayRecords.length : null,
    };
  });
}

export function calculateMoodDistribution(records: MoodRecord[]) {
  return [1, 2, 3, 4, 5].map((rating) => ({ rating, count: records.filter((record) => record.data.rating === rating).length }));
}

export function summarizeRecordedContexts(records: MoodRecord[], minimumRecords = 2) {
  return Array.from(new Set(records.flatMap((record) => record.data.context))).map((context) => {
    const matching = records.filter((record) => record.data.context.includes(context));
    return { context, count: matching.length, average: matching.reduce((sum, record) => sum + record.data.rating, 0) / matching.length };
  }).filter((item) => item.count >= minimumRecords);
}

export function breathingPhase(elapsedSeconds: number, inhaleSeconds: number, exhaleSeconds = 5) {
  const cycleSeconds = inhaleSeconds + exhaleSeconds;
  return elapsedSeconds % cycleSeconds < inhaleSeconds ? "inhale" : "exhale";
}

export function remainingExerciseSeconds(elapsedSeconds: number, durationSeconds: number) {
  return Math.max(0, durationSeconds - elapsedSeconds);
}
