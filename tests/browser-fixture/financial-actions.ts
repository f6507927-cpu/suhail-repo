import type { FinancialCommand, FinancialResult } from "../../src/lib/financial/contracts";

const securityId = "11111111-1111-4111-8111-111111111111";

export const financialFixture = {
  calls: [] as FinancialCommand[],
  reset() { this.calls.length = 0; },
  async action(command: FinancialCommand): Promise<FinancialResult> {
    this.calls.push(structuredClone(command));
    if (command.operation === "lookup") {
      const ticker = String(command.data?.ticker ?? "FIX");
      return { ok: true, lookup: { ticker, cik: "0000000001", name: "Fixture Research Systems", exchange: "NASDAQ", sector: "Fixture sector", fiscalYearEnd: "1231" } };
    }
    return { ok: true, id: command.operation === "add" ? securityId : "22222222-2222-4222-8222-222222222222" };
  },
};

export async function financialAction(command: FinancialCommand): Promise<FinancialResult> {
  return financialFixture.action(command);
}

declare global {
  interface Window {
    financialFixture: typeof financialFixture;
  }
}
