"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signOutAction, updateDisplayNameAction } from "@/app/auth/actions";

type SettingsTab = "General" | "Voice" | "Appearance" | "Account";

export function SettingsView({ email, displayName, error, saved }: { email: string; displayName: string; error?: string; saved: boolean }) {
  const [tab, setTab] = useState<SettingsTab>("General");
  const [voiceReplies, setVoiceReplies] = useState(true);
  const [orbMotion, setOrbMotion] = useState(true);
  const [language, setLanguage] = useState("en-GB");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const preferenceTimer = window.setTimeout(() => {
      setVoiceReplies(window.localStorage.getItem("raha.voiceReplies") !== "false");
      setOrbMotion(window.localStorage.getItem("raha.orbMotion") !== "false");
      setLanguage(window.localStorage.getItem("raha.language") || "en-GB");
    }, 0);
    return () => window.clearTimeout(preferenceTimer);
  }, []);

  function updateVoiceReplies(enabled: boolean) { setVoiceReplies(enabled); window.localStorage.setItem("raha.voiceReplies", String(enabled)); }
  function updateOrbMotion(enabled: boolean) { setOrbMotion(enabled); window.localStorage.setItem("raha.orbMotion", String(enabled)); }
  function updateLanguage(value: string) { setLanguage(value); window.localStorage.setItem("raha.language", value); }
  function resetPreferences() {
    updateVoiceReplies(true);
    updateOrbMotion(true);
    updateLanguage("en-GB");
    setNotice("Your preferences are back to their defaults.");
  }

  return (
    <main className="settings-shell">
      <section className="settings-page" aria-labelledby="settings-title">
        <header className="settings-header">
          <Link href="/" className="back-button" aria-label="Back to Raha"><span aria-hidden="true">‹</span><span>Raha</span></Link>
          <span className="settings-kicker">YOUR SPACE</span>
          <h1 id="settings-title">Settings</h1>
          <p>Make this space feel right for you.</p>
        </header>
        <nav className="settings-tabs" aria-label="Settings sections">
          {(["General", "Voice", "Appearance", "Account"] as SettingsTab[]).map((item) => <button key={item} type="button" className={`settings-tab${tab === item ? " is-selected" : ""}`} aria-current={tab === item ? "page" : undefined} onClick={() => setTab(item)}>{item}</button>)}
        </nav>

        {tab === "General" && <section className="settings-content" aria-label="General settings">
          <div className="settings-section-heading"><span>WELCOME</span><h2>Your pace, your space.</h2></div>
          <div className="glass-setting-card about-card"><span className="setting-symbol" aria-hidden="true">✳</span><div><h3>A little room to breathe</h3><p>Raha is here to listen and offer a gentle moment of support, whenever you need one.</p></div></div>
          <div className="glass-setting-card setting-row"><div><h3>Start fresh</h3><p>Restore the original Raha preferences.</p></div><button type="button" className="reset-button" onClick={resetPreferences}>Reset</button></div>
          {notice && <p className="settings-notice" role="status">{notice}</p>}
          <div className="settings-footnote">Your display preferences are saved on this device.</div>
        </section>}

        {tab === "Voice" && <section className="settings-content" aria-label="Voice settings">
          <div className="settings-section-heading"><span>HOW RAHA SPEAKS</span><h2>A voice that feels comfortable.</h2></div>
          <div className="glass-setting-card setting-row"><div><h3>Spoken replies</h3><p>Let Raha read replies aloud.</p></div><button type="button" role="switch" aria-checked={voiceReplies} aria-label="Spoken replies" className={`ios-switch${voiceReplies ? " is-on" : ""}`} onClick={() => updateVoiceReplies(!voiceReplies)}><span /></button></div>
          <label className="glass-setting-card setting-select"><span><strong>Conversation language</strong><small>Used for listening and Raha&apos;s replies</small></span><select value={language} onChange={(event) => updateLanguage(event.target.value)}><option value="en-GB">English (UK)</option><option value="en-US">English (US)</option><option value="ar-SA">Arabic</option><option value="fr-FR">French</option></select></label>
        </section>}

        {tab === "Appearance" && <section className="settings-content" aria-label="Appearance settings">
          <div className="settings-section-heading"><span>YOUR ENVIRONMENT</span><h2>Keep things gentle.</h2></div>
          <div className="glass-setting-card setting-row"><div><h3>Orb movement</h3><p>Keep the glass orb softly animated.</p></div><button type="button" role="switch" aria-checked={orbMotion} aria-label="Orb movement" className={`ios-switch${orbMotion ? " is-on" : ""}`} onClick={() => updateOrbMotion(!orbMotion)}><span /></button></div>
          <div className="appearance-preview"><span className="preview-orb" aria-hidden="true" /><span>Soft color · Quiet motion · Open space</span></div>
          <div className="settings-footnote">Your device&apos;s reduced motion preference is always respected.</div>
        </section>}

        {tab === "Account" && <section className="settings-content" aria-label="Account settings">
          <div className="settings-section-heading"><span>YOUR ACCOUNT</span><h2>Account details.</h2></div>
          <div className="glass-setting-card account-email"><span><strong>Email</strong><small>{email}</small></span></div>
          <form action={updateDisplayNameAction} className="glass-setting-card account-name-form"><label htmlFor="display_name"><strong>Display name</strong><small>Optional · up to 80 characters</small><input id="display_name" name="display_name" defaultValue={displayName} maxLength={80} /></label><button type="submit" className="reset-button">Save</button></form>
          {error === "name" && <p className="auth-error" role="alert">Name must be 80 characters or fewer.</p>}
          {error === "save" && <p className="auth-error" role="alert">Couldn&apos;t save your name. Please try again.</p>}
          {saved && <p className="settings-notice" role="status">Your display name was saved.</p>}
          <form action={signOutAction} className="glass-setting-card setting-row"><div><h3>Sign out</h3><p>End this session on this device.</p></div><button type="submit" className="reset-button">Log out</button></form>
          <p className="account-privacy">Chats are stored in your Supabase account database and sent to OpenRouter to generate replies. OpenRouter&apos;s data handling and retention depend on your provider settings. Raha does not currently provide a self-service account deletion flow.</p>
        </section>}
      </section>
    </main>
  );
}
