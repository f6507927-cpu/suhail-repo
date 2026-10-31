import { NextRequest } from "next/server";
import proxy from "../../src/proxy";
import Layout from "../../src/app/[locale]/(private)/admin/(protected)/layout";
import Page from "../../src/app/[locale]/(private)/admin/(protected)/[section]/page";
import { cookies, requests, scenario } from "./state";
import { installTransport } from "./transport";

export async function renderMethodology() {
  const s = scenario();
  installTransport();
  return requests.run(s, async () => {
    const request = new NextRequest("https://fixture.test/admin/methodologies", {
      headers: { cookie: cookies().map(c => `${c.name}=${c.value}`).join("; ") },
    });
    const response = await proxy(request);
    if (response.headers.get("Cache-Control") !== "private, no-store")
      throw new Error("Fixture private policy missing");
    // Invoked within the generated page's REAL Next RSC render/cache context.
    // Awaiting both server components keeps fixture transport state scoped
    // across their work; the returned React tree is rendered by Next to HTML.
    const page = await Page({
      params: Promise.resolve({ locale: "en", section: "methodologies" }),
      searchParams: Promise.resolve({}),
    });
    const node = await Layout({
      params: Promise.resolve({ locale: "en" }), children: page,
    });
    return { node, authCalls: s.calls.length, roleLookups: s.lookups,
      maxQueries: s.maxActive, sessionReads: s.sessionReads };
  });
}
