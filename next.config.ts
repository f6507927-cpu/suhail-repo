import type { NextConfig } from "next";
import { execFileSync } from "node:child_process";
import createNextIntlPlugin from "next-intl/plugin";
import { securityHeaders, publicCsp } from "./src/security/headers";

function getGitSha() {
  const suppliedSha = process.env.GIT_SHA ?? process.env.GITHUB_SHA;
  if (suppliedSha) return suppliedSha;
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "";
  }
}

const nextConfig: NextConfig = {
  skipTrailingSlashRedirect: true,
  async headers() {
    return [{source: "/:path*", headers: [
      ...Object.entries(securityHeaders).map(([key,value]) => ({key,value})),
      {key: "Content-Security-Policy", value: publicCsp(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NODE_ENV === "development")},
    ]}];
  },
  allowedDevOrigins: [
    "127.0.0.1",
    ...(process.env.REPLIT_DEV_DOMAIN ? [process.env.REPLIT_DEV_DOMAIN] : []),
  ],
  output: "standalone",
  outputFileTracingIncludes: {"/terms":["./content/legal/*.md"],"/en/terms":["./content/legal/*.md"],"/privacy":["./content/legal/*.md"],"/en/privacy":["./content/legal/*.md"]},
  poweredByHeader: false,
  // Preserve next-router-prefetch for the proxy's auth/search accounting.
  // Next's default adapter otherwise strips Flight headers before our proxy.
  skipProxyUrlNormalize: true,
  reactStrictMode: true,
  // D-19: keep classic ISR; Cache Components are not enabled in Phase 0.
  cacheComponents: false,
  experimental: {
    globalNotFound: true,
    authInterrupts: true,
    // Browser checks must not inherit a previous dev session's compiler state.
    // Only the self-managed Playwright server opts out; preview/build keep defaults.
    ...(process.env.PLAYWRIGHT_TEST_SERVER === "1"
      ? { turbopackFileSystemCacheForDev: false }
      : {}),
  },
  env: { APP_GIT_SHA: getGitSha() },
};

export default createNextIntlPlugin("./src/i18n/request.ts")(nextConfig);
