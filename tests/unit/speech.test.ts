import { describe, it, expect } from "vitest";
import { selectSpeechVoice } from "../../lib/speech";
const male = {
  name: "Microsoft David",
  voiceURI: "david",
} as SpeechSynthesisVoice;
const female = {
  name: "Microsoft Zira",
  voiceURI: "zira",
} as SpeechSynthesisVoice;
describe("device voice selection", () => {
  it("uses distinct available preset voices", () => {
    expect(
      selectSpeechVoice({ version: "male", voice: "" }, [female, male]),
    ).toBe(male);
    expect(
      selectSpeechVoice({ version: "female", voice: "" }, [female, male]),
    ).toBe(female);
  });
  it("respects an independent custom choice", () => {
    expect(
      selectSpeechVoice({ version: "custom", voice: "david" }, [male, female]),
    ).toBe(male);
  });
  it("gracefully uses the device default when no suitable voice exists", () => {
    expect(selectSpeechVoice({ version: "male", voice: "" }, [])).toBeNull();
    expect(
      selectSpeechVoice({ version: "custom", voice: "" }, [male]),
    ).toBeNull();
  });
});
