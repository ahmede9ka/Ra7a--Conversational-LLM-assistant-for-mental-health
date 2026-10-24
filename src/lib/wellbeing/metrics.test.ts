import { describe, expect, it } from "vitest";
import { breathingPhase, calculateMoodDistribution, calculateMoodTrend, remainingExerciseSeconds, summarizeRecordedContexts, type MoodRecord } from "@/lib/wellbeing/metrics";

const start = new Date("2026-10-20T00:00:00");
const entries: MoodRecord[] = [
  { created_at: "2026-10-20T09:00:00", data: { rating: 2, emotions: ["Sad"], stress: null, note: "", context: ["Sleep"] } },
  { created_at: "2026-10-20T18:00:00", data: { rating: 4, emotions: ["Calm"], stress: null, note: "", context: ["Sleep"] } },
  { created_at: "2026-10-22T12:00:00", data: { rating: 5, emotions: [], stress: null, note: "", context: ["Movement"] } },
];

describe("wellbeing statistics use only recorded data", () => {
  it("groups actual mood entries by date and leaves empty days blank", () => {
    const trend = calculateMoodTrend(entries, start, 4);
    expect(trend.map(({ count, average }) => [count, average])).toEqual([[2, 3], [0, null], [1, 5], [0, null]]);
  });

  it("calculates mood distribution from the provided ratings", () => {
    expect(calculateMoodDistribution(entries)).toEqual([
      { rating: 1, count: 0 }, { rating: 2, count: 1 }, { rating: 3, count: 0 }, { rating: 4, count: 1 }, { rating: 5, count: 1 },
    ]);
  });

  it("only describes a user-recorded context when it appears at least twice", () => {
    expect(summarizeRecordedContexts(entries)).toEqual([{ context: "Sleep", count: 2, average: 3 }]);
    expect(summarizeRecordedContexts([])).toEqual([]);
  });

  it("uses comfortable inhale/exhale phases without a hold and clamps remaining time", () => {
    expect(breathingPhase(0, 4)).toBe("inhale");
    expect(breathingPhase(3, 4)).toBe("inhale");
    expect(breathingPhase(4, 4)).toBe("exhale");
    expect(breathingPhase(9, 4)).toBe("inhale");
    expect(remainingExerciseSeconds(40, 180)).toBe(140);
    expect(remainingExerciseSeconds(200, 180)).toBe(0);
  });
});
