"use client";
import { createBrowserClient } from "@supabase/ssr";
export function createBrowserAuth() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Public research works before auth configuration; no fake session/provider.
  return url && key ? createBrowserClient(url, key) : null;
}
