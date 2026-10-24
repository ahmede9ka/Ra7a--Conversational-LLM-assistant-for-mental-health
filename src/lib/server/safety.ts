import type { ChatRequest } from "@/lib/chat/validation";

export type SafetyRisk = "none" | "possible" | "imminent";

const selfHarmPatterns = [
  /\b(suicidal|suicide|kill myself|end my life|take my own life|want to die|hurt myself|self[- ]harm|cut myself|overdose on purpose)\b/i,
  /\b(me suicider|suicidaire|mettre fin à mes jours|me tuer|me faire du mal|automutilation)\b/i,
  /(انتحار|انتحر|أقتل نفسي|أنهي حياتي|أؤذي نفسي|إيذاء نفسي|نفكر\s+(?:في\s+)?(?:نقتل|نضر)\s+(?:روحي|نفسي)|نحب\s+نموت|ما عادش نحب نعيش|نقتل روحي)/,
];
const imminentPatterns = [
  /\b(i am|i'm|im) going to (kill|hurt) myself\b/i,
  /\b(i will|i'll) (kill|hurt) myself\b/i,
  /\b(tonight|right now|today)\b.{0,70}\b(kill myself|end my life|hurt myself|overdose)\b/i,
  /\b(plan|means|pills|weapon)\b.{0,60}\b(kill myself|end my life|suicide)\b/i,
  /(سأنتحر|سأقتل نفسي|سأؤذي نفسي|باش\s+نقتل\s+روحي|توا.{0,25}نقتل\s+روحي)/,
];
const negationOrThirdParty = /\b(not suicidal|not going to hurt myself|never hurt myself|my friend|my sister|my brother|someone i know|in a story|for a character)\b/i;

export function classifySafetyRisk(message: string): SafetyRisk {
  if (!selfHarmPatterns.some((pattern) => pattern.test(message))) return "none";
  if (negationOrThirdParty.test(message) && !imminentPatterns.some((pattern) => pattern.test(message))) return "none";
  return imminentPatterns.some((pattern) => pattern.test(message)) ? "imminent" : "possible";
}

export function isPossibleSelfHarmCrisis(message: string) {
  return classifySafetyRisk(message) !== "none";
}

export function getCrisisReply(language: ChatRequest["language"], risk: Exclude<SafetyRisk, "none"> = "possible") {
  if (language === "fr-FR") {
    return risk === "imminent"
      ? "Je suis désolé que tu traverses cela. Si tu risques de te faire du mal maintenant, appelle les services d'urgence locaux ou rends-toi aux urgences. Éloigne-toi de ce qui pourrait te blesser et demande à une personne de confiance de rester avec toi. Es-tu en sécurité à cet instant ?"
      : "Merci de me l'avoir dit. Est-ce que tu risques de te faire du mal maintenant, ou as-tu un plan pour le faire ? Si oui, appelle les services d'urgence locaux et demande à une personne de confiance de rester avec toi."
  }
  if (language === "ar-SA") {
    return risk === "imminent"
      ? "آسف لأنك تمر بهذا. إذا كنت معرضًا لإيذاء نفسك الآن، اتصل بالطوارئ المحلية أو توجّه إلى قسم الطوارئ، واطلب من شخص تثق به أن يبقى معك. ابتعد عن أي شيء قد يؤذيك. هل أنت في مكان آمن الآن؟"
      : "شكرًا لأنك أخبرتني. هل تفكر في إيذاء نفسك الآن، أو لديك خطة لذلك؟ إذا كان الخطر قريبًا، اتصل بالطوارئ المحلية واطلب من شخص تثق به أن يبقى معك."
  }
  return risk === "imminent"
    ? "I'm sorry things feel this intense. If you may hurt yourself now, call your local emergency services or go to an emergency department. Move away from anything you could use to hurt yourself, and ask someone you trust to stay with you. Are you somewhere safe right now?"
    : "Thank you for telling me. Are you thinking about hurting yourself now, or do you have a plan to do so? If there may be immediate danger, contact local emergency services and ask someone you trust to stay with you."
}

export function getSafetyInstruction(risk: SafetyRisk) {
  if (risk === "imminent") return "SAFETY PRIORITY: The message suggests possible immediate danger. Use direct, compassionate language. Encourage local emergency services, moving away from means of harm, and a trusted person physically staying with them. Ask whether they are safe right now. Never invent numbers or claim to dispatch help.";
  if (risk === "possible") return "SAFETY PRIORITY: The message suggests possible self-harm. Respond without judgment, ask clearly whether they are in immediate danger or have a plan, and encourage emergency services and a trusted person if risk is immediate. Never invent local numbers.";
  return "Safety boundaries: Never diagnose, prescribe, recommend changing medication, claim clinical credentials, or claim to contact emergency services. If the person indicates immediate danger, prioritize local emergency help and a trusted person. Never invent emergency numbers.";
}

export function containsInternalDraft(text: string) {
  return /(?:^|\n)\s*(?:\d+[.)]\s*)?(?:\*\*)?(?:analy[sz]e the user input|analysis of the user input|formulate the response strategy|response strategy|draft(?:ing)? responses?|emotion:|core issue:|persona constraints:|word count:)/i.test(text)
    || /chain[- ]of[- ]thought|internal reasoning/i.test(text);
}
