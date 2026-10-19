# Verification

Verified locally on 19 October 2026, using Node 24.19.0, Next.js 16.4.2, React 19.3.1, Vitest 5.0.5, Playwright 1.64.1, and installed Chrome on Windows.

| Check            | Result                                                    |
| ---------------- | --------------------------------------------------------- |
| `pnpm test`      | 120 tests pass across 7 unit test files                   |
| `pnpm typecheck` | Pass                                                      |
| `pnpm build`     | Production build passes using webpack                     |
| `pnpm test:e2e`  | 20 tests pass (about 1.2 minutes): 10 desktop + 10 mobile |

The unit suite covers known 82–880 Hz synthetic pitches, harmonic content and DC offset, silence, quiet audio, deterministic broadband noise, insufficient usable audio, missing stability metrics, clipping cautions, pitch accuracy, wrong exercise notes, uniform latency, inconsistent timing, insufficient target coverage, target range limits, comparison eligibility, accepted upload types/size/duration, microphone error messages, denied permission, normal stop, abandonment, late permission resolution, construction failure, automatic stop, all ten coaches across three versions, device voice presets/fallbacks, missing/disabled AI configuration, provider failures, structured output validation, and incomplete responses. Provider calls are mocked.

The browser suite runs ten scenarios on desktop and mobile Chromium:

1. Complete onboarding; upload generated WAV; opt into local audio saving; review real worker measurements; reload and replay; complete and repeat the same guided exercise; compare measured attempts; select a metric trend; mark a goal complete; reload its state; delete just audio; delete a session; clear all local data.
2. Reject too-short and undecodable audio; submit silence and get an unscored review; verify missing AI configuration; switch coach and independently customise appearance/pronouns; reload preferences; toggle theme; navigate with the keyboard; verify history remains unchanged.
3. Deny a mocked microphone permission request and verify recovery through upload.
4. Start a browser-generated fake microphone; navigate away and assert every track ends; record a second 15-second take; stop and decode it; assert track cleanup; discard the audio.
5. Inspect/snapshot Home, Record, Coach, Practice, and Progress; audit WCAG A/AA rules with axe-core in both themes; check horizontal overflow; verify an adjusted melody target remains within range; check the compact tablet sidebar and reduced-motion behaviour.

6. Select each of Gemini, OpenAI, Anthropic, and Grok with a visitor-provided fixture key and mocked provider replies; verify the selected provider is named before submission; verify no conversation request is sent automatically; submit a question with profile context; display the reply; recover from quota exhaustion without discarding the question.

7. Check all ten coach defaults, male/female overrides, custom preferences across coach switching, and saved appearance after reload.
8. Verify homepage waveform, sample coach messages, pause/play controls, reduced-motion behaviour, and responsive panel bounds.
9. Add a visitor key without sending a request; verify memory-only defaults and navigation; send an explicitly submitted mocked request; opt into persistence and reload; check isolation from another browser profile; forget the key; delete all local data and verify key removal.
10. Exercise the real public route without a key, with a disallowed browser-supplied endpoint, and with a cross-origin request. Check no-store metadata and credential rejection without any upstream call.

No physical microphone or personal singing recording is used. Generated fixtures are deterministic mono PCM WAV files. Visual snapshots are in `artifacts/`. Test traces, fixtures, and diagnostics are in `test-results/`; subsequent runs replace them.

Automated accessibility scans do not prove complete accessibility. Screens were also visually inspected; graph summaries, focus indicators, native dialog keyboard behaviour, and labelled controls are implemented. Real microphone permissions, device input gain, Safari/iOS codec support, Bluetooth latency, interruptions/backgrounding, and actual device speech voices still need a human check. No live AI provider response was tested with a paid key.

The latest complete browser run passed all 20 tests against the production build, including BYOK, coach defaults, the animated homepage, and light/dark accessibility scenarios.

Provider-adapter update: all four native request/response formats, authentication headers, model defaults and overrides, aliases, generic-key configuration, OpenAI-compatible endpoints, custom adapters, unsafe/invalid endpoint rejection, public status redaction, missing configuration, quotas, authentication failures, timeouts, malformed/truncated/blocked responses, and Gemini thought filtering are covered by mocked unit tests. Live third-party API calls require the user’s own credentials and have not been performed.

BYOK unit checks cover rejection of missing visitor credentials despite an operator key, each native provider's visitor authentication headers, concurrent visitor isolation, omission of keys from prompts, input validation, operator-pinned compatible endpoints, safe authentication errors, opt-in key persistence, removal when switching back to memory-only, and forgetting keys even when browser storage removal fails. Credentials in tests are fixtures; no live provider requests or paid API usage occurred.
