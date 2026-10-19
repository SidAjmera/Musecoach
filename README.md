# Musecoach

**Live website:** [musecoach.vercel.app](https://musecoach.vercel.app/) — open this link on desktop or mobile.

A singing practice website for desktop and mobile, built with Next.js, TypeScript, React, Tailwind CSS, Web Audio, MediaRecorder, and IndexedDB. Open the hosted HTTPS link on any supported device; visitors do not need to run a server. Recording, measurements, exercises, and history work without an AI key. Recordings and history stay in each visitor’s browser; optional AI conversations use their own provider key.

## Free online hosting

The app is configured for Vercel’s **Hobby** plan, a free plan for personal, non-commercial projects. Use its included HTTPS subdomain; no paid domain, shared AI key, paid database, or storage add-on is needed. Hosting usage limits apply: service can pause at the free limit rather than incur overage charges. Do not choose a Pro trial, paid upgrade, or paid integration. See the [Hobby plan terms and limits](https://vercel.com/docs/plans/hobby).

Import this GitHub repository into a Hobby project, using the repository root and the detected Next.js framework. `vercel.json` enables Corepack for the pinned pnpm version and uses the existing production build. Node.js is pinned to 24.x. The AI route runs as a Node.js function with a 45-second ceiling, allowing for the provider’s 30-second request timeout. No AI environment variables are required for the four built-in providers. Once linked to GitHub, pushes to the production branch can deploy automatically.

Share the production HTTPS URL with visitors. Mobile microphone access uses the browser permission prompt; opening the site in Safari or Chrome is preferable to an embedded social-media browser. Practice records are private to that browser/device and do not sync between phones or computers. Online hosting and on-device audio processing work together; this app does not need a cloud recording database.

## Run locally

Use Node.js 22.13+ (Node 24 was used here) and pnpm 11.25.0. From this directory:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open [Musecoach](http://127.0.0.1:3000) for development. The development server binds to loopback only. For phones and shared access, use the deployed HTTPS URL. Microphone access needs localhost or HTTPS.

```sh
pnpm test          # Signal, scoring, lifecycle, validation, comparison, voice, AI tests
pnpm typecheck
pnpm build
pnpm start        # Serve the production build
pnpm test:e2e     # Production build must exist; starts a server when needed
```

The build uses webpack for compatibility with this Windows environment. The test configuration uses locally installed Chrome; install Chrome or change `channel` in `playwright.config.ts` to a Playwright-managed browser. Tests use generated PCM WAV fixtures and Chrome's fake microphone flags. They never request a physical microphone. Browser traces and failure details go to `test-results/`; visual snapshots go to `artifacts/`.

Set `PLAYWRIGHT_BASE_URL=https://musecoach.vercel.app` when running browser checks against the hosted site. This skips starting a local server and uses the public HTTPS origin. The browser checks use disposable profiles, generated audio fixtures, and mocked provider replies; no real API keys are needed.

## What works

- Three-step editable onboarding with experience, genres, goals, comfortable range, and ten fictional coaches. Every coach has male/female presentation presets and independent custom appearance, pronouns, device speaking voice, and synthesised demonstration register.
- Home, Record & Review, My Coach, Practice, Progress, and reloadable local session detail URLs. Desktop sidebar, mobile bottom navigation, light/dark modes, keyboard focus, semantic dialogs, reduced-motion support, accessible graph summaries.
- Explicit microphone start, live RMS input meter, timer, stop/discard/retry, automatic 60-second stop, and an 18-second automatic stop for guided exercises. Tracks, analysis workers, reference tones, playback URLs, and AudioContexts are released on the relevant lifecycle boundaries. Microphone input is never connected to an output destination.
- Upload WAV, MP3, M4A, OGG, or WebM up to 25 MiB. Actual decoding is browser-dependent; duration must be 15–60 seconds (150 ms codec-padding tolerance). Empty, malformed, oversized, too-short, and too-long files produce recovery instructions. Playback happens before explicit analysis submission.
- Genuine local pitch measurements in a Web Worker, explained scores, confidence gaps, raw metrics, timestamped observations, a pitch timeline, recording-quality cautions, and measured exercise recommendations.
- Match a note, hold a note, and follow an original six-note melody. Targets stay within the user's practice window. Reference playback is labelled as synthesised tones. Capture uses a three-beat count-in, visual target prompts, and quiet gaps. The reference is played separately from the singing capture.
- Guided range exploration, with an explicit choice to adopt the detected window as provisional. It is never a voice classification.
- Local profile and conversations in localStorage. Structured sessions and explicitly opted-in audio Blobs in IndexedDB. Reload, history filters, individual audio/session deletion, and clearing all data work. No invented progress or achievements. Goals are marked complete by the user.
- Comparisons and metric trends only for identical exercise references and analysis versions. Free-singing attempts with potentially different songs are not directly ranked.

## Analysis and score definitions

`lib/analysis.ts` implements the difference function, cumulative mean normalised difference, threshold selection, and parabolic lag refinement from the [YIN pitch-detection approach (de Cheveigné & Kawahara, 2002)](https://pubmed.ncbi.nlm.nih.gov/12002874/). Audio is mixed to mono and resampled to 12 kHz, analysed in 1,024-sample frames at a 50 ms hop. The implementation searches approximately 65–1000 Hz, rejects RMS below 0.008, and accepts a YIN periodicity confidence of at least 0.85. This is a monophonic estimator, not a neural singing classifier. An instrument or periodic noise can look pitched; accompaniment, room noise, octave errors, and voice effects reduce reliability.

**Raw measurements:** confident pitched duration/coverage, the 5th–95th percentile detected pitch window, fraction of samples at or above absolute amplitude 0.995, and the 10th–90th percentile RMS loudness spread in dB. Loudness is not calibrated SPL and depends on input gain. Unvoiced audio is not automatically classified as background noise.

**Free singing:** a practice indicator is available only with at least 1.5 seconds of confident pitch, at least 10% coverage, and at least three usable near-steady windows. Each near-steady window spans 12 frames (0.6 seconds), needs at least 11 pitched frames, and a 10th–90th percentile pitch spread no greater than 180 cents. The indicator is `clamp(100 − median window pitch MAD in cents, 0, 100)`. Windows overlap by 0.3 seconds. This heuristic measures steadiness in eligible portions; it is not clinically or population calibrated. No known melody is assumed. Vibrato and slides can be intentional, and the app explains this.

**Guided exercises:** target interiors exclude the first 150 ms and last 100 ms. Pitch accuracy is the percentage of confidently detected interior frames within ±50 cents of the defined target. At least 30% target coverage and 20 usable frames are required. Missing audio is separately displayed as coverage rather than silently scored zero. A single global latency is estimated from the median of nearby voiced onset offsets (within ±0.6 seconds, requiring at least two matches). Match/hold exercises use pitch accuracy as the overall score and expose steadiness separately. Melody exercises use 80% pitch accuracy and 20% onset timing, where timing is `clamp(100 − median adjusted onset error in ms / 5, 0, 100)`. Timing needs at least four nearby detected onsets; otherwise it is explicitly unavailable and only pitch is scored. This simple onset method is best for separated notes and does not reliably evaluate legato rhythm. It is not a general rhythm or transcription system.

Scores are deterministic for the same decoded samples and context, independent of coach. Missing metrics are omitted. Sparse, silent, or insufficiently confident recordings remain in history with an unscored result and recovery advice. No claims are made about breath technique, vocal health, vocal type, lyric accuracy, tone quality, or emotional intent.

## Bring your own API key

Each visitor opens **My Coach → Bring your own API key**, selects Gemini, OpenAI, Anthropic, or Grok, enters their own API key, and clicks **Save AI connection**. A model ID can override the provider default. Saving is local and makes no provider request; credentials and model access are checked only when the user explicitly sends a message. The user's provider account handles API usage and billing; free-tier limits and model access depend on that account. Chat subscriptions do not necessarily include API credits.

No deployment API key is required. The public chat route requires a visitor credential on every request and **never falls back to an operator key**, even if an old AI_API_KEY or OPENAI_API_KEY is present in the hosting environment. Do not add your own key to public client environment variables. Existing server-key setup has been replaced by this per-user flow; private .env.local files are not edited automatically.

Keys stay in tab memory by default: navigating within the app preserves the connection, while a full reload or closing the tab removes it. **Remember my key on this device** is off by default. Opting in stores the connection, including its key, unencrypted in localStorage for this site's browser profile. It is not an encrypted vault: same-origin scripts, browser extensions with access, and people using that browser profile may be able to read it. Do not enable it on shared devices. Profiles, recording records, and conversation history never contain the connection key. **Forget API key** disconnects it, cancels an in-flight request, and removes the remembered connection; **Delete all local data** also forgets it. Forgetting does not revoke a provider key or undo an already submitted provider request. Revocation must be done in the provider account.

Requests flow from the browser over HTTPS to this app's Next.js server route, then to the selected provider. The app does not persist keys on the server, log request bodies, or put keys in URLs, prompts, or responses. The hosting operator and infrastructure can technically access incoming request bodies: this is a relay, not end-to-end secrecy from the host. Configure your hosting, reverse proxy, error monitoring, and request tracing to redact or omit chat request bodies and authentication headers. Responses use no-store caching. Provider SDK code and endpoint adapters stay on the server.

Only **Send message** shares the key for authentication, the typed question, explicit profile preferences, up to five measured session summaries, and up to twelve conversation messages. **Audio is never sent.** Provider retention and data-use policies apply to submitted text. Responses may be mistaken; measured scores remain independent of AI text. There is a 30-second provider timeout, validated JSON replies, and recovery messages for rejected credentials, quota limits, and provider failures. No live provider calls were used for verification.

### Other providers

For an additional compatible service, the hosting operator can pin one trusted endpoint using .env.local or hosting environment settings:

```env
AI_PROVIDER=openai-compatible
AI_BASE_URL=https://your-provider.example/v1
```

Visitors then see **Compatible provider** in the selector and supply their own key and model ID. The server appends /chat/completions and requires JSON-object mode. Set AI_PROVIDER=custom for the existing custom-adapter protocol: AI_BASE_URL is the full adapter endpoint, receives {system, personality, profile, sessions, messages, message} with a Bearer credential, and returns {"reply":"..."} of 1–1800 characters. Visitors cannot supply arbitrary URLs. Only the operator can configure this additional destination; choose an endpoint trusted to receive visitors' credentials and text. Built-in providers always use fixed official endpoints, independent of this setting. Redirects are rejected. HTTPS is required for remote endpoints; localhost HTTP exists for local development only. Unrelated API protocols or cloud IAM authentication require a separate adapter.

### Hosting

Deploy to a host that runs Next.js server routes; a static-file-only host cannot run the chat relay. Serve the site over HTTPS for keys and microphone access. Set the server to the host's expected interface and port, for instance with node node_modules/next/dist/bin/next start --hostname 0.0.0.0 --port PORT using the host's assigned port value. Do not publish .env.local. No shared AI credential is needed. Add deployment-level request limits and abuse controls for the relay's bandwidth and compute. Users pay their own provider usage; hosting costs remain yours. Profiles, recordings, and history remain browser-local with no account or cross-device sync.

Browser read-aloud uses available OS/browser speech voices; device behaviour varies. Presentation presets use recognised voice names on a best-effort basis with a device-default fallback and a voice chooser. No voice cloning is used.

## Code map

Per-user connection controls and storage live in `components/AIConnectionSettings.tsx` and `lib/ai-settings.ts`.

| Area                                 | Files                                                                                           |
| ------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Recording, decoding, tone generation | `lib/audio.ts`, `components/Recorder.tsx`                                                       |
| Pure pitch and scoring logic         | `lib/analysis.ts`, `lib/analysis.worker.ts`                                                     |
| Exercise definitions / comparability | `lib/exercises.ts`, `lib/comparison.ts`                                                         |
| IndexedDB and profile persistence    | `lib/storage.ts`                                                                                |
| Coach presentation and speech        | `lib/coaches.ts`, `lib/speech.ts`, `components/Avatar.tsx`                                      |
| Optional server-only AI              | `lib/ai-providers.ts`, `lib/coach-server.ts`, `lib/byok-server.ts`, `app/api/coach/route.ts`    |
| UI and navigation                    | `components/Musecoach.tsx`, `Review.tsx`, `Coach.tsx`, `ProfileEditor.tsx`, `ProgressTrend.tsx` |
| Validation and test fixtures         | `lib/validation.ts`, `tests/unit`, `tests/e2e`                                                  |

## Verification and remaining device checks

See `TESTING.md` for the final executed checks. Automated coverage includes synthetic pitch/harmonics, silence/noise, sparse signals, clipping warnings, correct/wrong exercise notes, latency and inconsistent onsets, upload limits, denied permissions, track cleanup including a late permission resolution, auto-stop, local persistence/reload/deletion, coach switching, AI failure/validation, and desktop/mobile flows. Accessibility scans cover the main screens.

Still check manually on real devices: physical microphone permission prompts and revocation; Safari/iOS and Android codec recording/decoding; OS recording indicators after stop/navigation; actual input gain and clipping recovery; Bluetooth/headphone latency and count-in bleed; interruption by calls/backgrounding; speaker reference tones and browser speech voices. Mobile automated tests use Chromium device emulation, not Safari hardware. A live AI provider response is not verified without credentials. Solo voice accuracy and the scoring heuristics would benefit from a consented, labelled human-voice validation corpus before stronger claims.

Local storage can be cleared or evicted by the browser; it is not a backup or multi-device sync service.
