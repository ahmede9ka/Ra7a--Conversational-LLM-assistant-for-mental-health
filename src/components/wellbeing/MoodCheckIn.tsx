"use client";

import { useState } from "react";
import { createRecord, type MoodData } from "@/lib/wellbeing/client";
import { emotionDetails, emotionOptions } from "@/lib/wellbeing/content";
import { moodRatingLabels } from "@/lib/wellbeing/validation";

const contextOptions = ["Sleep", "Movement", "Time outdoors", "Connection", "Work or study", "Health", "Significant event", "Other"];
const scaleLabels = moodRatingLabels;

export function MoodCheckIn({ onSaved }: { onSaved?: () => void }) {
  const [rating, setRating] = useState<number | null>(null);
  const [emotions, setEmotions] = useState<string[]>([]);
  const [stress, setStress] = useState<number | null>(null);
  const [context, setContext] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  function toggle(list: string[], setList: (next: string[]) => void, item: string) { setList(list.includes(item) ? list.filter((value) => value !== item) : [...list, item]); }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rating) { setError("Choose the mood rating that feels closest, or come back later."); return; }
    setError(""); setSaving(true); setSaved(false);
    try {
      const data: MoodData = { rating, emotions, stress, context, note };
      await createRecord("mood", data);
      setSaved(true); setRating(null); setEmotions([]); setStress(null); setContext([]); setNote(""); onSaved?.();
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Your check-in could not be saved."); }
    finally { setSaving(false); }
  }

  return <form className="wellbeing-form" onSubmit={submit}>
    <fieldset className="choice-fieldset"><legend>How are you feeling overall?</legend><p className="helper-copy">Choose what fits today. This is just your own check-in.</p>
      <div className="rating-options" role="group" aria-label="Overall mood, from very low to very good">{scaleLabels.map((label, index) => <button type="button" className={`rating-choice${rating === index + 1 ? " is-selected" : ""}`} key={label} aria-pressed={rating === index + 1} onClick={() => setRating(index + 1)}><span>{["Very low", "Low", "In between", "Good", "Very good"][index]}</span></button>)}</div>
    </fieldset>
    <fieldset className="choice-fieldset"><legend>Any emotions you would like to name?</legend><p className="helper-copy">Pick none, one, or a few. These are not labels or diagnoses.</p>
      <div className="choice-chips">{emotionOptions.map((emotion) => <button type="button" key={emotion} className={`choice-chip${emotions.includes(emotion) ? " is-selected" : ""}`} aria-pressed={emotions.includes(emotion)} onClick={() => toggle(emotions, setEmotions, emotion)}>{emotion}</button>)}</div>
      {emotions.map((emotion) => emotionDetails[emotion] ? <div className="emotion-detail" key={emotion}><span>{emotion}, perhaps more specifically:</span><div className="choice-chips">{emotionDetails[emotion].map((detail) => <button type="button" key={detail} className={`choice-chip${emotions.includes(detail) ? " is-selected" : ""}`} aria-pressed={emotions.includes(detail)} onClick={() => toggle(emotions, setEmotions, detail)}>{detail}</button>)}</div></div> : null)}
    </fieldset>
    <fieldset className="choice-fieldset"><legend>Stress level, from lower to higher <span className="optional-label">optional</span></legend><div className="choice-chips">{[1,2,3,4,5].map((value) => <button key={value} type="button" aria-pressed={stress === value} className={`choice-chip${stress === value ? " is-selected" : ""}`} onClick={() => setStress(stress === value ? null : value)}>{value} / 5</button>)}</div></fieldset>
    <fieldset className="choice-fieldset"><legend>Anything that may be part of today? <span className="optional-label">optional</span></legend><div className="choice-chips">{contextOptions.map((item) => <button key={item} type="button" aria-pressed={context.includes(item)} className={`choice-chip${context.includes(item) ? " is-selected" : ""}`} onClick={() => toggle(context, setContext, item)}>{item}</button>)}</div></fieldset>
    <label className="wellbeing-label">A note for yourself <span className="optional-label">optional · you can describe another feeling here</span><textarea maxLength={1000} rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Anything you want to remember about this moment?" /></label>
    {error && <p className="form-feedback is-error" role="alert">{error}</p>}{saved && <p className="form-feedback" role="status">Your check-in is saved.</p>}
    <button className="primary-soft-button" type="submit" disabled={saving}>{saving ? "Saving…" : "Save check-in"}</button>
  </form>;
}
