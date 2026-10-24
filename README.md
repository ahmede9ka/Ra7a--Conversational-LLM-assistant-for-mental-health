# Raha — Mental Wellness Circle

## Deploy to Vercel

This is a standard Next.js app and Vercel can detect its build settings automatically.

1. Push the project to a Git repository you control, then import that repository at [vercel.com/new](https://vercel.com/new).
2. In Vercel settings, add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, server-only `SUPABASE_SECRET_KEY`, and `NEXT_PUBLIC_SITE_URL`. For Vercel, set `LLM_PROVIDER=openrouter` and add `OPENROUTER_API_KEY`; `OPENROUTER_MODEL` is optional and defaults to `openrouter/free`. Vercel cannot reach Ollama on your development computer at `127.0.0.1`; production Ollama requires a reachable, secured server.
3. Enable the variables for Production and Preview, then deploy. Set `NEXT_PUBLIC_SITE_URL` to your production URL for Production. Add the same variables to Development only if you want Vercel's local development command to use them.

Keep provider and Supabase secret keys in Vercel's environment variable settings. Do not add `.env.local` or a real key to the Git repository. The included `.env.example` contains placeholders only. After changing an environment variable, redeploy so the new deployment receives it.

For local development, copy `.env.example` to `.env.local`, add your key, and run `npm run dev`.

## Inference providers

Both providers use a shared server-only interface in `src/lib/llm`. `LLM_PROVIDER` (default `ollama`) sets the deployment default; signed-in users can save an `ollama` or `openrouter` choice in Settings. The allowlisted choice is stored in their Supabase Auth user metadata, so it needs no extra database migration. It only selects an adapter and cannot set a model name or endpoint. Provider failures never silently fall back to another provider.

### Ollama (local development)

Install/start Ollama and download/run the configured model:

```powershell
ollama pull qwen3:8b
ollama run qwen3:8b
```

Set `LLM_PROVIDER=ollama`, `OLLAMA_BASE_URL=http://127.0.0.1:11434`, `OLLAMA_MODEL=qwen3:8b`, and `OLLAMA_TIMEOUT_MS=60000`. Next.js calls Ollama's non-streaming `/api/chat` endpoint from the server. The endpoint and model are server environment configuration only. In a container, `127.0.0.1` refers to that container; configure the private network address that reaches Ollama. Never expose an unauthenticated Ollama port to the public internet.

Speed depends on model size, quantization, RAM/VRAM, context length, and hardware. Inspect loaded models with `ollama ps`; `nvidia-smi` can show NVIDIA GPU use on Windows if its driver tools are installed. GPU usage and latency are not assumed.

### OpenRouter (cloud inference)

Set `LLM_PROVIDER=openrouter`, `OPENROUTER_API_KEY`, and optionally `OPENROUTER_MODEL` (default `openrouter/free`) and `OPENROUTER_TIMEOUT_MS`. Requests leave the app server and are processed according to OpenRouter's current model routing, provider terms, account settings, and retention policies. Free model availability and limits may change. The API key stays on the server.

## Supabase accounts and saved conversations

The application uses Supabase Auth with cookie-based sessions. Each account can read and change only its own profile, conversations, and messages through PostgreSQL row-level security (RLS). The migration also limits message writes and uses a server-only operation to persist an AI reply after the server has verified the matching user turn. See the [Supabase SSR guide](https://supabase.com/docs/guides/auth/server-side/creating-a-client?environment=client-component) and [RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security) for the underlying platform behavior.

### Configure a Supabase project

1. Create a Supabase project and copy its project URL, publishable/anon key, and service-role key from the project API settings.
2. In **Authentication → URL Configuration**, set the production site URL to your deployed Raha URL. Add `http://localhost:3000/auth/callback` and your deployed URL plus `/auth/callback` to the allowed redirect URLs. For Vercel preview deployments, add the preview callback URLs you intend to use.
3. In **Authentication → Providers → Email**, choose whether email confirmation is enabled and configure SMTP if you need dependable production email delivery. With confirmation enabled, new users must follow the email link before they can sign in.
4. Add these environment variables to `.env.local` for local development and to Vercel for each deployment environment:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
   SUPABASE_SECRET_KEY=YOUR_SECRET_KEY
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   OPENROUTER_API_KEY=YOUR_OPENROUTER_KEY
   OPENROUTER_MODEL=openrouter/free
   LLM_PROVIDER=ollama
   OLLAMA_BASE_URL=http://127.0.0.1:11434
   OLLAMA_MODEL=qwen3:8b
   OLLAMA_TIMEOUT_MS=60000
   OPENROUTER_TIMEOUT_MS=25000
   ```

   In Vercel, set `NEXT_PUBLIC_SITE_URL` to the public production URL, without a trailing slash. Never add `SUPABASE_SECRET_KEY` to a `NEXT_PUBLIC_` variable or expose it in browser code. Supabase secret keys bypass RLS; this app uses one only in a server-only module for the narrowly scoped assistant-reply RPC. The app also accepts the legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` names during migration.

5. Apply the database migrations to the linked project:

   ```powershell
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```

   Review migrations before applying to a project with existing data.
6. Redeploy after setting Vercel environment variables. Sign up and verify email delivery, callback handling, sign-in/out, conversation creation, and chat persistence in the deployed environment.

### Local development and checks

Use Node.js 22 or newer. Install dependencies with `npm install`, configure `.env.local`, then run `npm run dev`. Useful checks are `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.

The database isolation tests use Supabase CLI and a running local Docker environment. Start Supabase with `npx supabase start`, then run `npm run test:db`. The tests are in `supabase/tests/rls.test.sql`; the platform's pgTAP workflow is described in the [Supabase database testing guide](https://supabase.com/docs/guides/local-development/testing/pgtap-extended).

### Data handling and current limits

- Text and voice-transcribed messages are saved to the user's Supabase account. Voice capture uses the browser's speech recognition; browser support and its processing behavior vary.
- For ordinary replies, the server sends the current message and bounded recent history to the selected provider. OpenRouter processes requests as a cloud service; Ollama runs wherever the configured server runs, which may be remote. A detected self-harm response is generated locally and does not call either provider. Do not promise that provider-side processing is zero-retention.
- API logs avoid message contents. Supabase, OpenRouter, and hosting providers may maintain their own operational logs under their respective settings and policies.
- The app offers sign-out and profile-name editing, but does not yet offer password reset, account deletion, data export, conversation search, or a consent/retention control. Deleting a conversation removes its messages through the database cascade. Account removal currently requires an administrator to delete the Auth user; the database foreign keys then cascade owned records.
- This is a supportive conversational interface, not a clinical service. The crisis response encourages contacting local emergency help or a trusted person; it does not identify local crisis numbers automatically.

Ra7a uses a lightweight server-side response policy to adapt to requests to vent, practical questions, sadness, frustration, or overwhelm. These are communication strategies, not diagnoses or stored psychological profiles. The qualitative test set and scoring rubric are in `docs/emotional-quality-evaluation.json`. No provider quality comparison is claimed until the same cases are run against both providers.

Raha is a Next.js voice and text companion. Its animated Three.js orb is a visual status indicator for the app's listening, response-generation, and speech-synthesis lifecycle. The orb is an interface treatment, not a clinical tool.

## Talk, Reflect, Reset, and My Progress

The signed-in navigation now includes four areas:

- **Talk** keeps the existing text chat, speech input/output, conversation history, safety handling, and user-selected Ollama/OpenRouter provider.
- **Reflect** offers a five-point user-entered mood check-in, optional emotions/context/stress/note, deliberate speech-to-text journal fields with transcript review, and a six-step thought journal. The thought journal works without an LLM. Drafts are stored only when the user selects **Save and leave**; completed entries only when they select **Finish reflection**. Individual records can be deleted.
- **Reset** includes a timer-based comfortable breathing guide with a user-selected pace and duration, pause/resume/stop, reduced-motion support, and an optional five-senses grounding guide. No ambient audio is played. Grounding notes stay in the page and are not stored. A session summary is saved when a user finishes or stops an active breathing session; grounding sessions are saved only when finished. Feedback is optional.
- **My Progress** shows actual saved mood entries over 7 or 30 days, an observed mood distribution, recent check-ins, user-recorded context comparisons, planned/completed/skipped activities, reflection/session history, and an optional weekly reflection. Activity status can be changed, rescheduled, or deleted. Optional before/after mood ratings are user-entered.

Weekly reflections are created locally and only after the user selects the record categories to include. They use counts of mood check-ins and/or completed activities from the current week. They do not include journal text, conversation text, diagnoses, or an LLM. Users can edit or dismiss a draft and delete a saved reflection. Context comparisons require at least two check-ins for a selected context and describe co-occurrence only; they do not claim causation.

### Wellbeing data and migrations

The versioned migration `supabase/migrations/20261024000200_wellbeing_records.sql` adds `public.wellbeing_records`. It stores typed-by-server JSON records for mood, thought reflections, activities, exercise sessions, and weekly reflections. The authenticated server derives the owner ID; clients cannot choose it. RLS policies restrict reads, writes, updates, and deletes to `auth.uid()`. The API validates each record shape and length before writing it, and row-specific actions additionally filter by the authenticated owner. Deleting an Auth user cascades these records.

Apply the migration to a linked Supabase project with:

```powershell
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Review the SQL and your target project before pushing. This repository change does not itself apply the migration to your remote Supabase project. The features will show a save/load error until the migration is applied.

### Curated exercise content and limitations

The reviewed, versioned exercise definitions live in `src/lib/wellbeing/content.ts`. They include purpose, duration, steps, suitable contexts, source, evidence note, limitation, version, review date, and review status. The two initial Reset guides are adapted conservatively from the [NHS breathing exercise for stress](https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/breathing-exercises-for-stress/) and the [Royal United Hospitals Bath grounding leaflet](https://www.ruh.nhs.uk/patients/patient_information/PAE129_Mindfulness_and_grounding_exercises.pdf). The thought-journal prompts are informed by the [NHS thought-record guide](https://www.nhs.uk/every-mind-matters/mental-wellbeing-tips/self-help-cbt-techniques/thought-record/), while remaining optional and non-clinical. These references inform the content; they do not validate Ra7a or establish a treatment effect. The design follows the cautious, user-tailored approach described in [NICE guidance on digital behaviour-change interventions](https://www.nice.org.uk/guidance/ng183/chapter/recommendations).

New material should remain marked `professional-review-needed` until it has been checked by an appropriately qualified reviewer. Do not add clinical claims or unverified citations. Ra7a is a general wellbeing and reflection tool, not therapy or a clinically validated treatment. Breathing and grounding can feel uncomfortable for some people; users are told to stop, skip, or breathe normally.

The feature suite requires the new Supabase migration and a signed-in account. It adds no environment variables and does not change the selected LLM provider. New deterministic features work without Ollama or OpenRouter. Speech transcription uses browser speech recognition when available; browser support and audio processing vary, and raw audio is not stored by this feature. Individual mood, activity, journal, weekly reflection, and exercise records can be deleted in the app. Account-wide export and deletion remain unavailable.

## Research-Informed Design of the AI Orb

### Design objectives

The orb is designed to communicate calmness, approachability, attentiveness, clear system status, and predictable, accessible motion. These are design objectives; this interface has not been evaluated as a clinical intervention and no clinical outcome is claimed.

### Research foundations

1. **Jonauskaite, D., & Mohr, C. (2025). “Do we feel colours? A systematic review of 128 years of psychological research linking colours and emotions.” _Psychonomic Bulletin & Review, 32_, 1457–1486.** [Article and DOI](https://doi.org/10.3758/s13423-024-02615-z) · [Open full text](https://pmc.ncbi.nlm.nih.gov/articles/PMC12325498/). The review synthesized 132 peer-reviewed English-language studies (1895–2022), covering 42,266 participants in 64 countries. It reports systematic but often many-to-many colour–emotion associations, with differences linked to hue, lightness, saturation, and context. The authors distinguish reported associations from effects on emotions people actually experience. This supports treating the palette as a cautious visual design choice, not as a way to cause calm or treat distress.

2. **Palmer, S. E., & Schloss, K. B. (2010). “An ecological valence theory of human color preference.” _Proceedings of the National Academy of Sciences, 107_(19), 8877–8882.** [Article and DOI](https://doi.org/10.1073/pnas.0906172107) · [Open full text](https://palmerlab.berkeley.edu/pdf/Palmer%26Schloss%282010%29.pdf). The paper proposes and tests that average colour preferences relate to affective responses to objects associated with those colours. Its preference data were from a particular sample and do not establish that every person prefers the same palette. This motivates configurable colour values and evaluation with the application's intended users.

3. **Nass, C., Steuer, J., & Tauber, E. R. (1994). “Computers are social actors.” _Proceedings of the SIGCHI Conference on Human Factors in Computing Systems (CHI ’94)_, 72–78.** [Full paper and DOI](https://doi.org/10.1145/191666.191703) · [Conference companion record](https://doi.org/10.1145/259963.260288). The five experiments reported that people apply social rules in interactions with computers, even when they do not believe the computer is human. The DOI in the supplied brief points to the separate companion record; the DOI above identifies the full conference paper. This motivates making interface feedback legible while avoiding a face, emotional inference, or claims that the assistant is a human or therapist.

4. **World Wide Web Consortium (W3C). (2024). _Web Content Accessibility Guidelines (WCAG) 2.2_, Success Criterion 2.3.3, Animation from Interactions (Level AAA).** [Understanding SC 2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) · [WCAG 2.2 Recommendation](https://www.w3.org/TR/WCAG22/). SC 2.3.3 says motion animation triggered by interaction can be disabled unless essential to functionality or information. The W3C guidance also distinguishes automatically moving content under SC 2.2.2. The implementation follows the reduced-motion preference, provides a pause control, and keeps state text available; this is not a claim of WCAG conformance.

### Evidence-to-implementation mapping

| Research source | Relevant finding or principle | Design decision | Implementation location |
| --- | --- | --- | --- |
| Jonauskaite & Mohr (2025) | Colour–emotion associations exist, but are varied and do not prove that a colour changes a person's experienced emotion. | Use soft blue/cyan with lavender as a restrained design hypothesis; make no therapeutic claims. | `src/components/AIOrb.tsx` (`AI_ORB_CONFIG.palette`) |
| Palmer & Schloss (2010) | Colour preference is related to affective associations with objects, so individual preference can differ. | Centralize palette values so they can be adjusted and compared in user evaluation. | `src/components/AIOrb.tsx` (`AI_ORB_CONFIG.palette`) |
| Nass, Steuer & Tauber (1994) | People can respond socially to computer cues without believing a computer is human. | Give each state consistent status feedback, expose a text label, and avoid emotional inference or human-like facial cues. | `src/app/page.tsx` (`orbState`, live status); `src/components/AIOrb.tsx` (`AIOrbState`, `aria-label`) |
| W3C WCAG 2.2 SC 2.3.3 | Users need a way to disable non-essential interaction-triggered motion; the guideline is Level AAA. | Respect `prefers-reduced-motion`, allow manual motion pause, and retain state text. | `src/components/AIOrb.tsx` (motion factor and media-query cleanup); `src/app/page.tsx` (motion toggle); `src/app/globals.css` (reduced transitions) |

### Color palette

The palette is a research-informed design hypothesis. The cited literature does not validate these exact colours for mental-health AI. They should be reviewed with intended users, including users from different cultural backgrounds and people who prefer less visual stimulation.

| Color | Value | Visual role | Rationale |
| --- | --- | --- | --- |
| Sky blue | `#A9D9FF` | Main sphere gradient | Soft, light blue as the dominant surface color. |
| Pale cyan | `#C7F4FF` | Flowing secondary highlight | Adds a cool, light contrast to the blue. |
| Soft lavender | `#C9B8FF` | Secondary internal gradient | A restrained accent that blends gradually with blue and cyan. |
| Cloud white | `#F4F6FF` | Specular highlight | Keeps the glass-like highlight soft against the pale colors. |
| Periwinkle | `#C7D4FF` | Fresnel rim light | Adds a subtle cool edge glow without a hard outline. |

Palette values are centralized in `AI_ORB_CONFIG.palette` in `src/components/AIOrb.tsx` and are used as shader uniforms.

### Animation and interaction states

The orb uses a React Three Fiber canvas, a custom vertex/fragment shader, and one sphere mesh. `useFrame` updates uniforms and transforms without React state updates per frame. React Three Fiber owns and disposes the renderer, geometry, and material on unmount. No audio amplitude is available, so the orb does not claim to react to a microphone waveform or speech loudness.

| State | Application signal | Orb behavior |
| --- | --- | --- |
| `idle` | Default, between interactions | Slow breathing and floating, with low flow intensity. |
| `listening` | Speech recognition is active | Slightly stronger internal deformation and illumination. |
| `thinking` | Chat request is in progress | Intermediate flow intensity while the server responds. |
| `speaking` | Browser speech synthesis starts | Gentle breathing while synthesized speech is playing; returns to idle on `end` or `error`. |

The state is also exposed by the orb's accessible label and the page's `aria-live="polite"` status text, so users do not have to infer system activity from movement or color alone. State changes use damped shader intensity (`2.8` damping coefficient). Speaking ends when the browser's speech synthesis event fires; this is lifecycle synchronization, not amplitude-based reactivity.

Current engineering parameters in `AI_ORB_CONFIG.animation` (`src/components/AIOrb.tsx`):

- Breathing periods: idle `6.0 s`, listening `5.8 s`, thinking `6.4 s`, speaking `5.2 s`.
- Scale oscillation: `0.012` amplitude, approximately `2.4%` peak-to-peak before the small state-intensity adjustment.
- Vertical float: `0.035` world units with a `12 s` period.
- Rotation: `0.045 rad/s` around the vertical axis.
- Vertex wave amplitudes: primary `0.018`, secondary `0.009` world-space multipliers.
- Shader flow speed: `0.22` time units per second; state intensity targets are idle `0.15`, listening `0.58`, thinking `0.42`, and speaking `0.76`.
- State interpolation damping coefficient: `2.8`.

The research supports clarity, caution about social cues, and user control; it does **not** prescribe these timings, amplitudes, or state frequencies. Those values are engineering starting points and remain open to usability testing. The animation uses elapsed time and a capped frame delta for consistent behavior across frame rates.

### Accessibility

- When `prefers-reduced-motion: reduce` is active, the animation runs at `8%` of its normal motion factor; the CSS halo transition is removed. A user can also switch **Orb motion: on/off** to stop the orb's continuous motion entirely.
- Turning motion off freezes mesh movement and shader flow. State text and the accessible state label remain available.
- State transitions are damped. The orb does not flash, use particles, or rapidly pulse. CSS entrance and halo transitions are shortened for reduced-motion users.
- WCAG 2.2 SC 2.3.3 is Level AAA and applies to motion animation triggered by interaction. Automatically starting movement may also need consideration under SC 2.2.2, depending on how the content is presented. The manual pause control and system preference are included as user controls, but the whole page has not received an accessibility audit; no conformance claim is made.
- Remaining limitations: the live state label is available to assistive technology, but the interface has not been evaluated with screen readers. WebGL availability, contrast in all display conditions, speech-recognition support, and browser speech-synthesis behavior vary by platform.

### Evaluation and future research

No usability study has been run for this orb. A practical comparison could randomly assign or let participants switch between:

- **A:** Slow breathing with blue and cyan.
- **B:** Slow breathing with blue and lavender.
- **C:** Fluid internal movement with the same blue/cyan palette as A.

Include a static or animation-off option. After each brief interaction, collect ratings of perceived calmness, trustworthiness, comfort, visual distraction, perceived responsiveness, and visual preference. Treat these as subjective usability measures, not clinical outcomes. Counterbalance presentation order and record palette/motion preference separately from perceived assistant quality. If recruiting people experiencing psychological distress, use an appropriate ethics review and consent process, avoid distress-inducing prompts, make stopping easy, and provide suitable support information.

### Limitations

- Colour associations and preferences vary between people and cultures; the cited studies do not establish a clinically optimal palette for mental-health AI.
- The selected colours are design hypotheses, not proven anxiety-reducing colours.
- Animation timings and amplitudes are initial engineering parameters, not clinical recommendations or experimentally optimized values.
- The cited research did not evaluate this orb, this application, or mental-health outcomes from animated interfaces.
- A reassuring visual design does not make the underlying AI safe, reliable, or therapeutically effective.
