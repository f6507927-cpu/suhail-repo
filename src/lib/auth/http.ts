import "server-only";
import { NextResponse } from "next/server";
import { AuthError } from "./errors";
import { authOrigin } from "./origin";
export const privateHeaders = {"Cache-Control":"private, no-store","CDN-Cache-Control":"no-store","Cloudflare-CDN-Cache-Control":"no-store","Vary":"Cookie","X-Robots-Tag":"noindex, nofollow"};
export function privateJson(value: unknown, status = 200) {
  return NextResponse.json(value,{status,headers:privateHeaders});
}
export function httpError(error: unknown) {
  return privateJson({error: error instanceof AuthError ? error.code : "operation_failed"},error instanceof AuthError ? error.status : 500);
}
export function sameOriginPost(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== authOrigin(request)) throw new AuthError(403,"invalid_origin");
}
