"use client";

import { useCallback, useEffect, useState } from "react";
import { activityCategories } from "@/lib/wellbeing/content";
import { createRecord, deleteRecord, loadRecords, updateRecord, type ActivityData, type MoodData, type WeeklyReflectionData, type WellbeingRecord } from "@/lib/wellbeing/client";
import { calculateMoodDistribution, calculateMoodTrend, summarizeRecordedContexts } from "@/lib/wellbeing/metrics";

function localDate(value: string) { return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
function mondayOfWeek(date: Date) { const day = (date.getDay() + 6) % 7; const monday = new Date(date); monday.setDate(date.getDate() - day); monday.setHours(0, 0, 0, 0); return monday; }
function isoLocalInput(date: string | null) { if (!date) return ""; const parsed = new Date(date); const offset = parsed.getTimezoneOffset(); return new Date(parsed.getTime() - offset * 60_000).toISOString().slice(0, 16); }

export function ProgressDashboard() {
  const [records, setRecords] = useState<WellbeingRecord[]>([]);
  const [range, setRange] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<(typeof activityCategories)[number]>("Everyday responsibilities");
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [difficulty, setDifficulty] = useState<"easy" | "manageable">("easy");
  const [moodBefore, setMoodBefore] = useState<number | null>(null);
  const [completionId, setCompletionId] = useState<string | null>(null);
  const [moodAfter, setMoodAfter] = useState<number | null>(null);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleAt, setRescheduleAt] = useState("");
  const [includeMood, setIncludeMood] = useState(false);
  const [includeActivities, setIncludeActivities] = useState(false);
  const [weeklyDraft, setWeeklyDraft] = useState<WeeklyReflectionData | null>(null);
  const [weeklyRecordId, setWeeklyRecordId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => { setRecords(await loadRecords(["mood", "activity", "exercise", "weekly_reflection", "reflection"])); }, []);
  useEffect(() => { let active = true; loadRecords(["mood", "activity", "exercise", "weekly_reflection", "reflection"]).then((items) => { if (active) setRecords(items); }).catch((issue) => { if (active) setError(issue instanceof Error ? issue.message : "Your progress could not be loaded."); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);

  const moodRecords = records.filter((record) => record.record_type === "mood") as WellbeingRecord<MoodData>[];
  const activityRecords = records.filter((record) => record.record_type === "activity") as WellbeingRecord<ActivityData>[];
  const exerciseRecords = records.filter((record) => record.record_type === "exercise");
  const weeklyRecords = records.filter((record) => record.record_type === "weekly_reflection") as WellbeingRecord<WeeklyReflectionData>[];
  const reflections = records.filter((record) => record.record_type === "reflection");
  const cutoffDate = new Date(); cutoffDate.setHours(0, 0, 0, 0); cutoffDate.setDate(cutoffDate.getDate() - (range - 1));
  const cutoffTimestamp = cutoffDate.getTime();
  const filteredMoods = moodRecords.filter((record) => new Date(record.created_at).getTime() >= cutoffTimestamp);
  const dayBuckets = calculateMoodTrend(filteredMoods, cutoffDate, range);
  const averageMood = filteredMoods.length ? filteredMoods.reduce((sum, record) => sum + record.data.rating, 0) / filteredMoods.length : null;
  const completedActivities = activityRecords.filter((record) => record.data.status === "completed");
  const moodDistribution = calculateMoodDistribution(filteredMoods);
  const contextPatterns = summarizeRecordedContexts(filteredMoods);

  async function addActivity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!title.trim()) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await createRecord("activity", { title: title.trim(), category, scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null, durationMinutes, difficulty, status: "planned", reflection: "", moodBefore, moodAfter: null } satisfies ActivityData);
      setTitle(""); setScheduledAt(""); setDurationMinutes(15); setMoodBefore(null); setNotice("Your activity is saved. Change the plan whenever you need."); await refresh();
    } catch (issue) { setError(issue instanceof Error ? issue.message : "The activity could not be saved."); }
    finally { setBusy(false); }
  }

  async function updateActivity(record: WellbeingRecord<ActivityData>, changes: Partial<ActivityData>) {
    setBusy(true); setError("");
    try { await updateRecord(record.id, "activity", { ...record.data, ...changes }); await refresh(); setRescheduleId(null); }
    catch (issue) { setError(issue instanceof Error ? issue.message : "The activity could not be updated."); }
    finally { setBusy(false); }
  }

  async function remove(record: WellbeingRecord) {
    if (!window.confirm("Delete this record from your account?")) return;
    try { await deleteRecord(record.id); setRecords((current) => current.filter((item) => item.id !== record.id)); if (weeklyRecordId === record.id) { setWeeklyRecordId(null); setWeeklyDraft(null); } }
    catch (issue) { setError(issue instanceof Error ? issue.message : "The record could not be deleted."); }
  }

  function buildWeeklyReflection() {
    const start = mondayOfWeek(new Date());
    const thisWeek = (record: WellbeingRecord) => new Date(record.created_at) >= start;
    const moodCount = includeMood ? moodRecords.filter(thisWeek).length : 0;
    const activityCount = includeActivities ? completedActivities.filter(thisWeek).length : 0;
    const parts = [];
    if (includeMood) parts.push(`you recorded ${moodCount} mood check-in${moodCount === 1 ? "" : "s"}`);
    if (includeActivities) parts.push(`you completed ${activityCount} planned activit${activityCount === 1 ? "y" : "ies"}`);
    const summary = `This week, ${parts.join(" and ")}. What, if anything, would you like to carry into next week?`;
    setWeeklyRecordId(null);
    setWeeklyDraft({ periodStart: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`, sources: [...(includeMood ? ["mood" as const] : []), ...(includeActivities ? ["activity" as const] : [])], moodCheckIns: moodCount, activitiesCompleted: activityCount, summary, answers: { manageable: "", difficult: "", repeat: "", differently: "" }, status: "saved" });
    setNotice("This reflection uses only the record types you selected. Review it before saving."); setError("");
  }

  async function saveWeekly(status: "saved" | "dismissed") {
    if (!weeklyDraft) return;
    if (status === "dismissed") {
      try { if (weeklyRecordId) await deleteRecord(weeklyRecordId); setWeeklyDraft(null); setWeeklyRecordId(null); setNotice("Reflection dismissed. It was not saved."); }
      catch (issue) { setError(issue instanceof Error ? issue.message : "The reflection could not be dismissed."); }
      return;
    }
    setBusy(true); setError("");
    try {
      const data = { ...weeklyDraft, status };
      if (weeklyRecordId) await updateRecord(weeklyRecordId, "weekly_reflection", data);
      else { const saved = await createRecord("weekly_reflection", data); setWeeklyRecordId(saved.id); }
      await refresh(); setNotice("Your weekly reflection is saved to your account.");
    } catch (issue) { setError(issue instanceof Error ? issue.message : "The reflection could not be saved."); }
    finally { setBusy(false); }
  }

  function openWeekly(record: WellbeingRecord<WeeklyReflectionData>) { setWeeklyRecordId(record.id); setWeeklyDraft(record.data); setNotice(""); }

  return <div className="progress-layout">
    <section className="feature-card" aria-labelledby="mood-trends-title"><div className="feature-heading"><span className="section-kicker">YOUR RECORDS, OVER TIME</span><h2 id="mood-trends-title">Mood check-ins</h2><p>Only your own entries appear here. A rating is a moment in time, not a measure of progress.</p></div><div className="range-switch" aria-label="Mood chart period"><button type="button" className={range === 7 ? "is-selected" : ""} aria-pressed={range === 7} onClick={() => setRange(7)}>7 days</button><button type="button" className={range === 30 ? "is-selected" : ""} aria-pressed={range === 30} onClick={() => setRange(30)}>30 days</button></div>{loading ? <p className="empty-note">Loading your check-ins…</p> : filteredMoods.length === 0 ? <div className="empty-note">No check-ins in this period yet. <a href="/reflect">Add one in Reflect</a> whenever you want.</div> : <><div className="mood-chart" role="img" aria-label={`Mood check-ins over the last ${range} days. ${filteredMoods.length} records. Average rating ${averageMood?.toFixed(1)} out of 5.`}>{dayBuckets.map((bucket) => <div className="mood-chart-day" key={bucket.date.toISOString()}><div className="mood-chart-track"><span style={{ height: `${bucket.average ? bucket.average * 20 : 3}%`, opacity: bucket.average ? 1 : .16 }} /></div><span>{range === 7 ? bucket.date.toLocaleDateString(undefined, { weekday: "short" }) : bucket.date.getDate()}</span></div>)}</div><p className="chart-caption">{filteredMoods.length} check-in{filteredMoods.length === 1 ? "" : "s"} · Average {averageMood?.toFixed(1)} / 5 across recorded days. No entries are filled in for days you did not check in.</p></>}
      {filteredMoods.length > 0 && <div className="distribution-block"><h3 className="subsection-title">Recorded mood distribution</h3><div className="distribution-list">{moodDistribution.map(({ rating, count }) => <div key={rating}><span>{["Very low", "Low", "In between", "Good", "Very good"][rating - 1]}</span><div className="distribution-track"><span style={{ width: `${filteredMoods.length ? count / filteredMoods.length * 100 : 0}%` }}/></div><span>{count}</span></div>)}</div></div>}
      {contextPatterns.length > 0 && <div className="context-patterns"><h3 className="subsection-title">Your recorded context</h3>{contextPatterns.map((item) => <p key={item.context}>In {item.count} check-ins where you noted <strong>{item.context}</strong>, the average mood rating was {item.average.toFixed(1)} / 5. This is a description of your entries, not a cause.</p>)}</div>}
      <h3 className="subsection-title">Recent check-ins</h3>{moodRecords.length === 0 ? <p className="empty-note">Your check-in history will appear here when you choose to save one.</p> : <ul className="record-list">{moodRecords.slice(0, 8).map((record) => <li key={record.id}><div><strong>{["Very low", "Low", "In between", "Good", "Very good"][record.data.rating - 1]}</strong><span>{new Date(record.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>{record.data.emotions.length > 0 && <p>{record.data.emotions.join(" · ")}</p>}{record.data.note && <p>{record.data.note}</p>}{record.data.context.length > 0 && <p>Recorded alongside: {record.data.context.join(", ")}</p>}</div><button className="text-button" type="button" onClick={() => void remove(record)}>Delete</button></li>)}</ul>}
    </section>
    <section className="feature-card" aria-labelledby="activities-title"><div className="feature-heading"><span className="section-kicker">SMALL, SELF-CHOSEN STEPS</span><h2 id="activities-title">Activities and goals</h2><p>Make a plan that feels manageable. There are no streaks, scores, or penalties for changing it.</p></div><form className="activity-form" onSubmit={(event) => void addActivity(event)}><label className="wellbeing-label">What would you like to try?<input required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="One small thing, in your own words"/></label><div className="form-grid"><label className="wellbeing-label">Category<select value={category} onChange={(event) => setCategory(event.target.value as (typeof activityCategories)[number])}>{activityCategories.map((item) => <option key={item}>{item}</option>)}</select></label><label className="wellbeing-label">When? <span className="optional-label">optional</span><input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)}/></label><label className="wellbeing-label">Time estimate<select value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))}><option value={5}>5 minutes</option><option value={10}>10 minutes</option><option value={15}>15 minutes</option><option value={30}>30 minutes</option><option value={60}>1 hour</option></select></label><label className="wellbeing-label">Feels<select value={difficulty} onChange={(event) => setDifficulty(event.target.value as "easy" | "manageable")}><option value="easy">Easy today</option><option value="manageable">Manageable</option></select></label><label className="wellbeing-label">Mood before <span className="optional-label">optional</span><select value={moodBefore ?? ""} onChange={(event) => setMoodBefore(event.target.value ? Number(event.target.value) : null)}><option value="">Skip</option>{[1,2,3,4,5].map((value) => <option key={value} value={value}>{["Very low", "Low", "In between", "Good", "Very good"][value - 1]}</option>)}</select></label></div><button className="primary-soft-button" type="submit" disabled={busy}>{busy ? "Saving…" : "Add activity"}</button></form>
      <h3 className="subsection-title">Your activity history <span>{completedActivities.length} completed</span></h3>{activityRecords.length === 0 ? <p className="empty-note">Your plans will live here. You can reschedule, skip, or delete them at any time.</p> : <ul className="record-list">{activityRecords.slice(0, 30).map((record) => <li className="activity-record" key={record.id}><div><strong>{record.data.title}</strong><span>{record.data.category} · {record.data.durationMinutes} min · {record.data.status}</span>{record.data.scheduledAt && <span>{new Date(record.data.scheduledAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>}{(record.data.moodBefore || record.data.moodAfter) && <span>{record.data.moodBefore ? `Mood before: ${record.data.moodBefore}/5` : ""}{record.data.moodBefore && record.data.moodAfter ? " · " : ""}{record.data.moodAfter ? `After: ${record.data.moodAfter}/5` : ""}</span>}{record.data.reflection && <p>{record.data.reflection}</p>}{rescheduleId === record.id && <div className="inline-reschedule"><label className="wellbeing-label">Choose a new time<input type="datetime-local" value={rescheduleAt} onChange={(event) => setRescheduleAt(event.target.value)}/></label><button className="soft-button" type="button" disabled={!rescheduleAt || busy} onClick={() => void updateActivity(record, { scheduledAt: new Date(rescheduleAt).toISOString(), status: "planned" })}>Save new time</button></div>}{completionId === record.id && <div className="inline-reschedule"><label className="wellbeing-label">Mood after <span className="optional-label">optional</span><select value={moodAfter ?? ""} onChange={(event) => setMoodAfter(event.target.value ? Number(event.target.value) : null)}><option value="">Skip</option>{[1,2,3,4,5].map((value) => <option key={value} value={value}>{["Very low", "Low", "In between", "Good", "Very good"][value - 1]}</option>)}</select></label><div className="record-actions"><button className="soft-button" type="button" disabled={busy} onClick={() => { void updateActivity(record, { status: "completed", moodAfter }); setCompletionId(null); setMoodAfter(null); }}>Save completion</button><button className="text-button" type="button" disabled={busy} onClick={() => { void updateActivity(record, { status: "completed", moodAfter: null }); setCompletionId(null); }}>Complete without rating</button></div></div>}</div><div className="record-actions">{record.data.status === "planned" && <><button className="text-button" type="button" onClick={() => { setCompletionId(record.id); setMoodAfter(null); }} disabled={busy}>Complete</button><button className="text-button" type="button" onClick={() => void updateActivity(record, { status: "skipped" })} disabled={busy}>Skip</button><button className="text-button" type="button" onClick={() => { setRescheduleId(record.id); setRescheduleAt(isoLocalInput(record.data.scheduledAt)); }}>Reschedule</button></>}{record.data.status === "skipped" && <button className="text-button" type="button" disabled={busy} onClick={() => void updateActivity(record, { status: "planned" })}>Plan again</button>}<button className="text-button" type="button" onClick={() => void remove(record)}>Delete</button></div></li>)}</ul>}
    </section>
    <section className="feature-card" aria-labelledby="weekly-reflection-title"><div className="feature-heading"><span className="section-kicker">OPTIONAL · FACTS FROM YOUR RECORDS</span><h2 id="weekly-reflection-title">Weekly reflection</h2><p>No journal text or conversation is sent to an AI. Select which saved counts to use; the summary is built locally from those records.</p></div><fieldset className="choice-fieldset"><legend>Include in this reflection</legend><label className="checkbox-line"><input type="checkbox" checked={includeMood} onChange={(event) => setIncludeMood(event.target.checked)}/>Number of mood check-ins</label><label className="checkbox-line"><input type="checkbox" checked={includeActivities} onChange={(event) => setIncludeActivities(event.target.checked)}/>Number of activities marked complete</label></fieldset><button type="button" className="soft-button" onClick={buildWeeklyReflection} disabled={!includeMood && !includeActivities}>Build from selected records</button>
      {weeklyDraft && <div className="weekly-draft"><label className="wellbeing-label">Review or edit the summary<textarea className="weekly-summary-input" rows={3} maxLength={600} value={weeklyDraft.summary} onChange={(event) => setWeeklyDraft((old) => old ? { ...old, summary: event.target.value } : old)}/></label><p className="helper-copy">Week beginning {new Date(`${weeklyDraft.periodStart}T00:00:00`).toLocaleDateString()}</p><div className="prompt-stack">{([["manageable", "What felt manageable?"], ["difficult", "What felt difficult?"], ["repeat", "What would you like to repeat?"], ["differently", "Anything you might approach differently?"]] as const).map(([key, prompt]) => <label className="wellbeing-label" key={key}>{prompt}<textarea rows={2} maxLength={800} value={weeklyDraft.answers[key]} onChange={(event) => setWeeklyDraft((old) => old ? { ...old, answers: { ...old.answers, [key]: event.target.value } } : old)} placeholder="Optional"/></label>)}</div><div className="wizard-actions"><button className="primary-soft-button" type="button" disabled={busy} onClick={() => void saveWeekly("saved")}>{busy ? "Saving…" : weeklyRecordId ? "Update reflection" : "Save reflection"}</button><button className="text-button" type="button" onClick={() => void saveWeekly("dismissed")}>Dismiss</button></div></div>}
      {weeklyRecords.filter((record) => record.data.status === "saved").map((record) => <article className="saved-weekly" key={record.id}><p className="helper-copy">Saved reflection · week of {new Date(`${record.data.periodStart}T00:00:00`).toLocaleDateString()}</p><p>{record.data.summary}</p><button className="text-button" type="button" onClick={() => openWeekly(record)}>Edit</button><button className="text-button" type="button" onClick={() => void remove(record)}>Delete</button></article>)}
    </section>
    <section className="feature-card" aria-labelledby="reflection-history-title"><div className="feature-heading"><span className="section-kicker">YOUR NOTES</span><h2 id="reflection-history-title">Reflection history</h2><p>Private entries stay in your account until you remove them.</p></div>{reflections.length === 0 ? <p className="empty-note">Saved journal drafts and reflections will appear here when you choose to save one.</p> : <ul className="record-list">{reflections.slice(0, 20).map((record) => { const data = record.data as { status: string; answers?: { situation?: string } }; return <li key={record.id}><div><strong>{data.status === "draft" ? "Journal draft" : "Completed thought journal"}</strong><span>{new Date(record.updated_at).toLocaleDateString()}</span>{data.answers?.situation && <p>{data.answers.situation}</p>}</div><button className="text-button" type="button" onClick={() => void remove(record)}>Delete</button></li>; })}</ul>}</section>
    <section className="feature-card" aria-labelledby="sessions-title"><div className="feature-heading"><span className="section-kicker">OPTIONAL HISTORY</span><h2 id="sessions-title">Reset sessions</h2><p>Only saved session counts and duration are shown; grounding notes are not stored.</p></div>{exerciseRecords.length === 0 ? <p className="empty-note">Your Reset sessions will appear here only when you choose to finish and save one.</p> : <ul className="record-list">{exerciseRecords.slice(0, 12).map((record) => { const data = record.data as { exerciseId: string; status: string; durationSeconds: number }; return <li key={record.id}><div><strong>{data.exerciseId === "comfortable-breathing" ? "Comfortable breathing" : "Five senses grounding"}</strong><span>{data.status} · {data.durationSeconds ? `${Math.floor(data.durationSeconds / 60)}m ${data.durationSeconds % 60}s` : "self-paced"} · {localDate(record.created_at)}</span></div><button className="text-button" type="button" onClick={() => void remove(record)}>Delete</button></li>; })}</ul>}</section>
    {error && <p className="form-feedback is-error" role="alert">{error}</p>}{notice && <p className="form-feedback" role="status">{notice}</p>}
  </div>;
}
