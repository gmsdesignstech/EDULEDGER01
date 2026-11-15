import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { findUserByEmail, createSession } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/session";
import { roleHome } from "@/lib/auth-redirect";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const savedState = cookieStore.get("google_oauth_state")?.value;

  // Clean up state cookie
  cookieStore.delete("google_oauth_state");

  const loginRedirect = (errorParam: string) => {
    const redir = new URL("/login", url.origin);
    redir.searchParams.set("error", errorParam);
    return NextResponse.redirect(redir.toString());
  };

  if (!code || !state || !savedState || state !== savedState) {
    return loginRedirect("google_auth_failed");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return loginRedirect("google_not_configured");
  }

  const redirectUri = `${url.origin}/api/auth/google/callback`;

  try {
    // 1. Exchange code for access token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      return loginRedirect("google_auth_failed");
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return loginRedirect("google_auth_failed");
    }

    // 2. Fetch user profile
    const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userinfoRes.ok) {
      return loginRedirect("google_auth_failed");
    }

    const googleUser = await userinfoRes.json();
    const email = googleUser.email?.trim().toLowerCase();

    if (!email) {
      return loginRedirect("google_auth_failed");
    }

    // 3. Find user in EduLedger
    const user = await findUserByEmail(email);
    if (!user) {
      return loginRedirect("account_not_found");
    }

    if (user.status !== "Active") {
      return loginRedirect("account_inactive");
    }

    // 4. Create session and set cookie
    const session = await createSession(user.id);
    cookieStore.set(SESSION_COOKIE, session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: session.expires,
    });

    // 5. Determine destination
    let destination = roleHome(user.role);
    if (user.role === "TEACHER" && user.mustChangePassword) {
      destination = "/teacher/change-password";
    }

    return NextResponse.redirect(new URL(destination, url.origin).toString());
  } catch (err) {
    console.error("Google OAuth Callback Error:", err);
    return loginRedirect("google_auth_failed");
  }
}
