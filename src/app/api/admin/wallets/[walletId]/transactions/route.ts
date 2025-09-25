import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

// Calculate transaction value in USD
async function calculateTransactionValueUSD(amount: number, currency: string): Promise<number> {
  try {
    console.log(`Calculating USD value for ${amount} ${currency}`);
    
    const cryptoPrices = await fetchCryptoPrices([currency]);
    const price = cryptoPrices[currency]?.usd || 0;
    const usdValue = amount * price;
    
    console.log(`${amount} ${currency} * $${price} = $${usdValue.toFixed(2)} USD`);
    return usdValue;
  } catch (error) {
    console.error("Error calculating transaction value in USD:", error);
    return 0;
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ walletId: string }> }) {
  try {
    const { walletId } = await params;
    const body = await req.json();
    const { type, amount } = body;

    const validTypes = ["DEPOSIT", "WITHDRAWAL", "REFERRAL_BONUS", "INTEREST", "ADMIN_ADJUSTMENT"] as const;
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json({ error: "Invalid transaction type" }, { status: 400 });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    // Get wallet with user information to check for referrals
    const wallet = await prisma.wallet.findUnique({ 
      where: { id: walletId },
      include: {
        user: {
          include: {
            referralsReceived: {
              include: {
                referrer: true
              }
            },
            wallets: {
              include: {
                transactions: {
                  orderBy: {
                    createdAt: 'asc'
                  }
                }
              },
              orderBy: {
                createdAt: 'asc'
              }
            }
          }
        }
      }
    });

    if (!wallet) return NextResponse.json({ error: "Wallet not found" }, { status: 404 });

    // Check if this is the user's first wallet and first transaction
    const isFirstWallet = wallet.user.wallets.length === 1 && wallet.user.wallets[0].id === walletId;
    const isFirstTransaction = wallet.user.wallets.every(w => w.transactions.length === 0);
    
    // Create the main transaction
    const transaction = await prisma.transaction.create({
      data: {
        type,
        amount: parsedAmount,
        walletId,
      },
    });

    // Update wallet balance for the main transaction
    let newBalance = wallet.balance;
    if (type === "DEPOSIT" || type === "REFERRAL_BONUS" || type === "INTEREST" || type === "ADMIN_ADJUSTMENT") {
      newBalance += parsedAmount;
    } else if (type === "WITHDRAWAL") {
      newBalance -= parsedAmount;
    }

    await prisma.wallet.update({
      where: { id: walletId },
      data: { balance: newBalance },
    });

    // Handle referral bonus if this is the first wallet and first transaction
    if (isFirstWallet && isFirstTransaction && wallet.user.referralsReceived.length > 0) {
      console.log("Processing referral bonus for first transaction...");
      
      const referralRecord = wallet.user.referralsReceived[0];
      const referrer = referralRecord.referrer;
      
      // Get referee's (current user's) first wallet's first transaction (the one we just created)
      const refereeFirstWallet = wallet.user.wallets[0]; // This is the current wallet
      const refereeFirstTransaction = transaction; // This is the transaction we just created
      
      // Calculate USD value of referee's first transaction
      const refereeTransactionUSDValue = await calculateTransactionValueUSD(
        refereeFirstTransaction.amount, 
        refereeFirstWallet.currency
      );
      
      // Calculate 10% bonus in USD
      const referralBonusAmountUSD = refereeTransactionUSDValue * 0.1;
      
      console.log(`Referral bonus calculation: $${refereeTransactionUSDValue.toFixed(2)} * 0.1 = $${referralBonusAmountUSD.toFixed(2)} USD`);
      
      if (referralBonusAmountUSD > 0) {
        // Update referral record with the bonus amount in USD
        await prisma.referral.update({
          where: { id: referralRecord.id },
          data: { balance: referralBonusAmountUSD },
        });
        
        console.log(`Referral bonus of $${referralBonusAmountUSD.toFixed(2)} USD recorded in referral table for referrer ${referrer.email}`);
        
        return NextResponse.json({ 
          transaction,
          referralBonus: {
            amount: referralBonusAmountUSD,
            currency: 'USD',
            refereeTransaction: {
              amount: refereeFirstTransaction.amount,
              currency: refereeFirstWallet.currency,
              usdValue: refereeTransactionUSDValue
            },
            referrer: {
              name: `${referrer.firstName || ''} ${referrer.lastName || ''}`.trim() || referrer.email,
              email: referrer.email
            }
          }
        });
      } else {
        console.log("Referral bonus calculation resulted in $0 - no bonus awarded");
      }
    }

    return NextResponse.json({ transaction });
  } catch (err) {
    console.error("Error in transaction creation:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}