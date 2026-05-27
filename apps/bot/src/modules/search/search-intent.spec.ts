import { normalizeSearchIntent } from "./search-intent";

describe("normalizeSearchIntent", () => {
  it("normalizes known intent payloads", () => {
    expect(
      normalizeSearchIntent({
        type: "worker",
        category: "Plumber",
        keywords: ["Leak", "", 1, "Tap"],
      }),
    ).toEqual({
      type: "worker",
      category: "plumber",
      keywords: ["leak", "tap"],
    });
  });

  it("falls back to unknown for malformed payloads", () => {
    expect(normalizeSearchIntent(null)).toEqual({
      type: "unknown",
      keywords: [],
    });
    expect(normalizeSearchIntent({ type: "bad" })).toEqual({
      type: "unknown",
      category: undefined,
      keywords: [],
    });
  });
});
