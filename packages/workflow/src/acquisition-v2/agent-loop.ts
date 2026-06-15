import { generateText, stepCountIs, type LanguageModel, type ToolSet } from "ai";
import { z } from "zod";
import type { TaskSandbox } from "./sandbox.js";
import { readSkillSection } from "./skill.js";

/**
 * Phase 3 — the agent loop harness. The strong agent drives its own
 * observe-act-verify loop through the sandbox tools; the system only orchestrates
 * the AI SDK tool-loop and feeds each tool's result (which the sandbox already
 * force-rereads) straight back into the model context. The sandbox stays the
 * permission cage: every guard refusal comes back to the model as `{ error }`
 * text it must read and adapt to — never a crash that aborts the loop.
 */

/** Wrap a sandbox call so a guard refusal becomes evidence, not an exception. */
async function asEvidence(run: () => Promise<unknown>): Promise<unknown> {
  try {
    return await run();
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Opt-in observability (MEDIA_TRACK_AGENT_LOG=1): log every sandbox tool call the
 * agent makes — the keyword it searches, the candidate it transfers, what it
 * moves/marks, and the evidence that comes back. Off by default (silent in
 * tests); turned on for live e2e so the agent loop is not a black box.
 */
function wrapWithLogging(tools: ToolSet): ToolSet {
  const wrapped: Record<string, unknown> = {};
  for (const [name, tool] of Object.entries(tools)) {
    const execute = (tool as { execute: (args: unknown, options: unknown) => Promise<unknown> }).execute;
    wrapped[name] = {
      ...(tool as object),
      execute: async (args: unknown, options: unknown) => {
        const argStr =
          args && typeof args === "object" && Object.keys(args).length > 0
            ? ` ${JSON.stringify(args).slice(0, 240)}`
            : "";
        console.log(`[agent] → ${name}${argStr}`);
        const result = await execute(args, options);
        console.log(`[agent] ← ${name}: ${JSON.stringify(result).slice(0, 400)}`);
        return result;
      },
    };
  }
  return wrapped as ToolSet;
}

/** Build the AI SDK ToolSet that exposes the sandbox to the model. Each tool's
 *  execute drives the sandbox and returns its (already reread) evidence. */
export function buildSandboxToolSet(sandbox: TaskSandbox): ToolSet {
  const tools = {
    readSkill: {
      description:
        "Read a section of your domain skill manual ON DEMAND — the hard-won playbook for HOW to act. Sections: protocol, dead-links-black-box, dedup, movie, tv, mistakes. Read your sections before you act, and re-read the relevant one the moment its situation arises. Acting from memory instead of the skill is how the old agent hammered 115 and corrupted libraries.",
      inputSchema: z.object({ section: z.string() }),
      execute: (args: { section: string }) =>
        Promise.resolve({ section: args.section, body: readSkillSection(args.section) }),
    },
    searchResources: {
      description:
        "Search the resource provider with ONE keyword. Read-only. Returns the full snapshot of candidates (no slicing). Repeats are deduped; the search budget is capped — decide from gathered evidence when refused.",
      inputSchema: z.object({ keyword: z.string() }),
      execute: (args: { keyword: string }) => asEvidence(() => sandbox.searchResources(args.keyword)),
    },
    inspectStaging: {
      description: "Read-only: the full raw file tree currently in this task's staging. Judge identity/dupes/extras from these real files.",
      inputSchema: z.object({}),
      execute: () => asEvidence(() => sandbox.inspectStaging()),
    },
    inspectStagingDirs: {
      description: "Read-only: the wrapper subdirectories currently in staging — the handles you pass to flattenPack.",
      inputSchema: z.object({}),
      execute: () => asEvidence(() => sandbox.inspectStagingDirs()),
    },
    inspectTargetDir: {
      description:
        "Read-only ground truth for what has landed. Pass `season` to see that season's directory (so you know what it already holds before moving/deduping); omit it to see all target seasons at once. Multi-season tasks: check each season here.",
      inputSchema: z.object({ season: z.number().int().positive().optional() }),
      execute: (args: { season?: number }) => asEvidence(() => sandbox.inspectTargetDir(args)),
    },
    transferCandidate: {
      description:
        "Transfer ONE snapshot-bound candidate into staging, then read back the TRUE materialized files. The candidate must come from a snapshot you searched this task. Refused once coverage is already met.",
      inputSchema: z.object({ snapshotId: z.string(), candidateId: z.string() }),
      execute: (args: { snapshotId: string; candidateId: string }) =>
        asEvidence(() => sandbox.transferCandidate(args)),
    },
    moveToSeason: {
      description:
        "Submit your WHOLE distribution plan in ONE call: `{moves:[{season,fileIds},...]}` — which files go into which season's directory. Each video's SUBTITLES go in the SAME season's fileIds (never leave subtitles behind — they must land beside their video). Move ONLY still-missing episodes; never recopy a season the library already has. A movie move OMITS `season` (the file lands in the movie directory). Returns every touched season dir + the remaining staging so you verify the whole distribution at once and fix any misplacement with another call. Every fileId must currently be in staging.",
      inputSchema: z.object({
        moves: z.array(z.object({ season: z.number().int().positive().optional(), fileIds: z.array(z.string()) })),
      }),
      execute: (args: { moves: Array<{ season?: number; fileIds: string[] }> }) =>
        asEvidence(() => sandbox.moveToSeason(args)),
    },
    deleteFiles: {
      description:
        "Delete files you confirmed (dedup keep-larger, or residue) from a named scoped directory. For directory='season' on a multi-season task, pass `season` to name which season's dir. Every id must currently be in that directory. Rereads it.",
      inputSchema: z.object({
        directory: z.enum(["staging", "season"]),
        season: z.number().int().positive().optional(),
        fileIds: z.array(z.string()),
      }),
      execute: (args: { directory: "staging" | "season"; season?: number; fileIds: string[] }) =>
        asEvidence(() => sandbox.deleteFiles(args)),
    },
    flattenPack: {
      description:
        "After extracting target files into the Season dir, remove the now-residual wrapper directory. Only a subdir currently inside this task's staging is allowed.",
      inputSchema: z.object({ directoryId: z.string() }),
      execute: (args: { directoryId: string }) => asEvidence(() => sandbox.flattenPack(args)),
    },
    flattenMovie: {
      description:
        'Movie only — AUTOMATIC: pull every video AND subtitle file out of the resource wrapper(s) up into the movie directory and remove the wrappers, in one call (no file selection — a movie is one film, take it all, subtitles included). Then delete any extras (trailers/花絮) with deleteFiles and markObtained(["MOVIE"]).',
      inputSchema: z.object({}),
      execute: () => asEvidence(() => sandbox.flattenMovie()),
    },
    discardStaging: {
      description:
        "TV/anime clean-up, your final step: after every needed episode (with its subtitles) is moved into its season directory and marked, wipe the WHOLE staging directory — leftovers you didn't need are discarded. You may only delete your own staging (never a season/show/root dir).",
      inputSchema: z.object({}),
      execute: () => asEvidence(() => sandbox.discardStaging()),
    },
    markObtained: {
      description:
        "Your FINAL action: declare the episode codes you have obtained (e.g. [\"S01E13\"], or [\"MOVIE\"] for a film). Do this LAST — only after you have moved the files into the target dir, flattened the wrapper, and confirmed from your inspect that the real films are in place. Pure agent judgment: no fileId, the system does not re-read to second-guess you.",
      inputSchema: z.object({ codes: z.array(z.string()) }),
      execute: (args: { codes: string[] }) => asEvidence(() => sandbox.markObtained(args)),
    },
    finish: {
      description: "Declare the task done. Returns the honest coverage summary (what is obtained, what remains).",
      inputSchema: z.object({}),
      execute: () => asEvidence(() => sandbox.finish()),
    },
    reportNoCoverage: {
      description:
        "Honestly report you cannot cover the target. Valid only after a real search ran; backs the report with real provider evidence.",
      inputSchema: z.object({ reason: z.string() }),
      execute: (args: { reason: string }) => asEvidence(() => sandbox.reportNoCoverage(args.reason)),
    },
  } satisfies ToolSet;
  return process.env.MEDIA_TRACK_AGENT_LOG === "1" ? wrapWithLogging(tools) : tools;
}

export interface AcquisitionAgentRequest {
  sandbox: TaskSandbox;
  model: LanguageModel;
  system: string;
  prompt: string;
  /** Hard ceiling on tool-loop steps (the model still terminates earlier via finish/reportNoCoverage). */
  maxSteps?: number;
}

export interface AcquisitionAgentResult {
  /** The model's final free text (after it stopped calling tools). */
  text: string;
  /** Number of loop steps the model took. */
  steps: number;
  /** Final honest coverage picture, read from the sandbox after the loop. */
  coverage: { coverageMet: boolean; obtained: string[]; missing: string[] };
}

/** Run the strong agent's self-driven loop over the sandbox tools. */
export async function runAcquisitionAgent(
  request: AcquisitionAgentRequest,
): Promise<AcquisitionAgentResult> {
  const tools = buildSandboxToolSet(request.sandbox);
  const result = await generateText({
    model: request.model,
    system: request.system,
    prompt: request.prompt,
    tools,
    stopWhen: stepCountIs(request.maxSteps ?? 40),
  });
  return {
    text: result.text,
    steps: result.steps?.length ?? 0,
    coverage: await request.sandbox.finish(),
  };
}
