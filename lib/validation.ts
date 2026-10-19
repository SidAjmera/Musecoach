export const MAX_BYTES = 25 * 1024 * 1024;
export function validateUpload(
  file: Pick<File, "name" | "size" | "type">,
): string | null {
  if (file.size > MAX_BYTES)
    return "This file is over 25 MB. Export a shorter or smaller recording and try again.";
  if (file.size === 0)
    return "This file is empty. Choose a recording with audio.";
  if (!/\.(wav|mp3|m4a|ogg|webm)$/i.test(file.name))
    return "Choose a WAV, MP3, M4A, OGG, or WebM file. Your browser must support its codec.";
  return null;
}
export function validateDuration(seconds: number): string | null {
  if (!Number.isFinite(seconds) || seconds < 15)
    return "Sing for at least 15 seconds, then try again.";
  if (seconds > 60.15)
    return "Use a recording between 15 and 60 seconds. Trim your file and upload it again.";
  return null;
}
export function microphoneError(error: unknown): string {
  const name = (error as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Microphone access was denied. Allow microphone access in your browser’s site settings, then retry, or upload an audio file.";
  if (name === "NotFoundError")
    return "No microphone was found. Connect a microphone and retry, or upload an audio file.";
  if (name === "NotReadableError")
    return "Your microphone is busy. Close other recording apps and retry.";
  return "We couldn’t open the microphone. Use HTTPS or localhost, check your device settings, or upload a recording.";
}
