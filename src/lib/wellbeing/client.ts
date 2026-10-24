export type RecordType = "mood" | "reflection" | "activity" | "exercise" | "weekly_reflection";
export type WellbeingRecord<T = Record<string, unknown>> = { id: string; record_type: RecordType; data: T; created_at: string; updated_at: string };

export type MoodData = { rating: number; emotions: string[]; stress: number | null; note: string; context: string[] };
export type ReflectionData = { answers: { situation: string; thought: string; emotions: string[]; intensity: number | null; supports: string; otherPerspective: string; friendPerspective: string; alternative: string; reflection: string }; status: "draft" | "completed" };
export type ActivityData = { title: string; category: string; scheduledAt: string | null; durationMinutes: number; difficulty: "easy" | "manageable"; status: "planned" | "completed" | "skipped"; reflection: string; moodBefore: number | null; moodAfter: number | null };
export type ExerciseData = { exerciseId: string; contentVersion: number; status: "completed" | "stopped"; feedback: "helpful" | "not-for-me" | "skip" | null; durationSeconds: number };
export type WeeklyReflectionData = { periodStart: string; sources: ("mood" | "activity")[]; moodCheckIns: number; activitiesCompleted: number; summary: string; answers: { manageable: string; difficult: string; repeat: string; differently: string }; status: "saved" | "dismissed" };

export async function loadRecords(types: RecordType[]): Promise<WellbeingRecord[]> {
  const query = new URLSearchParams();
  types.forEach((type) => query.append("type", type));
  const response = await fetch(`/api/wellbeing?${query}`, { cache: "no-store" });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Your records could not be loaded.");
  return result.records as WellbeingRecord[];
}

export async function createRecord<T>(recordType: RecordType, data: T): Promise<WellbeingRecord<T>> {
  const response = await fetch("/api/wellbeing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recordType, data }) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Your entry could not be saved.");
  return result.record as WellbeingRecord<T>;
}

export async function updateRecord<T>(id: string, recordType: "activity" | "reflection" | "exercise" | "weekly_reflection", data: T): Promise<WellbeingRecord<T>> {
  const response = await fetch(`/api/wellbeing/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recordType, data }) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Your entry could not be updated.");
  return result.record as WellbeingRecord<T>;
}

export async function deleteRecord(id: string) {
  const response = await fetch(`/api/wellbeing/${id}`, { method: "DELETE" });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Your entry could not be deleted.");
}

