// src/lib/checkUser.ts
import { currentUser } from "@clerk/nextjs/server";
import prisma from "./prisma";
import { nanoid } from "nanoid";

// Function to fetch crypto prices from CoinGecko
async function fetchCryptoPrices(currencies: string[]): Promise<Record<string, { usd: number }>> {
  if (currencies.length === 0) return {};
  
  try {
    const uniqueCurrencies = [...new Set(currencies)];
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${uniqueCurrencies.join(',')}&vs_currencies=usd`,
      { cache: 'no-store' }
    );
    
    if (!response.ok) return {};
    return await response.json();
  } catch (error) {
    console.error('Error fetching crypto prices:', error);
    return {};
  }
}

// Function to calculate user's total portfolio value in USD
async function calculatePortfolioValue(userId: string): Promise<number> {
  try {
    const wallets = await prisma.wallet.findMany({
      where: { userId },
    });

    if (wallets.length === 0) return 0;

    const currencies = wallets.map(wallet => wallet.currency);
    const cryptoPrices = await fetchCryptoPrices(currencies);

    const totalValue = wallets.reduce((sum, wallet) => {
      const price = cryptoPrices[wallet.currency]?.usd || 0;
      return sum + (wallet.balance * price);
    }, 0);

    return totalValue;
  } catch (error) {
    console.error('Error calculating portfolio value:', error);
    return 0;
  }
}

export const checkUser = async (referralCode?: string) => {
  const user = await currentUser();

  // Check for current logged-in Clerk user
  if (!user) {
    return null;
  }

  // Check if the user is already in the database
  const loggedInUser = await prisma.user.findUnique({
    where: {
      clerkUserId: user.id,
    },
    include: {
      wallets: true,
      referralsReceived: true,
    }
  });

  if (loggedInUser) {
    return loggedInUser;
  }

  // Generate unique referral code using nanoid
  let userReferralCode = nanoid(8);
  let isUnique = false;

  while (!isUnique) {
    const existing = await prisma.user.findUnique({
      where: { referralCode: userReferralCode },
    });
    if (!existing) {
      isUnique = true;
    } else {
      userReferralCode = nanoid(8);
    }
  }

  // Create new user
  const newUser = await prisma.user.create({
    data: {
      clerkUserId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      imageUrl: user.imageUrl,
      email: user.emailAddresses[0].emailAddress,
      referralCode: userReferralCode,
    },
  });

  // Handle referral logic if a referral code was provided
  if (referralCode && referralCode.trim()) {
    try {
      // Find the referrer by their referral code
      const referrer = await prisma.user.findUnique({
        where: { referralCode: referralCode.trim() },
        include: {
          wallets: true,
        }
      });

      if (referrer && referrer.id !== newUser.id) {
        // Calculate 10% of referrer's portfolio value
        const referrerPortfolioValue = await calculatePortfolioValue(referrer.id);
        const bonusAmount = referrerPortfolioValue * 0.1; // 10% bonus

        // Create the referral record with the bonus amount
        await prisma.referral.create({
          data: {
            referrerId: referrer.id,
            refereeId: newUser.id,
            balance: bonusAmount,
          },
        });

        console.log(`Referral created: ${referrer.email} referred ${newUser.email} with bonus $${bonusAmount.toFixed(2)}`);
      }
    } catch (error) {
      console.error('Error processing referral:', error);
      // Don't fail user creation if referral processing fails
    }
  }

  return newUser;
};