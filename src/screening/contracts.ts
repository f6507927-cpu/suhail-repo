import type { screeningRun, screeningCriterionResult, screeningUnknown } from "../db/schema/screening";
import type { JsonValue } from "../engine/types";

export type ScreenOptions = { asOf: string; trigger: string };
export type ScreenResult = { unchanged: boolean; runId: string };
export type Difference = { path: string; expected?: JsonValue; actual?: JsonValue };
export type Verification = {
  valid: boolean; hashMatches: boolean; replayMatches: boolean | null;
  replaySupported: boolean; engineVersion: string;
  storedHash: string; computedHash: string; differences: Difference[];
};
export type RunDetail = {
  run: typeof screeningRun.$inferSelect;
  criteria: (typeof screeningCriterionResult.$inferSelect)[];
  unknowns: (typeof screeningUnknown.$inferSelect)[];
};
export type ScreeningAdminData = {
  versions: { id: string; label: string; methodologyName: string }[];
  runs: (typeof screeningRun.$inferSelect)[];
  unchanged: { securityId: string; methodologyVersionId: string; runId: string; jobId: string }[];
};
export type JobSummary = { processed: number; failed: number; unchanged: number; inserted: number; status: string };
export type BulkResult = { jobId?: string; summary: JobSummary; message?: string };
export type ScreenActionResult = ({ ok: true } & ScreenResult) | { ok: false; error: string };
export type VerifyActionResult = { ok: true; verification: Verification } | { ok: false; error: string };
export type BulkActionResult = ({ ok: true } & BulkResult) | { ok: false; error: string };
