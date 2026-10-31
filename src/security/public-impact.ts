import { and, eq } from "drizzle-orm";
import { methodologyVersion } from "../db/schema/methodology";
import type { Tx } from "../lib/auth/audit";
import type { MethodologyCommand } from "../lib/methodology/commands";

/** Read under the same governance transaction, before visibility can be removed. */
export async function methodologyAffectsPublic(tx: Tx, command: MethodologyCommand) {
  if (command.operation === "cases") return false;
  if (command.operation === "visibility" && command.isPublic) return true;
  const id = command.operation === "metadata" || command.operation === "version"
    ? command.id : command.versionId;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return false;
  const [visible] = await tx.select({id: methodologyVersion.id}).from(methodologyVersion)
    .where(and(
      eq(command.operation === "metadata" ? methodologyVersion.methodology_id : methodologyVersion.id, id),
      eq(methodologyVersion.is_public, true),
    )).limit(1);
  return !!visible;
}
