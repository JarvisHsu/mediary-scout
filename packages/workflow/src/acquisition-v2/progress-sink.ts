import type { WorkflowRepository } from "../repository.js";
import { phaseProgress, type AgentToolEvent } from "./activity.js";

/**
 * Build the per-tool-call progress sink the runner wires into the agent loop. It
 * turns each real tool event into a monotonic, phase-weighted progress write on
 * the run (for the activity page). Fire-and-forget + error-swallowing: a progress
 * write must NEVER throw and fail an otherwise-good acquisition.
 *
 * `neededHint` (the run's missing-episode count) lets the mark phase show a real
 * obtained/needed fraction; omit it (movies / unknown) and the bar uses the band
 * midpoint instead. `obtained` accumulates across markObtained calls (the MOVIE
 * sentinel is not an episode and is not counted).
 */
export function makeProgressSink(input: {
  repository: Pick<WorkflowRepository, "updateWorkflowRunProgress">;
  workflowRunId: string;
  neededHint?: number;
  now?: () => string;
}): (event: AgentToolEvent) => void {
  const now = input.now ?? (() => new Date().toISOString());
  const needed = input.neededHint ?? 0;
  let percent = 0;
  let obtained = 0;

  return (event: AgentToolEvent) => {
    if (event.toolName === "markObtained") {
      const codes = Array.isArray(event.args.codes) ? event.args.codes : [];
      obtained += codes.filter((code) => code !== "MOVIE").length;
    }
    const subFraction = event.phase === "mark" && needed > 0 ? obtained / needed : undefined;
    percent = Math.max(percent, phaseProgress(event.phase, subFraction));
    void Promise.resolve(
      input.repository.updateWorkflowRunProgress(input.workflowRunId, {
        activity: event.activity,
        phase: event.phase,
        percent,
        updatedAt: now(),
        ...(needed > 0 ? { obtained, needed } : {}),
      }),
    ).catch(() => {
      // Progress is a display nicety; never let its write failure surface.
    });
  };
}
