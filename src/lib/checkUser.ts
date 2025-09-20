// src/lib/checkUser.ts
import { currentUser } from "@clerk/nextjs/server";
import prisma from "./prisma";
import { nanoid } from "nanoid";

// Fetch crypto prices
async function fetchCryptoPrices(currencies: string[]): Promise<Record<string, { usd: number }>> {
  if (currencies.length === 0) return {};
  try {
    const uniqueCurrencies = [...new Set(currencies)];
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${uniqueCurrencies.join(",")}&vs_currencies=usd`,
      { cache: "no-store" }
    );
    if (!response.ok) return {};
    return await response.json();
  } catch (error) {
    console.error("Error fetching crypto prices:", error);
    return {};
  }
}

// Calculate portfolio value
async function calculatePortfolioValue(userId: string): Promise<number> {
  try {
    const wallets = await prisma.wallet.findMany({ where: { userId } });
    if (wallets.length === 0) return 0;

    const currencies = wallets.map(wallet => wallet.currency);
    const cryptoPrices = await fetchCryptoPrices(currencies);

    return wallets.reduce((sum, wallet) => {
      const price = cryptoPrices[wallet.currency]?.usd || 0;
      return sum + wallet.balance * price;
    }, 0);
  } catch (error) {
    console.error("Error calculating portfolio value:", error);
    return 0;
  }
}

export const checkUser = async (referralCode?: string) => {
  const user = await currentUser();
  if (!user) return null;

  // Check if user already exists in DB
  const existingUser = await prisma.user.findUnique({
    where: { clerkUserId: user.id },
    include: {
      wallets: true,
      referralsReceived: true,
    },
  });

  if (existingUser) return existingUser;

  // Generate unique referral code for this new user
  let newReferralCode = nanoid(8);
  let isUnique = false;
  while (!isUnique) {
    const found = await prisma.user.findUnique({
      where: { referralCode: newReferralCode },
    });
    if (!found) isUnique = true;
    else newReferralCode = nanoid(8);
  }

  // Create user in DB
  const newUser = await prisma.user.create({
    data: {
      clerkUserId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      imageUrl: user.imageUrl,
      email: user.emailAddresses[0].emailAddress,
      referralCode: newReferralCode,
    },
  });

  // Handle referral if present
  if (referralCode && referralCode.trim()) {
    console.log("Entered referral code:", referralCode.trim());
    try {
      const referrer = await prisma.user.findUnique({
        where: { referralCode: referralCode.trim() },
        include: { wallets: true },
      });

      if (referrer && referrer.id !== newUser.id) {
        const referrerPortfolioValue = await calculatePortfolioValue(referrer.id);
        const bonusAmount = referrerPortfolioValue * 0.1; // 10% bonus

        await prisma.referral.create({
          data: {
            referrerId: referrer.id,
            refereeId: newUser.id,
            balance: bonusAmount,
          },
        });

        console.log(
          `Referral created: ${referrer.email} referred ${newUser.email} with bonus $${bonusAmount.toFixed(2)}`
        );
      }
    } catch (error) {
      console.error("Error processing referral:", error);
    }
  }

  return newUser;
};
