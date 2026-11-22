import { createRoot } from "react-dom/client";
import { ResearchReview, ResearchSettings, ResearchList } from "../../src/components/research";
import type { ResearchPacket } from "../../src/ai/research/contracts";
import type { ResearchDraft } from "../../src/ai/research/draft";
import type { PacketChange } from "../../src/ai/research/changes";
import { ResearchQueue } from "../../src/components/research/ResearchQueue";

const { packet, draft, refreshed, changes } = JSON.parse(document.querySelector("#fixture")!.textContent!) as {
  packet: ResearchPacket; draft: ResearchDraft; refreshed: ResearchDraft; changes: PacketChange[];
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
    mode === "queue" ? <ResearchQueue locale={locale} rows={[
      { id: "approved-fixture", ticker: "SYNALPHA", reasons: ["new_filing", "price_moved"], review_required: false, refresh_in_progress: false },
      { id: "pending-fixture", ticker: "SYNBETA", reasons: ["new_filing", "status_changed"], review_required: true, refresh_in_progress: true },
    ]} activeAnalyst={true} requestAction={action} /> :
    mode === "list" ? <ResearchList locale={locale} rows={[
      { id: "fixture", ticker: "SYNTHETIC", state: "in_review", blocks: 1 },
      { id: "abandoned-fixture", ticker: "SYNTHETIC", state: "requested", blocks: 1 },
    ]} securities={[{ id: "fixture", ticker: "SYNTHETIC" }]} requestAction={action}
      reconcileAction={action} settingsHref="/admin/research/settings" /> :
      <ResearchReview locale={locale} draft={{ id: "fixture", state: "in_review",
        ai_output: mode === "refresh" ? refreshed : draft, analyst_text: mode === "refresh" ? refreshed : draft,
        validation_results: [], failure_reason: null, text_hash: "fixture-current" }}
        packet={packet} activeAnalyst={true} saveAction={action} transitionAction={action} regenerateAction={action}
        revision={mode === "refresh" ? { previous: draft, changes } : undefined} />
);
