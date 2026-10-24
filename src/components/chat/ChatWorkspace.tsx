"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { signOutAction } from "@/app/auth/actions";
import type { AIOrbState } from "@/components/AIOrb";
import type { Database } from "@/lib/supabase/database.types";

const AIOrb = dynamic(() => import("@/components/AIOrb"), { ssr: false, loading: () => <div className="ai-orb orb-loading" aria-hidden="true" /> });
type Conversation = Pick<Database["public"]["Tables"]["conversations"]["Row"], "id" | "title" | "updated_at">;
type Message = Pick<Database["public"]["Tables"]["messages"]["Row"], "id" | "role" | "content" | "created_at" | "request_id"> & { delivery?: "sending" | "failed" };
type SpeechRecognitionResult = { 0: { transcript: string } };
type SpeechRecognitionEvent = { results: ArrayLike<SpeechRecognitionResult> };
type Recognition = { lang: string; interimResults: boolean; onresult: ((event: SpeechRecognitionEvent) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void; stop: () => void };
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };

function words(text: string) { return text.trim().split(/\s+/).filter(Boolean); }

export function ChatWorkspace({ initialConversations, initialConversationId, initialMessages, email, displayName }: {
  initialConversations: Conversation[];
  initialConversationId: string | null;
  initialMessages: Message[];
  email: string;
  displayName: string | null;
}) {
  const [conversations, setConversations] = useState(initialConversations);
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [messages, setMessages] = useState(initialMessages);
  const [visibleWords, setVisibleWords] = useState<Record<string, number>>({});
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [orbState, setOrbState] = useState<AIOrbState>("idle");
  const [voiceReplies, setVoiceReplies] = useState(true);
  const [orbMotion, setOrbMotion] = useState(true);
  const [language, setLanguage] = useState("en-GB");
  const router = useRouter();
  const lock = useRef(false);
  const conversationViewportRef = useRef<HTMLDivElement>(null);
  const followConversationRef = useRef(true);
  const recognitionRef = useRef<Recognition | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const speechTimers = useRef<number[]>([]);
  const speechRevealInterval = useRef<number | null>(null);

  const clearSpeechTimers = useCallback(() => {
    speechTimers.current.forEach((timer) => window.clearTimeout(timer));
    speechTimers.current = [];
  }, []);

  const stopSpeechReveal = useCallback(() => {
    if (speechRevealInterval.current !== null) {
      window.clearInterval(speechRevealInterval.current);
      speechRevealInterval.current = null;
    }
  }, []);

  useEffect(() => {
    const preferenceTimer = window.setTimeout(() => {
      setVoiceReplies(window.localStorage.getItem("raha.voiceReplies") !== "false");
      setOrbMotion(window.localStorage.getItem("raha.orbMotion") !== "false");
      setLanguage(window.localStorage.getItem("raha.language") || "en-GB");
    }, 0);
    return () => {
      window.clearTimeout(preferenceTimer);
      abortRef.current?.abort();
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
      stopSpeechReveal();
      clearSpeechTimers();
    };
  }, [clearSpeechTimers, stopSpeechReveal]);

  useEffect(() => {
    const viewport = conversationViewportRef.current;
    if (!viewport || !followConversationRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      viewport.scrollTop = viewport.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, visibleWords]);

  function revealReply(message: Message, text: string) {
    stopSpeechReveal();
    clearSpeechTimers();
    const replyWords = words(text);
    setVisibleWords((current) => ({ ...current, [message.id]: 0 }));
    const showNext = (index: number) => {
      setVisibleWords((current) => ({ ...current, [message.id]: Math.min(replyWords.length, index + 1) }));
      if (index + 1 < replyWords.length) speechTimers.current.push(window.setTimeout(() => showNext(index + 1), 180));
    };
    showNext(0);
  }

  async function createConversation() {
    const response = await fetch("/api/conversations", { method: "POST" });
    const data = await response.json().catch(() => ({}));
      if (response.status === 401) { router.replace("/login?error=session"); throw new Error("Your session expired. Please sign in again."); }
      if (!response.ok) throw new Error(data.error || "Could not start a new conversation.");
    const created = data.conversation as Conversation;
    setConversations((current) => [created, ...current]);
    setConversationId(created.id);
    setMessages([]);
    setStatus("");
    return created.id as string;
  }

  async function loadConversation(id: string) {
    if (busy || id === conversationId) return;
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch(`/api/conversations/${id}`);
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) { router.replace("/login?error=session"); return; }
      if (!response.ok) throw new Error(data.error || "Could not load this conversation.");
      followConversationRef.current = true;
      setConversationId(id);
      setMessages(data.messages as Message[]);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load this conversation.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteConversation(id: string) {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) { router.replace("/login?error=session"); return; }
      if (!response.ok) throw new Error(data.error || "Could not delete this conversation.");
      const remaining = conversations.filter((item) => item.id !== id);
      setConversations(remaining);
      if (conversationId === id) {
        const next = remaining[0];
        if (next) {
          const loaded = await fetch(`/api/conversations/${next.id}`);
          const result = await loaded.json().catch(() => ({}));
          if (!loaded.ok) throw new Error(result.error || "Conversation deleted, but the next one could not be loaded.");
          followConversationRef.current = true;
          setConversationId(next.id);
          setMessages(result.messages as Message[]);
        } else {
          followConversationRef.current = true;
          setConversationId(null);
          setMessages([]);
        }
      }
      setStatus("Conversation deleted.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not delete this conversation.");
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(text: string, requestId = crypto.randomUUID(), retry = false) {
    if (lock.current || !text.trim()) return;
    lock.current = true;
    followConversationRef.current = true;
    setBusy(true);
    setStatus("I’m here with you.");
    setOrbState("thinking");
    let activeConversationId = conversationId;
    let temporaryMessageId = requestId;
    if (!retry) {
      temporaryMessageId = `local-${requestId}`;
      setMessages((current) => [...current, { id: temporaryMessageId, role: "user", content: text.trim(), created_at: new Date().toISOString(), request_id: requestId, delivery: "sending" }]);
    } else {
      setMessages((current) => current.map((item) => item.request_id === requestId ? { ...item, delivery: "sending" } : item));
    }
    try {
      if (!activeConversationId) activeConversationId = await createConversation();
      const controller = new AbortController();
      abortRef.current = controller;
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeConversationId, requestId, message: text.trim(), language }),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) { router.replace("/login?error=session"); throw new Error("Your session expired. Please sign in again."); }
      if (!response.ok) throw new Error(data.error || "Raha could not reply. Please try again.");
      const userMessage = data.userMessage as Message;
      const assistantMessage = data.assistantMessage as Message;
      setMessages((current) => {
        const withoutOptimistic = current.filter((item) => item.id !== temporaryMessageId && item.request_id !== requestId);
        return [...withoutOptimistic, userMessage, assistantMessage];
      });
      setConversations((current) => current.map((item) => item.id === activeConversationId ? { ...item, title: data.conversation.title, updated_at: userMessage.created_at } : item).sort((a, b) => b.updated_at.localeCompare(a.updated_at)));
      setStatus("");
      const replyWords = words(assistantMessage.content);
      setVisibleWords((current) => ({ ...current, [assistantMessage.id]: 0 }));
      if (voiceReplies && "speechSynthesis" in window) {
        stopSpeechReveal();
        clearSpeechTimers();
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(assistantMessage.content);
        utterance.lang = language;
        let scheduledWords = 0;
        utterance.onstart = () => {
          setOrbState("speaking");
          scheduledWords = Math.max(scheduledWords, 1);
          setVisibleWords((current) => ({ ...current, [assistantMessage.id]: Math.max(current[assistantMessage.id] || 0, scheduledWords) }));
          speechRevealInterval.current = window.setInterval(() => {
            scheduledWords = Math.min(replyWords.length, scheduledWords + 1);
            setVisibleWords((current) => ({ ...current, [assistantMessage.id]: Math.max(current[assistantMessage.id] || 0, scheduledWords) }));
            if (scheduledWords >= replyWords.length) stopSpeechReveal();
          }, 340);
        };
        utterance.onboundary = (event) => {
          if (event.name === "word") {
            const shown = Math.min(replyWords.length, assistantMessage.content.slice(0, event.charIndex).trim().split(/\s+/).filter(Boolean).length + 1);
            scheduledWords = Math.max(scheduledWords, shown);
            setVisibleWords((current) => ({ ...current, [assistantMessage.id]: Math.max(current[assistantMessage.id] || 0, shown) }));
          }
        };
        utterance.onend = () => {
          stopSpeechReveal();
          clearSpeechTimers();
          setVisibleWords((current) => ({ ...current, [assistantMessage.id]: replyWords.length }));
          setOrbState("idle");
        };
        utterance.onerror = () => {
          stopSpeechReveal();
          revealReply(assistantMessage, assistantMessage.content);
          setOrbState("idle");
        };
        window.speechSynthesis.speak(utterance);
      } else {
        revealReply(assistantMessage, assistantMessage.content);
        setOrbState("idle");
      }
    } catch (error) {
      setMessages((current) => current.map((item) => item.request_id === requestId ? { ...item, delivery: "failed" } : item));
      setStatus(error instanceof Error ? error.message : "Raha could not reply. Please try again.");
      setOrbState("idle");
    } finally {
      abortRef.current = null;
      lock.current = false;
      setBusy(false);
    }
  }

  function startListening() {
    if (busy) return;
    const speechWindow = window as SpeechWindow;
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) { setStatus("Voice input is not available in this browser. You can write instead."); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = language;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) void sendMessage(transcript);
    };
    recognition.onerror = () => { setStatus("I didn't quite catch that. Would you try again, or write it to me?"); setOrbState("idle"); setBusy(false); };
    recognition.onend = () => {
      setOrbState((current) => current === "listening" ? "idle" : current);
      if (!lock.current) setBusy(false);
    };
    recognitionRef.current = recognition;
    setBusy(true);
    setOrbState("listening");
    setStatus("I’m here.");
    try { recognition.start(); } catch { setStatus("I couldn't start listening. You can write to me instead."); setBusy(false); setOrbState("idle"); }
  }

  return (
    <main className="page-shell">
      <header className="app-topbar">
        <span className="signed-in-as">{displayName || email}</span>
        <div className="topbar-actions">
          <Link className="settings-button" href="/settings" aria-label="Open settings" title="Settings"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="m19.4 15 .1.1a1.8 1.8 0 0 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3 .9v.2a1.8 1.8 0 0 1-3.6 0v-.2a1.8 1.8 0 0 0-3-.9l-.1.1a1.8 1.8 0 0 1-2.5-2.5l.1-.1a1.8 1.8 0 0 0-.9-3H3.7a1.8 1.8 0 0 1 0-3.6h.2a1.8 1.8 0 0 0 .9-3l-.1-.1a1.8 1.8 0 0 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3-.9v-.2a1.8 1.8 0 0 1 3.6 0v.2a1.8 1.8 0 0 0 3 .9l.1-.1a1.8 1.8 0 0 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 .9 3h.2a1.8 1.8 0 0 1 0 3.6h-.2a1.8 1.8 0 0 0-.9 3Z"/></svg></Link>
          <form action={signOutAction}><button className="logout-button" type="submit">Log out</button></form>
        </div>
      </header>
      <section className="wellness-card authenticated-card" aria-labelledby="page-title">
        <div className="orb-panel">
          <div className="brand-logo" lang="ar" dir="rtl" aria-label="Raha">راحة</div>
          <h1 id="page-title">A space to pause.</h1>
          <p className="intro">Take a breath. Share what&apos;s on your mind.</p>
          <div className="voice-area">
            <AIOrb state={orbState} motionEnabled={orbMotion} />
            <p className="status" aria-live="polite" data-visible={Boolean(status)}>{status}</p>
            <button className="mic-button" onClick={startListening} disabled={busy} aria-label="Start voice input"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5M9 21.5h6"/></svg></button>
          </div>
        </div>
        <div className="chat-panel">
          <div className="history-bar"><span>YOUR CONVERSATIONS</span><button type="button" onClick={() => void createConversation().catch((error) => setStatus(error instanceof Error ? error.message : "Could not start a new conversation."))} disabled={busy}>＋ New</button></div>
          <div className="conversation-switcher" aria-label="Saved conversations">
            {conversations.map((item) => <div className={`conversation-chip${item.id === conversationId ? " is-active" : ""}`} key={item.id}>
              <button type="button" className="conversation-select" onClick={() => void loadConversation(item.id)} disabled={busy} aria-current={item.id === conversationId ? "page" : undefined}>{item.title}</button>
              <button type="button" className="conversation-delete" onClick={() => { if (window.confirm(`Delete “${item.title}” and its messages?`)) void deleteConversation(item.id); }} disabled={busy} aria-label={`Delete ${item.title}`}>×</button>
            </div>)}
          </div>
          <div className="chat-cloud-frame">
            <div
              className="conversation"
              ref={conversationViewportRef}
              tabIndex={0}
              aria-label="Conversation messages"
              aria-live="polite"
              onScroll={(event) => {
                const viewport = event.currentTarget;
                followConversationRef.current = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 72;
              }}
            >
              {messages.length === 0 && <div className="conversation-empty">{busy ? "Loading your conversation…" : "Whenever you're ready, you can start here."}</div>}
              {messages.map((message) => <div className={`message ${message.role === "user" ? "user-message" : "reply-message"}`} key={message.id}>
                <span className="message-label">{message.role === "user" ? "YOU SHARED" : "RAHA"}</span>
                <p dir="auto">{message.role === "assistant" ? words(message.content).slice(0, visibleWords[message.id] ?? words(message.content).length).map((word, index) => <span className="reply-word" key={`${index}-${word}`}>{word}</span>) : message.content}</p>
                {message.delivery === "failed" && message.request_id && <button className="retry-message" type="button" onClick={() => void sendMessage(message.content, message.request_id as string, true)} disabled={busy}>Reply failed. Retry</button>}
              </div>)}
            </div>
            <form className="text-entry" onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const input = new FormData(form).get("message")?.toString().trim();
              if (input) { void sendMessage(input); form.reset(); }
            }}>
              <label className="sr-only" htmlFor="message">Type your message</label>
              <input id="message" name="message" placeholder="Write what's on your mind…" maxLength={2000} disabled={busy} />
              <button type="submit" disabled={busy} aria-label="Send message">↑</button>
            </form>
            <p className="privacy-note">Your chats are saved to your account and shared with your chosen AI provider.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
