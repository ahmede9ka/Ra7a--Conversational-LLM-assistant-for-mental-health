"use client";

import { WellbeingNav } from "./WellbeingNav";
import { MoodCheckIn } from "./MoodCheckIn";
import { ReflectionWizard } from "./ReflectionWizard";

export function ReflectPage() {
  return <main className="page-shell wellbeing-shell"><WellbeingNav active="/reflect"/><section className="feature-page" aria-labelledby="reflect-title"><header className="feature-page-heading"><span className="section-kicker">REFLECT</span><h1 id="reflect-title">Make room for what you feel.</h1><p>A small check-in or a guided journal. Choose what feels right today.</p></header><div className="reflect-page-layout"><section className="feature-card" aria-labelledby="mood-checkin-title"><div className="feature-heading"><span className="section-kicker">A MOMENT FOR YOU</span><h2 id="mood-checkin-title">Mood check-in</h2><p>Keep a private record of how today feels. You choose what to share.</p></div><MoodCheckIn/></section><ReflectionWizard/></div></section></main>;
}
