// src/app/api/users/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, requireAuth } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

export async function GET(request: NextRequest) {
  try {
    // Check if user is authenticated
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find user by clerk ID and include all related data
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      include: {
        wallets: {
          include: {
            transactions: {
              orderBy: { createdAt: 'desc' }
            }
          }
        },
        referralsGiven: {
          include: {
            referee: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                createdAt: true
              }
            }
          }
        },
        referralsReceived: {
          include: {
            referrer: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                createdAt: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Flatten all transactions from all wallets for easier processing
    const totalTransactions = user.wallets.flatMap(wallet => 
      wallet.transactions.map(transaction => ({
        ...transaction,
        walletId: wallet.id
      }))
    ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Calculate additional statistics
    const totalBalance = user.wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
    const totalDeposits = totalTransactions
      .filter(tx => tx.type === 'DEPOSIT')
      .reduce((sum, tx) => sum + tx.amount, 0);
    const totalWithdrawals = totalTransactions
      .filter(tx => tx.type === 'WITHDRAWAL')
      .reduce((sum, tx) => sum + tx.amount, 0);
    const totalReferralBonus = totalTransactions
      .filter(tx => tx.type === 'REFERRAL_BONUS')
      .reduce((sum, tx) => sum + tx.amount, 0);
    const totalInterest = totalTransactions
      .filter(tx => tx.type === 'INTEREST')
      .reduce((sum, tx) => sum + tx.amount, 0);

    const userWithStats = {
      ...user,
      totalTransactions,
      stats: {
        totalBalance,
        totalDeposits,
        totalWithdrawals,
        totalReferralBonus,
        totalInterest,
        totalIncome: totalReferralBonus + totalInterest,
        referralsGivenCount: user.referralsGiven.length,
        referralsReceivedCount: user.referralsReceived.length,
        totalTransactionCount: totalTransactions.length
      }
    };

    return NextResponse.json({ user: userWithStats });

  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Check if user is authenticated
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { firstName, lastName, referralCode } = body;

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { clerkUserId: userId },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(referralCode !== undefined && { referralCode }),
      },
      include: {
        wallets: true,
        referralsGiven: true,
        referralsReceived: true
      }
    });

    return NextResponse.json({ user: updatedUser });

  } catch (error: any) {
    console.error('Error updating user profile:', error);
    
    // Handle unique constraint violation for referral code
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Referral code already exists' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}