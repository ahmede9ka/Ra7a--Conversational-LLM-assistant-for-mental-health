import { NextResponse } from "next/server";

export const runtime = "nodejs";

const safeFallback = "I’m sorry things feel so heavy right now. You don’t have to sort everything out at once. What feels most important to talk through first?";

function containsInternalDraft(text: string) {
  return /(?:^|\n)\s*(?:\d+[.)]\s*)?(?:\*\*)?(?:analy[sz]e the user input|analysis of the user input|formulate the response strategy|response strategy|draft(?:ing)? responses?|emotion:|core issue:|persona constraints:|word count:)/i.test(text)
    || /chain[- ]of[- ]thought|internal reasoning/i.test(text);
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "The chat service is not configured yet." }, { status: 503 });
  }

  let message: unknown;
  let language: unknown;
  try {
    ({ message, language } = await request.json());
  } catch {
    return NextResponse.json({ error: "Please send a valid message." }, { status: 400 });
  }
  if (typeof message !== "string" || !message.trim() || message.length > 2000) {
    return NextResponse.json({ error: "Message must be between 1 and 2000 characters." }, { status: 400 });
  }
  const responseLanguage = typeof language === "string" && ["en-GB", "en-US", "ar-SA", "fr-FR"].includes(language) ? language : "en-GB";
  const languageName = responseLanguage === "ar-SA" ? "Arabic" : responseLanguage === "fr-FR" ? "French" : "English";

  try {
    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "openrouter/free",
        messages: [
          { role: "system", content: `You are Raha, a warm and respectful emotional support companion. Reply directly to the person in a natural, caring voice. Reply in ${languageName} (${responseLanguage}) unless the user explicitly asks for another language. Never show analysis, reasoning, drafts, response plans, labels, word counts, or notes about following instructions. Output only the final message as plain text, with no headings or markdown. Keep it under 60 words. Listen, validate feelings, and offer gentle support without claiming to be a therapist or encouraging dependence. If someone may be in immediate danger or considering self-harm, respond with empathy and encourage them to contact local emergency services or a trusted person now.` },
          { role: "user", content: message.trim() },
        ],
        temperature: 0.6,
        max_tokens: 512,
        reasoning_effort: "none",
      }),
      cache: "no-store",
    });
    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      console.error("[chat] OpenRouter returned an error", upstream.status, detail.slice(0, 500));
      return NextResponse.json({ error: "The chat service couldn’t respond. Please try again." }, { status: 502 });
    }
    const data = await upstream.json();
    const choice = data.choices?.[0];
    const reply = choice?.message?.content?.trim();
    if (typeof reply !== "string" || !reply) {
      console.error("[chat] Model returned no reply text", data.model, choice?.finish_reason);
      throw new Error("Empty response");
    }
    if (containsInternalDraft(reply)) {
      console.error("[chat] Replaced internal-draft response", data.model);
      return NextResponse.json({ reply: safeFallback });
    }
    return NextResponse.json({ reply });
  } catch (error) {
    console.error("[chat] OpenRouter request failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "The chat service couldn’t respond. Please try again." }, { status: 502 });
  }
}
