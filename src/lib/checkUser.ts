// src/lib/checkUser.ts
import { currentUser } from "@clerk/nextjs/server";
import prisma from "./prisma";
import { nanoid } from "nanoid";

// Fetch crypto prices from CoinGecko
async function fetchCryptoPrices(currencies: string[]): Promise<Record<string, { usd: number }>> {
  if (currencies.length === 0) return {};
  
  try {
    const uniqueCurrencies = [...new Set(currencies)];
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${uniqueCurrencies.join(",")}&vs_currencies=usd`,
      { cache: "no-store" }
    );
    
    if (!response.ok) {
      console.error("Failed to fetch crypto prices:", response.status, response.statusText);
      return {};
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error fetching crypto prices:", error);
    return {};
  }
}

// Calculate portfolio value in USD
async function calculatePortfolioValue(userId: string): Promise<number> {
  try {
    const wallets = await prisma.wallet.findMany({ 
      where: { userId },
      select: {
        balance: true,
        currency: true
      }
    });
    
    if (wallets.length === 0) {
      console.log(`No wallets found for user ${userId}`);
      return 0;
    }

    // Extract unique currencies
    const currencies = [...new Set(wallets.map(wallet => wallet.currency))];
    console.log(`Fetching prices for currencies: ${currencies.join(", ")}`);
    
    const cryptoPrices = await fetchCryptoPrices(currencies);
    console.log("Crypto prices:", cryptoPrices);

    const totalValue = wallets.reduce((sum, wallet) => {
      const price = cryptoPrices[wallet.currency]?.usd || 0;
      const walletValue = wallet.balance * price;
      console.log(`Wallet ${wallet.currency}: ${wallet.balance} * ${price} = ${walletValue} USD`);
      return sum + walletValue;
    }, 0);

    console.log(`Total portfolio value for user ${userId}: $${totalValue.toFixed(2)}`);
    return totalValue;
  } catch (error) {
    console.error("Error calculating portfolio value:", error);
    return 0;
  }
}

export const checkUser = async (referralCode?: string) => {
  const user = await currentUser();
  if (!user) return null;

  console.log(`Checking user: ${user.id}, referralCode: ${referralCode}`);

  // Check if user already exists in DB
  const existingUser = await prisma.user.findUnique({
    where: { clerkUserId: user.id },
    include: {
      wallets: true,
      referralsReceived: true,
    },
  });

  if (existingUser) {
    console.log(`Existing user found: ${existingUser.email}`);
    return existingUser;
  }

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

  console.log(`Generated new referral code: ${newReferralCode}`);

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

  console.log(`New user created: ${newUser.email} (ID: ${newUser.id})`);

  // Handle referral if present
  if (referralCode && referralCode.trim()) {
    console.log("Processing referral code:", referralCode.trim());
    
    try {
      const referrer = await prisma.user.findUnique({
        where: { referralCode: referralCode.trim() },
        include: { wallets: true },
      });

      if (referrer && referrer.id !== newUser.id) {
        console.log(`Found referrer: ${referrer.email} (ID: ${referrer.id})`);
        
        // Calculate referrer's portfolio value in USD
        const referrerPortfolioValue = await calculatePortfolioValue(referrer.id);
        const bonusAmount = referrerPortfolioValue * 0.1; // 10% bonus

        if (bonusAmount > 0) {
          // Create referral record with bonus amount
          const referralRecord = await prisma.referral.create({
            data: {
              referrerId: referrer.id,
              refereeId: newUser.id,
              balance: bonusAmount,
            },
          });

          console.log(
            `Referral created successfully: ${referrer.email} referred ${newUser.email} with bonus $${bonusAmount.toFixed(2)} (Referral ID: ${referralRecord.id})`
          );
        } else {
          console.log(`No bonus awarded - referrer portfolio value is $0`);
          
          // Still create referral record but with 0 balance
          await prisma.referral.create({
            data: {
              referrerId: referrer.id,
              refereeId: newUser.id,
              balance: 0,
            },
          });
        }
      } else if (!referrer) {
        console.log("Invalid referral code - referrer not found");
      } else {
        console.log("Self-referral attempted - ignored");
      }
    } catch (error) {
      console.error("Error processing referral:", error);
    }
  }

  return newUser;
};