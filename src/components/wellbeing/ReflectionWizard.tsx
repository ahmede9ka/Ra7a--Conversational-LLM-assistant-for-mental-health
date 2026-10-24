"use client";

import { useEffect, useState } from "react";
import { createRecord, deleteRecord, loadRecords, updateRecord, type ReflectionData, type WellbeingRecord } from "@/lib/wellbeing/client";
import { emotionOptions } from "@/lib/wellbeing/content";
import { VoiceTextInput } from "./VoiceTextInput";

const emptyAnswers: ReflectionData["answers"] = { situation: "", thought: "", emotions: [], intensity: null, supports: "", otherPerspective: "", friendPerspective: "", alternative: "", reflection: "" };
const steps = [
  { title: "The situation", prompt: "What happened?", key: "situation" as const },
  { title: "The thought", prompt: "What thought went through your mind?", key: "thought" as const },
  { title: "The feeling", prompt: "What emotions did you notice?", key: "emotions" as const },
  { title: "Explore, if you want", prompt: "Would any of these questions be useful?", key: "examine" as const },
  { title: "Another perspective", prompt: "Is there another way to understand the situation?", key: "alternative" as const },
  { title: "A final pause", prompt: "What, if anything, feels different now?", key: "reflection" as const },
];

export function ReflectionWizard() {
  const [records, setRecords] = useState<WellbeingRecord[]>([]);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [answers, setAnswers] = useState(emptyAnswers);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  async function refresh() { const items = await loadRecords(["reflection"]); setRecords(items); }
  useEffect(() => { let active = true; loadRecords(["reflection"]).then((items) => { if (active) setRecords(items); }).catch((issue) => { if (active) setError(issue instanceof Error ? issue.message : "Reflections could not be loaded."); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  function startNew() { setRecordId(null); setAnswers(emptyAnswers); setStep(0); setError(""); setNotice(""); }
  function resume(record: WellbeingRecord) { const data = record.data as unknown as ReflectionData; setRecordId(record.id); setAnswers({ ...emptyAnswers, ...data.answers }); setStep(0); setNotice("Draft opened. You can change any answer."); setError(""); }

  async function save(status: "draft" | "completed") {
    setBusy(true); setError(""); setNotice("");
    try {
      const data: ReflectionData = { answers, status };
      if (recordId) await updateRecord(recordId, "reflection", data); else { const created = await createRecord("reflection", data); setRecordId(created.id); }
      await refresh();
      if (status === "completed") { setNotice("Saved. Thank you for taking a moment with yourself."); setRecordId(null); setAnswers(emptyAnswers); setStep(0); }
      else setNotice("Draft saved to your account. You can come back when you want.");
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Your reflection could not be saved."); }
    finally { setBusy(false); }
  }

  async function remove(record: WellbeingRecord) {
    if (!window.confirm("Delete this reflection from your account?")) return;
    try { await deleteRecord(record.id); setRecords((current) => current.filter((item) => item.id !== record.id)); if (recordId === record.id) startNew(); }
    catch (issue) { setError(issue instanceof Error ? issue.message : "This reflection could not be deleted."); }
  }

  const current = steps[step];
  return <div className="reflect-layout">
    <section className="feature-card" aria-labelledby="thought-journal-title">
      <div className="feature-heading"><span className="section-kicker">A PRIVATE PAUSE</span><h2 id="thought-journal-title">Thought journal</h2><p>Explore a moment at your own pace. You can skip any step or stop whenever you like.</p></div>
      <div className="journal-disclaimer">A guided reflection for personal wellbeing. It is not therapy or a diagnosis. <details><summary>About these prompts</summary><p>The neutral prompts are informed by a public NHS thought-record guide; you can skip any question and do not need to change your thought.</p><a href="https://www.nhs.uk/every-mind-matters/mental-wellbeing-tips/self-help-cbt-techniques/thought-record/" target="_blank" rel="noreferrer">Read the NHS thought-record guide</a></details></div>
      <div className="step-progress" aria-label={`Step ${step + 1} of ${steps.length}`}><div className="step-progress-track"><span style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div><span>Step {step + 1} of {steps.length} · {current.title}</span></div>
      <div className="journal-step" key={step}>
        <h3>{current.prompt}</h3>
        {current.key === "situation" && <VoiceTextInput label="Describe what happened, in your own words." value={answers.situation} onChange={(situation) => setAnswers((old) => ({ ...old, situation }))} placeholder="A few words are enough…" />}
        {current.key === "thought" && <><p className="helper-copy">If it helps, separate what you observed from what you interpreted. There is no right answer.</p><VoiceTextInput label="Write or speak the thought you noticed." value={answers.thought} onChange={(thought) => setAnswers((old) => ({ ...old, thought }))} placeholder="What was going through your mind?" /></>}
        {current.key === "emotions" && <><p className="helper-copy">Select any words that fit, or leave this blank. These are your own choices.</p><div className="choice-chips">{emotionOptions.map((emotion) => <button type="button" key={emotion} aria-pressed={answers.emotions.includes(emotion)} className={`choice-chip${answers.emotions.includes(emotion) ? " is-selected" : ""}`} onClick={() => setAnswers((old) => ({ ...old, emotions: old.emotions.includes(emotion) ? old.emotions.filter((item) => item !== emotion) : [...old.emotions, emotion] }))}>{emotion}</button>)}</div><label className="wellbeing-label intensity-label">Intensity, if useful <span className="optional-label">optional</span><div className="choice-chips">{[1,2,3,4,5].map((intensity) => <button type="button" key={intensity} aria-pressed={answers.intensity === intensity} className={`choice-chip${answers.intensity === intensity ? " is-selected" : ""}`} onClick={() => setAnswers((old) => ({ ...old, intensity: old.intensity === intensity ? null : intensity }))}>{intensity} / 5</button>)}</div></label></>}
        {current.key === "examine" && <div className="prompt-stack"><p className="helper-copy">You do not need to challenge or change the thought. Choose any prompt that feels useful, or move on.</p><label className="wellbeing-label">What supports this thought?<textarea rows={2} maxLength={1000} value={answers.supports} onChange={(event) => setAnswers((old) => ({ ...old, supports: event.target.value }))} placeholder="Optional" /></label><label className="wellbeing-label">Is there information that might offer another perspective?<textarea rows={2} maxLength={1000} value={answers.otherPerspective} onChange={(event) => setAnswers((old) => ({ ...old, otherPerspective: event.target.value }))} placeholder="Optional" /></label><label className="wellbeing-label">What might you say to a friend in a similar situation?<textarea rows={2} maxLength={1000} value={answers.friendPerspective} onChange={(event) => setAnswers((old) => ({ ...old, friendPerspective: event.target.value }))} placeholder="Optional" /></label></div>}
        {current.key === "alternative" && <VoiceTextInput label="Your perspective, if one comes to mind." value={answers.alternative} onChange={(alternative) => setAnswers((old) => ({ ...old, alternative }))} placeholder="It is okay if nothing comes to mind right now." />}
        {current.key === "reflection" && <VoiceTextInput label="Anything you would like to note? You can leave this blank." value={answers.reflection} onChange={(reflection) => setAnswers((old) => ({ ...old, reflection }))} placeholder="No need to reach a conclusion." />}
      </div>
      <div className="wizard-actions"><button type="button" className="soft-button" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0 || busy}>Back</button><button type="button" className="soft-button" onClick={() => void save("draft")} disabled={busy}>{busy ? "Saving…" : "Save and leave"}</button><button type="button" className="text-button" onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))} disabled={step === steps.length - 1 || busy}>Skip this step</button>{step < steps.length - 1 ? <button type="button" className="primary-soft-button" onClick={() => setStep((value) => value + 1)} disabled={busy}>Continue</button> : <button type="button" className="primary-soft-button" onClick={() => void save("completed")} disabled={busy}>{busy ? "Saving…" : "Finish reflection"}</button>}</div>
      {error && <p className="form-feedback is-error" role="alert">{error}</p>}{notice && <p className="form-feedback" role="status">{notice}</p>}
      <button type="button" className="text-button discard-button" onClick={startNew}>Leave without saving</button>
    </section>
    <aside className="feature-card history-card"><div className="feature-heading"><span className="section-kicker">ONLY VISIBLE TO YOU</span><h2>Your reflections</h2><p>Drafts are saved only when you choose to save them.</p></div>{loading ? <p className="helper-copy">Loading your saved reflections…</p> : records.length === 0 ? <p className="empty-note">Your saved reflections will appear here. Nothing is saved until you choose.</p> : <ul className="record-list">{records.map((record) => { const data = record.data as unknown as ReflectionData; return <li key={record.id}><div><strong>{data.status === "draft" ? "Draft reflection" : "Completed reflection"}</strong><span>{new Date(record.updated_at).toLocaleDateString()}</span>{data.answers.situation && <p>{data.answers.situation.slice(0, 110)}</p>}</div><div className="record-actions"><button className="text-button" type="button" onClick={() => resume(record)}>{data.status === "draft" ? "Resume" : "Edit"}</button><button className="text-button" type="button" onClick={() => void remove(record)}>Delete</button></div></li>; })}</ul>}{notice && <button className="text-button" type="button" onClick={startNew}>Start a new reflection</button>}</aside>
  </div>;
}
