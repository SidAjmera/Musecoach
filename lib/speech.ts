import { Profile } from "./types";

/** Device-provided names only offer a best-effort presentation preset, not a voice guarantee. */
export function selectSpeechVoice(
  profile: Pick<Profile, "voice" | "version">,
  voices: SpeechSynthesisVoice[],
) {
  const explicit = voices.find((v) => v.voiceURI === profile.voice);
  if (explicit) return explicit;
  if (profile.version === "custom") return null;
  const names =
    profile.version === "male"
      ? /\b(David|Mark|Guy|Daniel|George|Alex|James|Ryan|Christopher)\b/i
      : /\b(Zira|Aria|Jenny|Samantha|Victoria|Susan|Hazel|Sonia|Emma)\b/i;
  return voices.find((v) => names.test(v.name)) || null;
}
