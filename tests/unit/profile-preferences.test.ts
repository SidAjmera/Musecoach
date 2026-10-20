import { afterEach, expect, it, vi } from "vitest";
import { readProfile } from "../../lib/storage";
import { defaultProfile } from "../../lib/types";

afterEach(() => vi.unstubAllGlobals());
it("opens an older saved profile without losing its preferences", () => {
  const old = { ...defaultProfile, name: "Legacy singer" } as Record<
    string,
    unknown
  >;
  delete old.favoriteExercises;
  vi.stubGlobal("localStorage", { getItem: () => JSON.stringify(old) });
  expect(readProfile()?.name).toBe("Legacy singer");
  expect(readProfile()?.favoriteExercises).toEqual([]);
});
it("removes invalid and duplicate favourite IDs from stored preferences", () => {
  vi.stubGlobal("localStorage", {
    getItem: () =>
      JSON.stringify({
        ...defaultProfile,
        favoriteExercises: ["hold", "invalid", "hold", null, "scale"],
      }),
  });
  expect(readProfile()?.favoriteExercises).toEqual(["hold", "scale"]);
});
