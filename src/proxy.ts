import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Passthrough middleware — Clerk auth disabled */
export default function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
    "/(api|trpc)(.*)",
  ],
};
