"use client";
import "./globals.css";
import { RecoveryDocument } from "@/components/foundation/RecoveryDocument";

export default function GlobalError() {
  return <RecoveryDocument kind="error" />;
}
