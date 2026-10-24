"use client";

import { useEffect, useRef, useState } from "react";
import { createRecord, updateRecord, type ExerciseData } from "@/lib/wellbeing/client";
import { copingExercises } from "@/lib/wellbeing/content";
import { breathingPhase, remainingExerciseSeconds } from "@/lib/wellbeing/metrics";

type ExerciseId = "comfortable-breathing" | "five-senses-grounding";
const senses = [
  { sense: "See", prompt: "Notice up to five things you can see.", count: 5 },
  { sense: "Feel", prompt: "Notice up to four things you can feel.", count: 4 },
  { sense: "Hear", prompt: "Notice up to three things you can hear.", count: 3 },
  { sense: "Smell", prompt: "If comfortable, notice up to two things you can smell.", count: 2 },
  { sense: "Taste", prompt: "If comfortable, notice one thing you can taste.", count: 1 },
];

export function ResetExperience() {
  const [exercise, setExercise] = useState<ExerciseId | null>(null);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [durationMinutes, setDurationMinutes] = useState(3);
  const [inhaleSeconds, setInhaleSeconds] = useState(4);
  const [groundingStep, setGroundingStep] = useState(0);
  const [groundingAnswers, setGroundingAnswers] = useState<string[]>(Array(5).fill(""));
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedSession, setSavedSession] = useState<(ExerciseData & { id: string }) | null>(null);
  const elapsedRef = useRef(0);
  const saveSessionRef = useRef<(status: "completed" | "stopped", seconds?: number) => Promise<ExerciseData & { id: string } | null>>(async () => null);
  const selectedExercise = copingExercises.find((item) => item.id === exercise);
  const selectedExerciseVersion = selectedExercise?.version || 1;
  const totalSeconds = durationMinutes * 60;

  useEffect(() => {
    saveSessionRef.current = async (status, durationSeconds = elapsedRef.current) => {
      if (!exercise) return null;
      setBusy(true); setError("");
      try {
        const record = await createRecord("exercise", { exerciseId: exercise, contentVersion: selectedExerciseVersion, status, feedback: null, durationSeconds });
        const saved = { id: record.id, exerciseId: exercise, contentVersion: selectedExerciseVersion, status, feedback: null, durationSeconds } satisfies ExerciseData & { id: string };
        setSavedSession(saved); return saved;
      }
      catch (issue) { setError(issue instanceof Error ? issue.message : "The session could not be saved."); return null; }
      finally { setBusy(false); }
    };
  }, [exercise, selectedExerciseVersion]);

  useEffect(() => {
    if (!running || !startedAt) return;
    const timer = window.setInterval(() => {
      const next = Math.min(totalSeconds, Math.floor((Date.now() - startedAt) / 1000));
      elapsedRef.current = next; setElapsed(next);
      if (next >= totalSeconds) {
        setRunning(false); setStartedAt(null);
        void saveSessionRef.current("completed", next).then((saved) => { if (saved) { setExercise(null); setNotice("Your selected time is complete. Take your time before moving on."); } else setNotice("Your session did not save. You can try saving it again or leave now."); });
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [running, startedAt, totalSeconds]);

  function start(next: ExerciseId) {
    setExercise(next); setNotice(""); setError(""); setSavedSession(null); setElapsed(0); elapsedRef.current = 0; setGroundingStep(0); setGroundingAnswers(Array(5).fill("")); setRunning(false); setStartedAt(null);
  }
  function startBreathing() { const now = Date.now(); setStartedAt(now - elapsed * 1000); setRunning(true); setNotice("Follow only a pace that feels comfortable."); }
  function pauseBreathing() { const pausedAt = Math.min(totalSeconds, Math.floor((Date.now() - (startedAt || Date.now())) / 1000)); elapsedRef.current = pausedAt; setElapsed(pausedAt); setRunning(false); setStartedAt(null); }
  async function stopExercise() {
    if (exercise === "comfortable-breathing" && (running || elapsed > 0)) {
      const finalElapsed = running ? Math.min(totalSeconds, Math.floor((Date.now() - (startedAt || Date.now())) / 1000)) : elapsed;
      setElapsed(finalElapsed); elapsedRef.current = finalElapsed; setRunning(false); setStartedAt(null); await saveSessionRef.current("stopped", finalElapsed);
    }
    setExercise(null); setNotice("You can stop at any time. There is nothing to complete.");
  }
  async function finishGrounding() { await saveSessionRef.current("completed", 0); setExercise(null); setNotice("You reached the end of this optional guide. Take a moment before returning."); }
  async function saveFeedback(feedback: "helpful" | "not-for-me" | "skip") {
    if (!savedSession) return;
    setBusy(true); setError("");
    try { const { id, ...data } = savedSession; await updateRecord(id, "exercise", { ...data, feedback }); setSavedSession((old) => old ? { ...old, feedback } : old); setNotice("Your feedback is saved. Thank you."); }
    catch (issue) { setError(issue instanceof Error ? issue.message : "Feedback could not be saved."); }
    finally { setBusy(false); }
  }

  const phaseKey = breathingPhase(elapsed, inhaleSeconds, 5);
  const phase = phaseKey === "inhale" ? "Breathe in gently" : "Let the breath flow out";
  const remaining = remainingExerciseSeconds(elapsed, totalSeconds);
  const mmss = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;

  return <div className="reset-layout">
    <section className="feature-card reset-main" aria-labelledby="reset-heading">
      <div className="feature-heading"><span className="section-kicker">TAKE A MOMENT</span><h2 id="reset-heading">Reset</h2><p>Choose a small pause. These guides are optional, and you can leave at any time.</p></div>
      {!exercise ? <div className="exercise-library">{copingExercises.map((item) => <article className="exercise-card" key={item.id}><span className="exercise-duration">{item.durationMinutes} min · self-paced</span><h3>{item.title}</h3><p>{item.description}</p><p className="exercise-purpose">{item.purpose}</p><button className="primary-soft-button" type="button" onClick={() => start(item.id as ExerciseId)}>Read and begin</button><details className="exercise-details"><summary>About this guide</summary><p>{item.evidenceNote}</p><p>{item.limitation}</p><a href={item.sources[0].url} target="_blank" rel="noreferrer">{item.sources[0].title}</a></details></article>)}</div> : <div className="active-exercise">
        <button className="text-button" type="button" onClick={() => void stopExercise()}>‹ Back to all pauses</button>
        <h3>{selectedExercise?.title}</h3><p className="helper-copy">{selectedExercise?.limitation}</p>
        {exercise === "comfortable-breathing" ? <div className="breathing-guide">
          <div className={`breathing-orb${running ? (phaseKey === "inhale" ? " is-inhaling" : " is-exhaling") : ""}`} style={{ animationDuration: `${phaseKey === "inhale" ? inhaleSeconds : 5}s` }} role="img" aria-label={running ? phase : "Breathing guide at rest"}><span aria-live="polite">{running ? phase : elapsed > 0 ? "Paused" : "Ready when you are"}</span></div>
          <p className="breathing-timer" aria-live="off">{mmss}</p>
          {!running && elapsed === 0 && <div className="breathing-options"><label>Time<select value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))}><option value={1}>1 minute</option><option value={3}>3 minutes</option><option value={5}>5 minutes</option></select></label><label>Breathing pace<select value={inhaleSeconds} onChange={(event) => setInhaleSeconds(Number(event.target.value))}><option value={3}>Short and easy</option><option value={4}>Steady</option><option value={5}>Slow, if comfortable</option></select></label></div>}
          <p className="helper-copy">No breath holds. Breathe normally if this guide feels uncomfortable.</p>
          <div className="wizard-actions">{running ? <button type="button" className="primary-soft-button" onClick={pauseBreathing}>Pause</button> : elapsed >= totalSeconds ? <button type="button" className="primary-soft-button" onClick={() => void saveSessionRef.current("completed", elapsed).then((saved) => { if (saved) { setExercise(null); setNotice("Your selected time is complete. Take your time before moving on."); } })}>Try saving again</button> : <button type="button" className="primary-soft-button" onClick={startBreathing}>{elapsed ? "Resume" : "Start"}</button>}<button type="button" className="soft-button" onClick={() => void stopExercise()}>Stop</button></div>
        </div> : <div className="grounding-guide"><div className="step-progress"><div className="step-progress-track"><span style={{ width: `${((groundingStep + 1) / senses.length) * 100}%` }} /></div><span>Sense {groundingStep + 1} of {senses.length}</span></div><p className="sense-step-label">{senses[groundingStep].sense}</p><h4>{senses[groundingStep].prompt}</h4><p className="helper-copy">Write a few words if you like, or simply notice quietly.</p><textarea aria-label={`Optional notes for ${senses[groundingStep].sense}`} rows={3} maxLength={500} placeholder="Optional · this is not saved" value={groundingAnswers[groundingStep]} onChange={(event) => setGroundingAnswers((old) => old.map((value, index) => index === groundingStep ? event.target.value : value))} /><div className="wizard-actions"><button type="button" className="soft-button" onClick={() => setGroundingStep((value) => Math.max(0, value - 1))} disabled={groundingStep === 0}>Back</button><button type="button" className="text-button" onClick={() => groundingStep === senses.length - 1 ? void finishGrounding() : setGroundingStep((value) => value + 1)}>{groundingStep === senses.length - 1 ? "Skip and finish" : "Skip"}</button>{groundingStep < senses.length - 1 ? <button type="button" className="primary-soft-button" onClick={() => setGroundingStep((value) => value + 1)}>Continue</button> : <button type="button" className="primary-soft-button" onClick={() => void finishGrounding()}>Finish</button>}<button type="button" className="soft-button" onClick={() => void stopExercise()}>Stop</button></div></div>}
      </div>}
      {notice && <p className="form-feedback" role="status">{notice}</p>}{error && <p className="form-feedback is-error" role="alert">{error}</p>}{busy && <p className="helper-copy" role="status">Saving your session…</p>}{savedSession && <div className="session-feedback"><p>Would you like to leave optional feedback?</p>{savedSession.feedback ? <span>Feedback saved.</span> : <div className="choice-chips">{([["helpful", "Helpful"], ["not-for-me", "Not for me"], ["skip", "Skip"]] as const).map(([value, label]) => <button className="choice-chip" type="button" key={value} disabled={busy} onClick={() => void saveFeedback(value)}>{label}</button>)}</div>}</div>}
      <p className="exercise-disclaimer">General wellbeing activities, not a substitute for professional care. Take what feels useful and leave the rest.</p>
    </section>
    <aside className="feature-card reset-note"><span className="section-kicker">YOUR PACE</span><h3>There is no right way to do this.</h3><p>You can skip a prompt, pause, or stop. Silence and normal breathing are always okay.</p><p>Ra7a does not play audio automatically or store your written grounding notes.</p></aside>
  </div>;
}
