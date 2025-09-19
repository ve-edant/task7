// src/app/api/referrals/validate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json({ error: 'Referral code is required' }, { status: 400 });
    }

    // Find user with this referral code
    const referrer = await prisma.user.findUnique({
      where: { referralCode: code.trim() },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        referralCode: true,
      }
      
    });
    console.log(referrer);

    if (!referrer) {
      return NextResponse.json({ valid: false, message: 'Invalid referral code' }, { status: 404 });
    }

    return NextResponse.json({
      valid: true,
      referrer: {
        name: `${referrer.firstName || ''} ${referrer.lastName || ''}`.trim() || referrer.email,
        code: referrer.referralCode
      }
    });

  } catch (error) {
    console.error('Error validating referral code:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}