import "server-only";
import { inArray } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { PgInsertValue, PgTable } from "drizzle-orm/pg-core";
import type { InferInsertModel } from "drizzle-orm";
import type * as schema from "./schema";
import {
  source,
  pick,
  edition,
  editionRevision,
  methodologyVersion,
  screeningCriterionResult,
} from "./schema";
import type { EditorEvidence } from "./schema/types";

type Db = PostgresJsDatabase<typeof schema>;
export type HistoricalReferences = {
  source_ids?: string[];
  editor_evidence?: EditorEvidence[];
  picks_added?: string[];
  picks_changed?: string[];
  picks_retained?: string[];
};
// D-73: run within the insert transaction, using the application's RLS role.
// Arrays are historical provenance, not FKs (later source/pick deletion cannot
// rewrite historical rows). Missing references fail explicitly at insert time.
export async function validateHistoricalReferences(
  db: Db,
  values: HistoricalReferences,
) {
  const sourceIds = [
    ...new Set(
      [
        ...(values.source_ids ?? []),
        ...(values.editor_evidence ?? []).map((item) => item.source_id),
      ].map((id) => id.toLowerCase()),
    ),
  ];
  const pickIds = [
    ...new Set(
      [
        ...(values.picks_added ?? []),
        ...(values.picks_changed ?? []),
        ...(values.picks_retained ?? []),
      ].map((id) => id.toLowerCase()),
    ),
  ];
  for (const [table, references] of [
    [source, sourceIds],
    [pick, pickIds],
  ] as const) {
    if (!references.length) continue;
    const rows = await db
      .select({ id: table.id })
      .from(table)
      .where(inArray(table.id, [...references]))
      .for("key share");
    const existing = new Set(rows.map((row) => row.id));
    if (references.some((id) => !existing.has(id)))
      throw new Error(
        `Missing historical ${table === source ? "source" : "pick"} reference`,
      );
  }
}

// All currently defined ID-array write surfaces have validated insert helpers.
// They are deliberately not ingestion, screening or editorial workflows.
export const referenceTables = {
  pick,
  edition,
  editionRevision,
  methodologyVersion,
  screeningCriterionResult,
};
function validatedInserter<T extends PgTable>(table: T) {
  return async (db: Db, values: InferInsertModel<T>) =>
    db.transaction(async (tx) => {
      await validateHistoricalReferences(tx, values as HistoricalReferences);
      return tx
        .insert(table)
        .values(values as PgInsertValue<T>)
        .returning();
    });
}
export const insertPick = validatedInserter(pick);
export const insertEdition = validatedInserter(edition);
export const insertEditionRevision = validatedInserter(editionRevision);
export const insertMethodologyVersion = validatedInserter(methodologyVersion);
export const insertScreeningCriterionResult = validatedInserter(
  screeningCriterionResult,
);
