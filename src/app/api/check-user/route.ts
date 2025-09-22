// src/app/api/check-user/route.ts
import { NextResponse, NextRequest } from "next/server";
import { checkUser } from "@/lib/checkUser";

export async function POST(req: Request) {
  const { referralCode } = await req.json().catch(() => ({}));
  const user = await checkUser(referralCode);
  return NextResponse.json(user);
}

// Handle GET requests for redirect flow
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const referralCode = searchParams.get('referralCode');
    
    const user = await checkUser(referralCode || undefined);
    
    // Redirect to dashboard after successful user creation/verification
    return NextResponse.redirect(new URL('/dashboard', req.url));
  } catch (error) {
    console.error("Error in check-user GET:", error);
    return NextResponse.redirect(new URL('/sign-in', req.url));
  }
}