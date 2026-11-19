import { randomUUID } from "node:crypto";
import { RESEARCH_SYSTEM_PROMPT } from "../../../src/lib/research/prompt";
import { STYLE_GUIDE } from "../../../src/ai/research/style-guide";
import type { ResearchRequest } from "../../../src/lib/research/contracts";
/** Measurement-only copy of b5011b6's all-string wrapping, not a runtime option. */
export function legacyPrompt(request: ResearchRequest) {
  const sections: string[] = [];
  function walk(value: unknown, path: string) {
    if (typeof value === "string") {
      let boundary = `untrusted_${randomUUID().replaceAll("-", "")}`;
      while (value.includes(boundary)) boundary = `untrusted_${randomUUID().replaceAll("-", "")}`;
      sections.push(`${path}\n<${boundary}>\n${value}\n</${boundary}>`);
    } else if (Array.isArray(value)) value.forEach((item, i) => walk(item, `${path}.${i}`));
    else if (value !== null && typeof value === "object")
      for (const [key, item] of Object.entries(value)) walk(item, `${path}.${key}`);
    else sections.push(`${path}=${JSON.stringify(value)}`);
  }
  walk(request.packet, "packet"); walk(request.guidance, "analyst_guidance");
  return { system: `${RESEARCH_SYSTEM_PROMPT}\nStyle guide:\n${JSON.stringify(STYLE_GUIDE)}`, user: sections.join("\n\n") };
}
