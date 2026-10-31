export function getAppVersion(packageVersion: string, gitSha?: string): string {
  return gitSha ? `${packageVersion}+${gitSha.slice(0, 7)}` : packageVersion;
}
