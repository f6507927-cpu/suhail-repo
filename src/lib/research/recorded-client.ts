import type { ModelResult, ResearchModelClient, ResearchRequest } from "./contracts";

/** D-187/D-194: hand-written recordings only; this class has no network path. */
export class RecordedResearchClient implements ResearchModelClient {
  private index = 0;
  constructor(private readonly recordings: readonly ModelResult[]) {}
  async generate(request: ResearchRequest): Promise<ModelResult> {
    void request;
    const recording = this.recordings[this.index++];
    if (!recording) throw new Error("No recorded research response remains");
    return { ...recording };
  }
}
