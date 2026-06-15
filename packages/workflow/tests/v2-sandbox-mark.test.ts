import { describe, expect, it } from "vitest";
import { TaskSandbox } from "../src/acquisition-v2/sandbox.js";
import { FakeResourceProviderV2 } from "../src/acquisition-v2/fake-provider.js";
import { Storage115Simulator } from "../src/acquisition-v2/storage-115-simulator.js";

async function sandboxWithNeed(need: string[]) {
  const provider = new FakeResourceProviderV2({ results: {} });
  const storage = new Storage115Simulator({ packs: {} });
  const stagingDirectoryId = await storage.createDirectory({ name: "staging", parentId: "root" });
  const targetSeasonDirectoryId = await storage.createDirectory({ name: "Season 1", parentId: "root" });
  return new TaskSandbox({
    provider,
    storage,
    stagingDirectoryId,
    targetSeasonDirectoryIds: { 1: targetSeasonDirectoryId },
    need,
  });
}

describe("TaskSandbox — markObtained (agent's final declaration; NO mechanical reread)", () => {
  it("records the codes the agent declares obtained — pure agent judgment, no fileId", async () => {
    const sandbox = await sandboxWithNeed(["S01E01", "S01E02"]);

    const result = await sandbox.markObtained({ codes: ["S01E01"] });

    expect(result.confirmed).toEqual(["S01E01"]);
    const summary = await sandbox.finish();
    expect(summary.obtained).toEqual(["S01E01"]);
    expect(summary.missing).toEqual(["S01E02"]);
  });

  it("does NOT re-read 115 to verify presence — the mark is the agent's call", async () => {
    // The system no longer mechanically re-reads the target dir to confirm a
    // backing file exists. move/flatten already force-reread and handed the
    // truth back; the mark is reversible; §1.13 has the agent re-judge from real
    // files every patrol, so a stale mark self-heals. Correctness is the prompt
    // ordering (clean/flatten → mark LAST), not a system gate.
    const sandbox = await sandboxWithNeed(["S01E01"]);

    const result = await sandbox.markObtained({ codes: ["S01E01"] });

    expect(result.confirmed).toEqual(["S01E01"]);
    expect((await sandbox.finish()).coverageMet).toBe(true);
  });
});
