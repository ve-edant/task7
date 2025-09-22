// src/middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

// Protected routes
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/admin(.*)',
]);

// Public routes
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/referral/sign-up(.*)',
  '/api/referrals/validate',
  '/api/check-user',
]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const { userId } = await auth(); // ✅ await here
  const url = req.nextUrl.clone();

  // Handle referral links
  if (url.pathname === '/sign-up' && url.searchParams.has('ref')) {
    const referralCode = url.searchParams.get('ref');
    url.pathname = '/referral/sign-up';
    url.searchParams.set('ref', referralCode!);
    return NextResponse.redirect(url);
  }

  // ✅ Let public routes be accessible always
  if (isPublicRoute(req)) {
    // If user is logged in and hits sign-in/up, redirect to dashboard
    if (
      userId &&
      (url.pathname.startsWith('/sign-in') ||
        url.pathname.startsWith('/sign-up') ||
        url.pathname.startsWith('/referral/sign-up'))
    ) {
      url.pathname = '/dashboard';
      url.search = '';
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  // ✅ Protect private routes
  if (isProtectedRoute(req) && !userId) {
    url.pathname = '/sign-in';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
