"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { AIOrbState } from "@/components/AIOrb";

const AIOrb = dynamic(() => import("@/components/AIOrb"), { ssr: false, loading: () => <div className="ai-orb orb-loading" aria-hidden="true" /> });

type SpeechRecognitionResult = { 0: { transcript: string } };
type SpeechRecognitionEvent = { results: ArrayLike<SpeechRecognitionResult> };
type Recognition = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

function getReplyWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean);
}

export default function Home() {
  const [heard, setHeard] = useState("");
  const [reply, setReply] = useState("");
  const [visibleReplyWords, setVisibleReplyWords] = useState(0);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [orbState, setOrbState] = useState<AIOrbState>("idle");
  const [voiceReplies, setVoiceReplies] = useState(true);
  const [orbMotion, setOrbMotion] = useState(true);
  const [language, setLanguage] = useState("en-GB");
  const requestInFlight = useRef(false);
  const recognitionRef = useRef<Recognition | null>(null);
  const revealStartTimer = useRef<number | null>(null);
  const revealInterval = useRef<number | null>(null);

  function clearRevealTimers() {
    if (revealStartTimer.current !== null) window.clearTimeout(revealStartTimer.current);
    if (revealInterval.current !== null) window.clearInterval(revealInterval.current);
    revealStartTimer.current = null;
    revealInterval.current = null;
  }

  function revealWithTimer(text: string, millisecondsPerWord: number) {
    clearRevealTimers();
    const totalWords = getReplyWords(text).length;
    let shownWords = 0;
    revealInterval.current = window.setInterval(() => {
      shownWords = Math.min(shownWords + 1, totalWords);
      setVisibleReplyWords(shownWords);
      if (shownWords >= totalWords) clearRevealTimers();
    }, millisecondsPerWord);
  }

  useEffect(() => {
    setVoiceReplies(window.localStorage.getItem("raha.voiceReplies") !== "false");
    setOrbMotion(window.localStorage.getItem("raha.orbMotion") !== "false");
    setLanguage(window.localStorage.getItem("raha.language") || "en-GB");
    return () => clearRevealTimers();
  }, []);

  async function respondTo(message: string) {
    clearRevealTimers();
    setVisibleReplyWords(0);
    requestInFlight.current = true;
    setBusy(true);
    setOrbState("thinking");
    setStatus("Let me sit with that for a moment…");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, language }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not get a reply.");
      setReply(data.reply);
      setVisibleReplyWords(0);
      setStatus("I’m here with you");
      if (voiceReplies && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(data.reply);
        const words = getReplyWords(data.reply);
        let receivedWordBoundary = false;
        utterance.lang = language;
        utterance.onstart = () => {
          setOrbState("speaking");
          setStatus("I’m here with you.");
          setVisibleReplyWords((count) => Math.max(count, Math.min(1, words.length)));
          revealStartTimer.current = window.setTimeout(() => {
            if (!receivedWordBoundary) revealWithTimer(data.reply, 200);
          }, 450);
        };
        utterance.onboundary = (event) => {
          if (event.name !== "word") return;
          receivedWordBoundary = true;
          clearRevealTimers();
          const wordsBeforeBoundary = data.reply.slice(0, event.charIndex).trim().split(/\s+/).filter(Boolean).length;
          const wordsToShow = Math.min(words.length, wordsBeforeBoundary + 2);
          setVisibleReplyWords((count) => Math.max(count, wordsToShow));
        };
        utterance.onend = () => {
          clearRevealTimers();
          setVisibleReplyWords(words.length);
          setOrbState("idle");
          setStatus("");
        };
        utterance.onerror = () => {
          clearRevealTimers();
          revealWithTimer(data.reply, 180);
          setOrbState("idle");
          setStatus("");
        };
        window.speechSynthesis.speak(utterance);
      } else {
        revealWithTimer(data.reply, 180);
        setOrbState("idle");
        setStatus("I’m here with you.");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Something went wrong. Please try again.");
      setOrbState("idle");
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }

  function startListening() {
    if (busy) return;
    const speechWindow = window as SpeechWindow;
      const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatus("I can’t listen here, but you can write to me instead.");
      return;
    }
    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.lang = language;
      recognition.interimResults = false;
      recognition.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript?.trim();
        if (transcript) {
          setHeard(transcript);
          void respondTo(transcript);
        }
      };
      recognition.onerror = () => {
        setStatus("I didn’t quite catch that. Would you try again, or write it to me?");
        setOrbState("idle");
        setBusy(false);
      };
      recognition.onend = () => {
        if (!requestInFlight.current) {
          setOrbState((current) => current === "listening" ? "idle" : current);
          setBusy(false);
        }
      };
      recognitionRef.current = recognition;
    }
    setReply("");
    setBusy(true);
    setOrbState("listening");
    setStatus("I’m here. Take your time.");
    try {
      recognitionRef.current.start();
    } catch {
      setStatus("I’m listening already. Take your time.");
      setBusy(false);
      setOrbState("idle");
    }
  }

  return (
    <main className="page-shell">
      <Link className="settings-button" href="/settings" aria-label="Open settings" title="Settings">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="m19.4 15 .1.1a1.8 1.8 0 0 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3 .9v.2a1.8 1.8 0 0 1-3.6 0v-.2a1.8 1.8 0 0 0-3-.9l-.1.1a1.8 1.8 0 0 1-2.5-2.5l.1-.1a1.8 1.8 0 0 0-.9-3H3.7a1.8 1.8 0 0 1 0-3.6h.2a1.8 1.8 0 0 0 .9-3l-.1-.1a1.8 1.8 0 0 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3-.9v-.2a1.8 1.8 0 0 1 3.6 0v.2a1.8 1.8 0 0 0 3 .9l.1-.1a1.8 1.8 0 0 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 .9 3h.2a1.8 1.8 0 0 1 0 3.6h-.2a1.8 1.8 0 0 0-.9 3Z"/></svg>
      </Link>
      <section className="wellness-card" aria-labelledby="page-title">
        <div className="orb-panel">
          <div className="brand-logo" lang="ar" dir="rtl" aria-label="Raha">راحة</div>
          <h1 id="page-title">A space to pause.</h1>
          <p className="intro">Take a breath. Share what’s on your mind.</p>

          <div className="voice-area">
            <AIOrb state={orbState} motionEnabled={orbMotion} />
            <p className="status" aria-live="polite" data-visible={Boolean(status)}>{status}</p>
            <button className="mic-button" onClick={startListening} disabled={busy} aria-label="Start voice input">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5M9 21.5h6"/></svg>
            </button>
          </div>
        </div>

        <div className="chat-panel">
          <div className="chat-cloud-frame">
            <div className="conversation" aria-label="Conversation">
              {heard && <div className="message user-message"><span className="message-label">YOU SHARED</span><p>{heard}</p></div>}
              {reply && <div className="message reply-message"><span className="message-label">RAHA</span><p aria-live="off">{getReplyWords(reply).slice(0, visibleReplyWords).map((word, index) => <span className="reply-word" key={`${index}-${word}`}>{word}</span>)}</p></div>}
            </div>

            <form className="text-entry" onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const input = new FormData(form).get("message")?.toString().trim();
              if (input) { setHeard(input); setReply(""); void respondTo(input); form.reset(); }
            }}>
              <label className="sr-only" htmlFor="message">Type your message</label>
              <input id="message" name="message" placeholder="Write what’s on your mind…" maxLength={2000} />
              <button type="submit" disabled={busy} aria-label="Send message">↑</button>
            </form>
            <p className="privacy-note">A gentle companion for everyday feelings. Not a substitute for professional care.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

