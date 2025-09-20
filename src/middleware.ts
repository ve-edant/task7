import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",                 
  "/sign-in(.*)",      
  "/sign-up(.*)",      
  "/api/webhooks/clerk",
  "/admin/login",      
  "/api/admin/login",  
  "/api/admin/logout",
  "/api/referrals/validate",
  
]);

const isAdminRoute = createRouteMatcher([
  "/admin/dashboard(.*)",
]);

const isAdminApiRoute = createRouteMatcher([
  "/api/admin(.*)",
]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
  console.log("Middleware running for:", req.nextUrl.pathname);

  // Handle admin routes
  if (isAdminRoute(req)) {
    const token = req.cookies.get("admin-token")?.value;

    if (!token) {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }

    // Instead of verifying here, just forward to /admin/dashboard
    // and do JWT verification in that route/server component
    return NextResponse.next();
  }

  // Skip protection for public routes
  if (isPublicRoute(req)) {
    return;
  }

  // Protect everything else with Clerk
  const { userId, redirectToSignIn } = await auth();

  if (!userId) {
    return redirectToSignIn({ returnBackUrl: req.url });
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
