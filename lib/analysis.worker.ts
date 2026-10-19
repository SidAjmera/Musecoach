import { analyzeSamples } from "./analysis";
self.onmessage = (event: MessageEvent) => {
  try {
    const { samples, sampleRate, exercise } = event.data;
    self.postMessage({ result: analyzeSamples(samples, sampleRate, exercise) });
  } catch {
    self.postMessage({
      error:
        "Analysis could not finish. Try a shorter recording or another format.",
    });
  }
};
