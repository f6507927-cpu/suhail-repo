/** D-83: malformed contracts and arithmetic cannot produce screening results. */
export class EngineInputError extends Error {
  constructor(public readonly field: string, message: string) {
    super(`${field}: ${message}`);
    this.name = "EngineInputError";
  }
}
