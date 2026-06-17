import { describe, expect, it } from "vitest";
import type { WorkflowRunProgress } from "../src/index.js";
import { makeProgressSink } from "../src/acquisition-v2/progress-sink.js";

function fakeRepo() {
  const writes: Array<{ runId: string; progress: WorkflowRunProgress }> = [];
  return {
    writes,
    updateWorkflowRunProgress: async (runId: string, progress: WorkflowRunProgress) => {
      writes.push({ runId, progress });
    },
  };
}

describe("makeProgressSink", () => {
  it("writes phase-weighted progress per tool event", () => {
    const repo = fakeRepo();
    const sink = makeProgressSink({ repository: repo, workflowRunId: "r1", now: () => "t" });
    sink({ toolName: "searchResources", args: { keyword: "x" }, activity: "正在搜索资源:x", phase: "search" });
    sink({ toolName: "transferCandidate", args: {}, activity: "正在转存到网盘…", phase: "transfer" });
    expect(repo.writes.map((w) => w.progress.phase)).toEqual(["search", "transfer"]);
    expect(repo.writes[0]!.progress.percent).toBeLessThan(repo.writes[1]!.progress.percent);
    expect(repo.writes[0]!.runId).toBe("r1");
  });

  it("accumulates obtained from markObtained and drives the mark band by obtained/needed", () => {
    const repo = fakeRepo();
    const sink = makeProgressSink({ repository: repo, workflowRunId: "r", neededHint: 4, now: () => "t" });
    sink({ toolName: "markObtained", args: { codes: ["S1E1", "S1E2"] }, activity: "已确认 2 集入库", phase: "mark" });
    const p = repo.writes.at(-1)!.progress;
    expect(p.obtained).toBe(2);
    expect(p.needed).toBe(4);
    expect(p.percent).toBe(90); // mark band [85,95], 2/4=0.5 → 90
  });

  it("never rewinds percent when a later event maps to a lower phase", () => {
    const repo = fakeRepo();
    const sink = makeProgressSink({ repository: repo, workflowRunId: "r", now: () => "t" });
    sink({ toolName: "transferCandidate", args: {}, activity: "转存", phase: "transfer" });
    sink({ toolName: "readSkill", args: { section: "x" }, activity: "查手册", phase: "search" });
    expect(repo.writes.at(-1)!.progress.percent).toBeGreaterThanOrEqual(repo.writes[0]!.progress.percent);
  });

  it("ignores the MOVIE sentinel in the obtained count", () => {
    const repo = fakeRepo();
    const sink = makeProgressSink({ repository: repo, workflowRunId: "r", neededHint: 1, now: () => "t" });
    sink({ toolName: "markObtained", args: { codes: ["MOVIE"] }, activity: "影片已入库", phase: "mark" });
    expect(repo.writes.at(-1)!.progress.obtained).toBe(0);
  });

  it("swallows repository write errors (progress must never fail the run)", () => {
    const sink = makeProgressSink({
      repository: {
        updateWorkflowRunProgress: async () => {
          throw new Error("db down");
        },
      },
      workflowRunId: "r",
      now: () => "t",
    });
    expect(() => sink({ toolName: "finish", args: {}, activity: "收尾", phase: "finalize" })).not.toThrow();
  });
});
