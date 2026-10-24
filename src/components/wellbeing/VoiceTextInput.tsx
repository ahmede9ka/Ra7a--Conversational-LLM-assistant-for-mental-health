"use client";

import { useEffect, useRef, useState } from "react";

type Result = { 0: { transcript: string } };
type RecognitionEvent = { results: ArrayLike<Result> };
type Recognition = {
  lang: string; interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: (() => void) | null; onend: (() => void) | null;
  start: () => void; stop: () => void;
};
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };

export function VoiceTextInput({ value, onChange, label, placeholder }: { value: string; onChange: (value: string) => void; label: string; placeholder: string }) {
  const recognitionRef = useRef<Recognition | null>(null);
  const [recording, setRecording] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => () => {
    const recognition = recognitionRef.current;
    if (recognition) { recognition.onresult = null; recognition.onerror = null; recognition.onend = null; try { recognition.stop(); } catch { /* Recognition may already be idle. */ } }
  }, []);
  function toggleRecording() {
    if (recording) { recognitionRef.current?.stop(); setRecording(false); setNotice("Recording stopped. Review or edit the words before saving."); return; }
    const speechWindow = window as SpeechWindow;
    const Constructor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Constructor) { setNotice("Speech input is not available in this browser. You can type instead."); return; }
    const recognition = new Constructor();
    try { recognition.lang = window.localStorage.getItem("raha.language") || navigator.language || "en-US"; }
    catch { recognition.lang = navigator.language || "en-US"; }
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0]?.transcript || "").join(" ").trim();
      if (transcript) onChange([value.trim(), transcript].filter(Boolean).join(" "));
      setNotice("Transcript ready. Review or edit it before saving.");
    };
    recognition.onerror = () => { setRecording(false); setNotice("Microphone access was unavailable. You can type instead."); };
    recognition.onend = () => setRecording(false);
    recognitionRef.current = recognition;
    setNotice("Recording. Select Stop when you are finished.");
    try { recognition.start(); setRecording(true); } catch { setNotice("Could not start speech input. You can type instead."); }
  }

  return <div className="voice-text-field">
    <label>{label}</label>
    <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={3} />
    <div className="voice-field-footer"><button type="button" className="soft-button" onClick={toggleRecording} aria-pressed={recording}>{recording ? "Stop recording" : "Use voice"}</button><span aria-live="polite">{notice}</span></div>
  </div>;
}
