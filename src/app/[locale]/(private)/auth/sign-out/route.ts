import { NextResponse } from "next/server";
import { serverAuth } from "../../../../../lib/auth/server";
import { sameOriginPost, httpError } from "../../../../../lib/auth/http";
import { localePath } from "../../../../../lib/auth/paths";
import { authOrigin } from "../../../../../lib/auth/origin";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  try {
    sameOriginPost(request);
    const auth = await serverAuth();
    const { error } = await auth.auth.signOut();
    if (error) throw error;
    return NextResponse.redirect(
      new URL(localePath(locale, "/"), authOrigin()),
      303,
    );
  } catch (error) {
    return httpError(error);
  }
}
