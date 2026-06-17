import { describe, expect, it } from "vitest";
import { getQualityGuidance, searchProfile } from "../src/index.js";

describe("searchProfile", () => {
  it("maps any movie to the single movie profile, regardless of origin", () => {
    expect(searchProfile({ type: "movie", originCountries: ["CN"] })).toBe("movie");
    expect(searchProfile({ type: "movie", originCountries: ["JP"] })).toBe("movie");
    expect(searchProfile({ type: "movie", originCountries: [] })).toBe("movie");
  });

  it("splits tv by origin (cn/us/kr/jp), else generic-tv", () => {
    expect(searchProfile({ type: "tv", originCountries: ["CN"] })).toBe("cn-tv");
    expect(searchProfile({ type: "tv", originCountries: ["US"] })).toBe("us-tv");
    expect(searchProfile({ type: "tv", originCountries: ["KR"] })).toBe("kr-tv");
    expect(searchProfile({ type: "tv", originCountries: ["JP"] })).toBe("jp-tv");
    expect(searchProfile({ type: "tv", originCountries: ["GB"] })).toBe("generic-tv");
    expect(searchProfile({ type: "tv", originCountries: [] })).toBe("generic-tv");
  });

  it("splits anime by origin (jp/cn/us), else generic-anime", () => {
    expect(searchProfile({ type: "anime", originCountries: ["JP"] })).toBe("jp-anime");
    expect(searchProfile({ type: "anime", originCountries: ["CN"] })).toBe("cn-anime");
    expect(searchProfile({ type: "anime", originCountries: ["US"] })).toBe("us-anime");
    expect(searchProfile({ type: "anime", originCountries: ["KR"] })).toBe("generic-anime");
    expect(searchProfile({ type: "anime", originCountries: [] })).toBe("generic-anime");
  });

  it("resolves co-productions by a deterministic precedence", () => {
    // anime: JP wins (anime is JP-centric); tv: CN wins (indexed in the 国产/合拍 circle).
    expect(searchProfile({ type: "anime", originCountries: ["US", "JP"] })).toBe("jp-anime");
    expect(searchProfile({ type: "tv", originCountries: ["US", "CN"] })).toBe("cn-tv");
  });
});

describe("getQualityGuidance", () => {
  it("returns empty for 不限 / undefined", () => {
    expect(getQualityGuidance("movie", undefined)).toBe("");
    expect(getQualityGuidance("jp-anime", undefined)).toBe("");
  });

  it("high on a 4K-reachable profile promises real 4K + coverage-first fallback", () => {
    const g = getQualityGuidance("us-tv", "high");
    expect(g).toContain("高");
    expect(g).toMatch(/2160p|4K/);
    expect(g).toContain("覆盖"); // coverage-first fallback present
    expect(g).not.toMatch(/极少|没有|稀缺/); // reachable → not the scarcity warning
  });

  it("high prefers playable REMUX/video and warns AGAINST 原盘/ISO disc images", () => {
    // Live e2e caught a 100GB 4K BD原盘 .iso being picked — high quality but
    // unplayable, not a single video. Guidance must steer to REMUX/video.
    for (const p of ["movie", "us-tv", "jp-anime"] as const) {
      const g = getQualityGuidance(p, "high");
      expect(g).toContain("REMUX");
      expect(g).toMatch(/避免[^]*?(ISO|原盘|BDMV)/); // AVOID disc images, not promote them
    }
  });

  it("high on a 4K-scarce profile warns 4K is rare and forbids over-searching", () => {
    for (const p of ["jp-anime", "cn-anime", "us-anime", "jp-tv"] as const) {
      const g = getQualityGuidance(p, "high");
      expect(g).toMatch(/极少|没有|稀缺/); // scarcity stated
      expect(g).toMatch(/过度搜索|撞限|预算/); // over-search warning
      expect(g).toContain("1080"); // realistic ceiling
    }
  });

  it("medium targets 1080p, coverage-first, and reminds quality never enters the keyword", () => {
    const g = getQualityGuidance("movie", "medium");
    expect(g).toContain("1080");
    expect(g).toContain("覆盖");
    expect(g).toMatch(/不进搜索|不进关键词|召回后/);
  });
});
