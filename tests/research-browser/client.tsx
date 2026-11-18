import { createRoot } from "react-dom/client";
import { ResearchReview, ResearchSettings, ResearchList } from "../../src/components/research";
import type { ResearchPacket } from "../../src/ai/research/contracts";
import type { ResearchDraft } from "../../src/ai/research/draft";

const { packet, draft } = JSON.parse(document.querySelector("#fixture")!.textContent!) as {
  packet: ResearchPacket; draft: ResearchDraft;
};
const locale = new URLSearchParams(location.search).get("locale") === "en" ? "en" : "ar";
document.documentElement.lang = locale;
document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
async function action(form: FormData) {
  document.querySelector("#recording")!.textContent = JSON.stringify([...form.entries()]);
  return { ok: true, message: "Recorded fixture action only" };
}
const mode = new URLSearchParams(location.search).get("mode");
createRoot(document.querySelector("#app")!).render(
  mode === "settings" ? <ResearchSettings locale={locale} settings={{
    ai_research_publishing: false, monthly_token_budget: 0, max_active_research_stocks: 0, allowed_sectors: [],
    max_packet_age_days: null, max_financial_age_days: null, price_move_threshold_percent: null, publication_age_days: null,
  }} saveAction={action} gateAction={action} /> :
    mode === "list" ? <ResearchList locale={locale} rows={[
      { id: "fixture", ticker: "SYNTHETIC", state: "in_review", blocks: 1 },
      { id: "abandoned-fixture", ticker: "SYNTHETIC", state: "requested", blocks: 1 },
    ]} securities={[{ id: "fixture", ticker: "SYNTHETIC" }]} requestAction={action}
      reconcileAction={action} settingsHref="/admin/research/settings" /> :
      <ResearchReview locale={locale} draft={{ id: "fixture", state: "in_review", ai_output: draft, analyst_text: draft,
        validation_results: [], failure_reason: null, text_hash: "fixture-current" }}
        packet={packet} activeAnalyst={true} saveAction={action} transitionAction={action} regenerateAction={action} />
);
