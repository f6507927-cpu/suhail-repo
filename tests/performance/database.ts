import { getTableName } from "drizzle-orm";
import { state, user, wait } from "./state";

function select(transaction = false) {
  return {
    from(table: Parameters<typeof getTableName>[0]) {
      const name = getTableName(table);
      const builder = {
        where() { return builder; },
        orderBy() { return builder; },
        then(resolve: (rows: unknown[]) => unknown, reject: (error: unknown) => unknown) {
          return (async () => {
            const s = state();
            if (name === "users") {
              if (transaction) s.rechecks++; else s.lookups++;
              await wait();
              return [user()];
            }
            s.queries.push(name);
            s.active++;
            s.maxActive = Math.max(s.maxActive, s.active);
            await wait();
            s.active--;
            return [];
          })().then(resolve, reject);
        },
      };
      return builder;
    },
  };
}
export const dbApp = {
  select: () => select(),
  async transaction(work: (tx: unknown) => Promise<unknown>) {
    try {
      const result = await work({
        select: () => select(true),
        execute: async () => {
          state().locks++;
          if (state().cancelLock) throw Object.assign(new Error("Fixture statement cancellation"), { code: "57014" });
        },
      });
      state().commits++;
      return result;
    } catch (error) {
      state().rollbacks++;
      throw error;
    }
  },
};
