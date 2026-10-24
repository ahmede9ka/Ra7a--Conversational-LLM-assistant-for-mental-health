import type { ChatRequest } from "@/lib/chat/validation";

const crisisPatterns = [
  /\b(suicid(?:e|al)|kill myself|end my life|take my own life|want to die|hurt myself|self[- ]harm|cut myself|overdose on purpose)\b/i,
  /\b(me suicider|suicidaire|mettre fin à mes jours|me tuer|me faire du mal|automutilation)\b/i,
  /(أنتحر|انتحر|أقتل نفسي|أنهي حياتي|أؤذي نفسي|إيذاء نفسي)/,
];

export function isPossibleSelfHarmCrisis(message: string) {
  return crisisPatterns.some((pattern) => pattern.test(message));
}

export function getCrisisReply(language: ChatRequest["language"]) {
  if (language === "fr-FR") return "Merci de me l'avoir dit. Es-tu en danger immédiat ou penses-tu à te faire du mal maintenant ? Si oui, appelle les services d'urgence locaux ou rends-toi aux urgences, et demande à une personne de confiance de rester avec toi. Tu n'as pas à traverser cela seul(e).";
  if (language === "ar-SA") return "شكرًا لأنك أخبرتني. هل أنت في خطر الآن أو تفكر في إيذاء نفسك؟ إذا كان الأمر كذلك، فاتصل بخدمات الطوارئ المحلية أو توجّه إلى أقرب قسم طوارئ، واطلب من شخص تثق به أن يبقى معك. لا يلزم أن تواجه هذا وحدك.";
  return "Thank you for telling me. Are you in immediate danger or thinking about hurting yourself right now? If yes, call your local emergency services or go to an emergency department, and ask someone you trust to stay with you. You don't have to face this alone.";
}

export function buildMentalHealthSystemPrompt(language: ChatRequest["language"], possibleCrisis: boolean) {
  const languageName = language === "ar-SA" ? "Arabic" : language === "fr-FR" ? "French" : "English";
  const crisisInstruction = possibleCrisis
    ? "The message contains a possible self-harm or suicide warning. Respond with calm empathy, ask directly whether the person is in immediate danger right now, and if so encourage local emergency services and a trusted person to stay with them. Do not provide a guessed hotline number, minimize their words, or leave them with only generic encouragement."
    : "If the person expresses immediate danger or possible self-harm, respond with empathy, ask about immediate safety, and encourage local emergency services and a trusted person. Do not guess local hotline numbers.";
  return `You are Raha, a warm and respectful emotional support companion. Reply directly in ${languageName} unless the user explicitly requests another language. Never show analysis, reasoning, drafts, labels, or word counts. Output plain text, no headings or markdown, and keep it under 60 words. Validate feelings and offer gentle support without claiming to be a therapist or encouraging dependence. ${crisisInstruction}`;
}

export function containsInternalDraft(text: string) {
  return /(?:^|\n)\s*(?:\d+[.)]\s*)?(?:\*\*)?(?:analy[sz]e the user input|analysis of the user input|formulate the response strategy|response strategy|draft(?:ing)? responses?|emotion:|core issue:|persona constraints:|word count:)/i.test(text)
    || /chain[- ]of[- ]thought|internal reasoning/i.test(text);
}
