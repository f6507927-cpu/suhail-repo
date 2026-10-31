import { BaseSequencer, type TestSpecification } from "vitest/node";

/** The bootstrap suite must inspect the EMPTY target before another suite migrates. */
export default class DatabaseSequencer extends BaseSequencer {
  async sort(files: TestSpecification[]) {
    const sorted = await super.sort(files);
    return sorted.sort((a, b) =>
      Number(!a.moduleId.endsWith("/database.integration.test.ts")) -
      Number(!b.moduleId.endsWith("/database.integration.test.ts")));
  }
}
