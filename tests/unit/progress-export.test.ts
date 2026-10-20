import { expect, it } from "vitest";
import { progressCSV } from "../../lib/progress-export";
import { analyzeSamples } from "../../lib/analysis";
import { Session } from "../../lib/types";

const base: Session = {
  id: "fixture",
  date: "2026-10-20T10:00:00Z",
  title: "My take",
  context: "free",
  audioSaved: false,
  analysis: analyzeSamples(new Float32Array(12000 * 16), 12000),
};
it("exports missing measurements as empty cells without inventing zero scores", () => {
  const csv = progressCSV([base]);
  expect(csv).toContain('"practice_score_out_of_100"');
  expect(csv).toContain(',16,"",0,');
  expect(csv.startsWith("\uFEFF")).toBe(true);
});
it("escapes spreadsheet formulas, quotes and multiline session titles", () => {
  for (const title of [
    '=HYPERLINK("https://example.invalid")',
    "\t+SUM(1,2)",
    "-command",
    "@formula",
  ]) {
    expect(progressCSV([{ ...base, title }])).toContain(
      "\"'" + title.replaceAll('"', '""') + '"',
    );
  }
  expect(progressCSV([{ ...base, title: 'A, "small"\ntake' }])).toContain(
    '"A, ""small""\ntake"',
  );
});
it("exports only selected progress fields and keeps dates chronological", () => {
  const extra = {
    ...base,
    key: "secret-fixture",
    audio: "private-audio-fixture",
    conversation: "private-chat-fixture",
  };
  const csv = progressCSV([
    extra,
    { ...base, id: "older", date: "2026-10-19T10:00:00Z", title: "Older" },
  ]);
  expect(csv).not.toMatch(
    /secret-fixture|private-audio-fixture|private-chat-fixture/,
  );
  expect(csv.indexOf('"Older"')).toBeLessThan(csv.indexOf('"My take"'));
});
