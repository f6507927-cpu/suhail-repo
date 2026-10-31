import "server-only";
import type { ZodType } from "zod";

// Empty template assignments count as unset for optional/defaulted variables.
export function blankToUndefined(value: unknown) {
  return value === "" ? undefined : value;
}

export function parseEnv<TSchema extends ZodType>(
  schemaName: string,
  schema: TSchema,
): TSchema["_output"] {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const names = [
      ...new Set(result.error.issues.map((issue) => issue.path.join("."))),
    ];
    throw new Error(
      `${schemaName} environment validation failed. Check these variable names: ${names.join(", ")}`,
    );
  }
  return result.data;
}
