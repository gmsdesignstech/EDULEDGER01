import { NextResponse, type NextRequest } from "next/server";
import { getSubscription, getUserBySession } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/session";
import { subscriptionAccessError } from "@/lib/subscription-access";
import { isCrossSiteMutation } from "@/lib/security";
import { roleHome } from "@/lib/auth-redirect";
const allowedPrefixes = [
  "/api/auth/",
  "/api/subscription/",
  "/api/payments/verify",
  "/api/whatsapp/addon/",
  "/api/health",
  "/api/admin",
];
export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/dashboard")) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const user = token ? await getUserBySession(token) : undefined;
    if (!user) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(login);
    }
    if (["SUPER_ADMIN", "TEACHER", "PARENT"].includes(user.role))
      return NextResponse.redirect(new URL(roleHome(user.role), request.url));
    const subscription=await getSubscription(user.institutionId);
    if(!["ACTIVE","EXPIRING_SOON"].includes(subscription.status)){
      const onboardingPath=request.nextUrl.pathname==="/dashboard"||request.nextUrl.pathname==="/dashboard/settings"||(request.nextUrl.pathname==="/dashboard/students"&&subscription.studentUsage===0);
      if(!onboardingPath)return NextResponse.redirect(new URL("/subscription",request.url));
    }
    return NextResponse.next();
  }
  const publicCallback = [
    "/api/subscription/webhook",
    "/api/razorpay/webhook",
    "/api/whatsapp/webhook",
  ].includes(request.nextUrl.pathname) || request.nextUrl.pathname.startsWith("/api/cron/");
  if (!publicCallback && isCrossSiteMutation(request))
    return NextResponse.json(
      { error: "Cross-site request blocked." },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  if (
    ["HEAD", "OPTIONS"].includes(request.method) ||
    allowedPrefixes.some((prefix) =>
      request.nextUrl.pathname.startsWith(prefix),
    )
  )
    return NextResponse.next();
  if(request.nextUrl.pathname==="/api/students"||request.nextUrl.pathname==="/api/settings")return NextResponse.next();
  const token = request.cookies.get(SESSION_COOKIE)?.value,
    user = token ? await getUserBySession(token) : undefined;
  if (!user) return NextResponse.next();
  const access = await subscriptionAccessError(user.institutionId);
  return access
    ? NextResponse.json(access, { status: access.status })
    : NextResponse.next();
}
export const config = { matcher: ["/api/:path*", "/dashboard/:path*"] };
