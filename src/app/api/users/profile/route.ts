// src/app/api/users/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
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
          },
          orderBy: { createdAt: 'desc' }
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
    const walletTransactions = user.wallets.flatMap(wallet => 
      wallet.transactions.map(transaction => ({
        ...transaction,
        wallet: {
          id: wallet.id,
          name: wallet.name,
          currency: wallet.currency
        }
      }))
    );

    // Create mock REFERRAL_BONUS transactions from referralsGiven
    const referralBonusTransactions = user.referralsGiven.map(referral => ({
      id: `referral-${referral.id}`,
      type: 'REFERRAL_BONUS' as const,
      amount: referral.balance,
      createdAt: referral.createdAt,
      walletId: 'virtual', // Virtual wallet for referral bonuses
      wallet: {
        id: 'virtual',
        name: 'Referral Rewards',
        currency: 'usd' // Referral bonuses are stored in USD equivalent
      }
    }));

    // Combine and sort all transactions
    const totalTransactions = [...walletTransactions, ...referralBonusTransactions]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Calculate statistics
    const totalBalance = user.wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
    const totalDeposits = walletTransactions
      .filter(tx => tx.type === 'DEPOSIT')
      .reduce((sum, tx) => sum + tx.amount, 0);
    const totalWithdrawals = walletTransactions
      .filter(tx => tx.type === 'WITHDRAWAL')
      .reduce((sum, tx) => sum + tx.amount, 0);
    const totalReferralBonus = user.referralsGiven.reduce((sum, ref) => sum + ref.balance, 0);
    const totalInterest = walletTransactions
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

    // Validate referral code if provided
    if (referralCode !== undefined) {
      if (referralCode && referralCode.trim()) {
        // Check if referral code already exists (excluding current user)
        const existingUser = await prisma.user.findFirst({
          where: { 
            referralCode: referralCode.trim(),
            clerkUserId: { not: userId }
          }
        });
        
        if (existingUser) {
          return NextResponse.json(
            { error: 'Referral code already exists' },
            { status: 400 }
          );
        }
      }
    }

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { clerkUserId: userId },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(referralCode !== undefined && { referralCode: referralCode?.trim() || null }),
      },
      include: {
        wallets: true,
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