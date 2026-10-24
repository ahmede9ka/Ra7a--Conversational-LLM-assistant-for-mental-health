export type CopingExercise = {
  id: string;
  title: string;
  description: string;
  purpose: string;
  durationMinutes: number;
  steps: string[];
  suitableContexts: string[];
  sources: { title: string; url: string }[];
  evidenceNote: string;
  limitation: string;
  version: number;
  lastReviewed: string;
  reviewStatus: "general-wellbeing" | "professional-review-needed";
};

// Reviewed, deterministic instructions. The app does not ask an LLM to create or alter these steps.
export const copingExercises: CopingExercise[] = [
  {
    id: "comfortable-breathing",
    title: "A few comfortable breaths",
    description: "A short, optional pause with an easy, steady rhythm.",
    purpose: "Notice your breathing for a moment, without trying to make it perfect.",
    durationMinutes: 3,
    steps: ["Find a position that feels comfortable.", "Let your breath move in gently, only as far as feels comfortable.", "Let the breath flow out gently. There is no need to hold it or count.", "If this feels uncomfortable, stop the guide and breathe normally."],
    suitableContexts: ["Taking a quiet pause", "Settling in before a reflection"],
    sources: [{ title: "NHS: Breathing exercises for stress", url: "https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/breathing-exercises-for-stress/" }],
    evidenceNote: "The NHS describes a gentle, comfortable breathing exercise as a self-help option. This app's timer is a design aid, not a treatment.",
    limitation: "Breathing patterns feel different for different people. Stop if you feel discomfort; this exercise is not a substitute for care.",
    version: 1,
    lastReviewed: "2026-10-24",
    reviewStatus: "general-wellbeing",
  },
  {
    id: "five-senses-grounding",
    title: "Notice your surroundings",
    description: "A flexible five-senses prompt to bring attention to the present moment.",
    purpose: "Take a moment to notice details around you, one sense at a time.",
    durationMinutes: 5,
    steps: ["Notice up to five things you can see.", "Notice up to four things you can feel, such as the chair supporting you.", "Notice up to three things you can hear.", "If comfortable, notice up to two things you can smell.", "If comfortable, notice one thing you can taste. You can skip any prompt."],
    suitableContexts: ["A short pause", "When you would like to notice your surroundings"],
    sources: [{ title: "Royal United Hospitals Bath: Mindfulness and grounding exercises", url: "https://www.ruh.nhs.uk/patients/patient_information/PAE129_Mindfulness_and_grounding_exercises.pdf" }],
    evidenceNote: "This is a commonly shared grounding prompt, adapted from an NHS hospital patient leaflet.",
    limitation: "Grounding is optional and is not guaranteed to change how you feel or treat a condition. Skip or stop whenever you like.",
    version: 1,
    lastReviewed: "2026-10-24",
    reviewStatus: "general-wellbeing",
  },
];

export const emotionOptions = ["Happy", "Calm", "Hopeful", "Sad", "Anxious", "Stressed", "Angry", "Lonely", "Overwhelmed", "Tired", "Other", "Unsure"] as const;
export const emotionDetails: Record<string, string[]> = {
  Sad: ["Disappointed", "Lonely", "Discouraged"],
  Anxious: ["Worried", "Nervous", "Uncertain"],
  Angry: ["Frustrated", "Irritated"],
  Happy: ["Content", "Excited", "Hopeful"],
  Overwhelmed: ["Overloaded", "Mentally tired"],
  Calm: ["Relaxed", "Settled"],
};

export const activityCategories = ["Movement", "Social connection", "Rest", "Hobbies", "Everyday responsibilities", "Time outdoors", "Personal care", "Other"] as const;
