import { headers } from "next/headers";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/accounts";
import { requirePageRole } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale === "en" ? "en" : "ar";
  const privatePath = (await headers()).get("x-private-path") ?? "/admin";
  const pathname = new URL(privatePath, "https://suhail.invalid").pathname;

  // Every nested admin page still has its own guard; this shell is a separate boundary.
  const context = await requirePageRole(locale, privatePath);
  const appPath = pathname.replace(/^\/en(?=\/)/, "") || "/admin";

  return (
    <AdminShell
      locale={locale}
      role={context.user.role as "admin" | "editor"}
      currentPath={appPath}
      userLabel={context.user.full_name}
      userEmail={context.user.email}
    >
      {children}
    </AdminShell>
  );
}
