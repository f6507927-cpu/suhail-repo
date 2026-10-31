import packageJson from "../../../../package.json";
import { getAppVersion } from "@/lib/version";

export function GET() {
  return Response.json({
    status: "ok",
    version: getAppVersion(packageJson.version, process.env.APP_GIT_SHA),
  });
}
