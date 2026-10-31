import type { MetadataRoute } from "next";
import { isPreview } from "../security/preview";
export const dynamic = "force-dynamic";
export default function robots(): MetadataRoute.Robots {
  if (isPreview()) return {rules: {userAgent: "*", disallow: "/"}};
  return {rules:{userAgent:"*", allow:"/", disallow:["/auth","/account","/admin","/en/auth","/en/account","/en/admin","/api/account"]}};
}
