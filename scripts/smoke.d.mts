export function parseArguments(args: string[]): string;
export function robotsDisallowsAll(text: string): boolean;
export function smoke(base: string, options?: {
  timeoutMs?: number;
  log?: (message: string) => void;
}): Promise<boolean>;
