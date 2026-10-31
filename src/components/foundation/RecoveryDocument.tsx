"use client";

import { RecoveryDocumentClient } from "./RecoveryDocumentClient";

export function RecoveryDocument({ kind }: { kind: "error" | "not-found" }) {
  return <RecoveryDocumentClient kind={kind} />;
}
