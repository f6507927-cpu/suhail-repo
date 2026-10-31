"use client";
import { LocalizedRecovery } from "@/components/foundation/RecoveryScreen";
export default function ErrorPage({ retry }: { retry: () => void }) {
  return <LocalizedRecovery kind="error" retry={retry} />;
}
