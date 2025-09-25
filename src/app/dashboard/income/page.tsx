"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft,
  DollarSign,
  Users,
  TrendingUp,
  Calendar,
  Search,
  Loader2,
  Gift,
  BarChart3,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";

interface Wallet {
  id: string;
  name: string;
  balance: number;
  currency: string; // CoinGecko ID
  createdAt: string;
}

interface Transaction {
  id: string;
  type: "DEPOSIT" | "WITHDRAWAL" | "REFERRAL_BONUS" | "INTEREST" | "ADMIN_ADJUSTMENT";
  amount: number;
  createdAt: string;
  walletId: string;
  wallet: {
    id: string;
    name: string;
    currency: string;
  };
}

interface DailyInterest {
  date: string;
  dateFormatted: string;
  totalInterestAmount: number;
  totalUsdValue: number;
  walletBreakdown: {
    [walletId: string]: {
      name: string;
      currency: string;
      interest: number;
      usdValue: number;
      balance: number;
    };
  };
}

interface CryptoPrice {
  [key: string]: {
    usd: number;
  };
}

interface ReferralSummary {
  totalCount: number;
  totalUsdValue: number;
  currencyBreakdown: {
    [currency: string]: {
      amount: number;
      usdValue: number;
    };
  };
}

export default function EnhancedIncomePage() {
  const { user } = useUser();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [incomeTransactions, setIncomeTransactions] = useState<Transaction[]>([]);
  const [dailyInterestData, setDailyInterestData] = useState<DailyInterest[]>([]);
  const [referralSummary, setReferralSummary] = useState<ReferralSummary>({
    totalCount: 0,
    totalUsdValue: 0,
    currencyBreakdown: {}
  });
  const [cryptoPrices, setCryptoPrices] = useState<CryptoPrice>({});
  const [loading, setLoading] = useState(true);
  const [pricesLoading, setPricesLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWallet, setSelectedWallet] = useState("all");
  const [dateRange, setDateRange] = useState("30d");

  // Interest calculation settings
  const DAILY_INTEREST_RATE = 0.001; // 0.1% daily interest
  const MIN_BALANCE_FOR_INTEREST = 0.0001; // Minimum balance to earn interest

  const fetchUserProfile = async () => {
    try {
      const response = await fetch("/api/users/profile");
      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Error Response:", errorText);
        throw new Error(`Failed to fetch profile: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Fetched user data:", data);

      // Handle the actual API response structure
      const userWallets = data.user?.wallets || [];
      const existingTransactions = data.user?.totalTransactions || [];

      console.log("Extracted wallets:", userWallets);
      console.log("Extracted transactions:", existingTransactions);

      setWallets(userWallets);
      
      // Filter for income transactions
      const incomeTransactions = existingTransactions.filter((tx: any) => 
        tx.type === "REFERRAL_BONUS" || 
        tx.type === "INTEREST" || 
        tx.type === "ADMIN_ADJUSTMENT"
      );
      
      console.log("Income transactions found:", incomeTransactions);
      setIncomeTransactions(incomeTransactions);

    } catch (error) {
      console.error("Error fetching user profile:", error);
      
      // Show user-friendly error message
      if (error instanceof Error) {
        console.error("Error details:", error.message);
      }
      
      // Set empty data as fallback
      setWallets([]);
      setIncomeTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  // Calculate theoretical daily interest based on wallet balances
  const calculateDailyInterest = (wallets: Wallet[]) => {
    const today = new Date();
    const dailyData: { [date: string]: DailyInterest } = {};

    // Get date range for calculation
    let daysToCalculate = 30;
    switch (dateRange) {
      case "7d":
        daysToCalculate = 7;
        break;
      case "30d":
        daysToCalculate = 30;
        break;
      case "90d":
        daysToCalculate = 90;
        break;
      case "all":
        daysToCalculate = 365; // Max 1 year
        break;
    }

    // Calculate interest for each day
    for (let i = 0; i < daysToCalculate; i++) {
      const currentDate = new Date(today);
      currentDate.setDate(today.getDate() - i);
      const dateKey = currentDate.toISOString().split('T')[0];
      const dateFormatted = currentDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      dailyData[dateKey] = {
        date: dateKey,
        dateFormatted,
        totalInterestAmount: 0,
        totalUsdValue: 0,
        walletBreakdown: {}
      };

      // Calculate interest for each wallet
      wallets.forEach(wallet => {
        if (wallet.balance >= MIN_BALANCE_FOR_INTEREST) {
          // Check if wallet existed on this date
          const walletCreatedDate = new Date(wallet.createdAt);
          if (currentDate >= walletCreatedDate) {
            const dailyInterest = wallet.balance * DAILY_INTEREST_RATE;
            const price = cryptoPrices[wallet.currency]?.usd || 0;
            const usdValue = dailyInterest * price;

            dailyData[dateKey].totalInterestAmount += dailyInterest;
            dailyData[dateKey].totalUsdValue += usdValue;

            dailyData[dateKey].walletBreakdown[wallet.id] = {
              name: wallet.name,
              currency: wallet.currency,
              interest: dailyInterest,
              usdValue: usdValue,
              balance: wallet.balance
            };
          }
        }
      });
    }

    // Filter out days with no interest and sort by date (newest first)
    const sortedData = Object.values(dailyData)
      .filter(day => day.totalInterestAmount > 0)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    setDailyInterestData(sortedData);
  };

  // Calculate referral summary from existing referral transactions
  const generateReferralSummary = (transactions: Transaction[]) => {
    const referralTransactions = transactions.filter(tx => tx.type === "REFERRAL_BONUS");
    
    const summary: ReferralSummary = {
      totalCount: referralTransactions.length,
      totalUsdValue: 0,
      currencyBreakdown: {}
    };

    referralTransactions.forEach(tx => {
      const currency = tx.wallet.currency;
      const price = cryptoPrices[currency]?.usd || 0;
      const usdValue = tx.amount * price;

      summary.totalUsdValue += usdValue;

      if (!summary.currencyBreakdown[currency]) {
        summary.currencyBreakdown[currency] = {
          amount: 0,
          usdValue: 0
        };
      }

      summary.currencyBreakdown[currency].amount += tx.amount;
      summary.currencyBreakdown[currency].usdValue += usdValue;
    });

    setReferralSummary(summary);
  };

  // Fetch crypto prices using CoinGecko IDs
  const fetchCryptoPrices = async (geckoIds: string[]) => {
    if (geckoIds.length === 0) {
      setPricesLoading(false);
      return;
    }

    setPricesLoading(true);
    try {
      const uniqueIds = [...new Set(geckoIds)];
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${uniqueIds.join(
          ","
        )}&vs_currencies=usd`
      );

      if (!response.ok) throw new Error("Failed to fetch crypto prices");
      const prices = await response.json();
      setCryptoPrices(prices);
    } catch (error) {
      console.error("Error fetching crypto prices:", error);
    } finally {
      setPricesLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchUserProfile();
    }
  }, [user]);

  useEffect(() => {
    if (wallets.length > 0) {
      const currencies = [...new Set(wallets.map(wallet => wallet.currency))];
      fetchCryptoPrices(currencies);
    } else {
      setPricesLoading(false);
    }
  }, [wallets]);

  useEffect(() => {
    if (wallets.length > 0 && !pricesLoading) {
      calculateDailyInterest(wallets);
      generateReferralSummary(incomeTransactions);
    }
  }, [wallets, cryptoPrices, pricesLoading, dateRange]);

  const calculateTotalStats = () => {
    // Calculate theoretical total interest earned
    const totalInterestUsd = dailyInterestData.reduce((sum, day) => sum + day.totalUsdValue, 0);
    
    // Calculate actual referral income
    const referralBonusUsd = incomeTransactions
      .filter(tx => tx.type === "REFERRAL_BONUS")
      .reduce((sum, tx) => {
        const price = cryptoPrices[tx.wallet.currency]?.usd || 0;
        return sum + tx.amount * price;
      }, 0);

    // Calculate admin adjustments
    const adminAdjustmentUsd = incomeTransactions
      .filter(tx => tx.type === "ADMIN_ADJUSTMENT")
      .reduce((sum, tx) => {
        const price = cryptoPrices[tx.wallet.currency]?.usd || 0;
        return sum + tx.amount * price;
      }, 0);

    const totalUsdValue = totalInterestUsd + referralBonusUsd + adminAdjustmentUsd;

    return {
      totalUsdValue,
      referralBonusUsd,
      interestUsd: totalInterestUsd,
      adminAdjustmentUsd,
    };
  };

  const {
    totalUsdValue,
    referralBonusUsd,
    interestUsd,
    adminAdjustmentUsd,
  } = calculateTotalStats();

  const getCurrencySymbol = (geckoId: string) => {
    const symbolMap: { [key: string]: string } = {
      bitcoin: "BTC",
      ethereum: "ETH",
      "binancecoin": "BNB",
      cardano: "ADA",
      solana: "SOL",
      "polygon-ecosystem-token": "POL",
      avalanche: "AVAX",
      "chainlink": "LINK",
      usd: "USD",
    };
    return symbolMap[geckoId] || geckoId.toUpperCase();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="text-gray-600">Loading income data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <Link href="/dashboard" className="mr-4">
              <ArrowLeft className="h-6 w-6 text-gray-600 hover:text-gray-900" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Income Dashboard</h1>
              <p className="text-gray-600 mt-1">
                Track your theoretical daily interest earnings ({(DAILY_INTEREST_RATE * 100).toFixed(1)}% daily) and referral bonuses
              </p>
            </div>
          </div>
        </div>

        {/* Interest Rate Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <TrendingUp className="h-5 w-5 text-blue-600 mr-2" />
            <div>
              <p className="text-sm font-medium text-blue-800">
                Interest Calculation: {(DAILY_INTEREST_RATE * 100).toFixed(1)}% daily rate applied to wallet balances
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Minimum balance for interest: {MIN_BALANCE_FOR_INTEREST} tokens • Calculated based on current wallet balances
              </p>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Total Income (USD)
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {pricesLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    `$${totalUsdValue.toLocaleString("en-US", {
                      maximumFractionDigits: 2,
                    })}`
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Referral Income
                </p>
                <p className="text-2xl font-bold text-blue-600">
                  {pricesLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    `$${referralBonusUsd.toLocaleString("en-US", {
                      maximumFractionDigits: 2,
                    })}`
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {referralSummary.totalCount} referrals
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Theoretical Interest
                </p>
                <p className="text-2xl font-bold text-green-600">
                  {pricesLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    `$${interestUsd.toLocaleString("en-US", {
                      maximumFractionDigits: 2,
                    })}`
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {dailyInterestData.length} earning days
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Calendar className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Active Wallets
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {wallets.filter(w => w.balance >= MIN_BALANCE_FOR_INTEREST).length}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  of {wallets.length} total
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Date Range Filter */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Date Range</h3>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-4 py-2 border text-black border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="all">All Time (Max 1 Year)</option>
            </select>
          </div>
        </div>

        {/* Daily Interest Earnings Table */}
        {dailyInterestData.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center">
                <Clock className="h-5 w-5 text-green-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Theoretical Daily Interest Earnings
                </h3>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total USD
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Wallet Breakdown
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {dailyInterestData.slice(0, 20).map((day) => (
                    <tr key={day.date} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {day.dateFormatted}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="text-green-600 font-semibold">
                          ${day.totalUsdValue.toFixed(4)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="space-y-1">
                          {Object.entries(day.walletBreakdown).map(([walletId, breakdown]) => (
                            <div key={walletId} className="flex items-center justify-between">
                              <span className="text-xs text-gray-600">
                                {breakdown.name}
                              </span>
                              <div className="flex items-center space-x-2">
                                <span className="text-xs font-medium">
                                  {breakdown.interest.toFixed(8)} {getCurrencySymbol(breakdown.currency)}
                                </span>
                                <span className="text-xs text-gray-500">
                                  (${breakdown.usdValue.toFixed(4)})
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Current Wallet Balances */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Current Wallet Balances (Interest Earning)
            </h3>
          </div>
          <div className="divide-y divide-gray-200">
            {wallets
              .filter(wallet => wallet.balance >= MIN_BALANCE_FOR_INTEREST)
              .map((wallet) => {
                const price = cryptoPrices[wallet.currency]?.usd || 0;
                const usdValue = wallet.balance * price;
                const dailyInterest = wallet.balance * DAILY_INTEREST_RATE;
                const dailyInterestUsd = dailyInterest * price;

                return (
                  <div key={wallet.id} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">
                          {wallet.name}
                        </h4>
                        <p className="text-xs text-gray-500">
                          Created: {new Date(wallet.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {wallet.balance.toFixed(8)} {getCurrencySymbol(wallet.currency)}
                        </p>
                        <p className="text-xs text-gray-500">
                          ≈ ${usdValue.toFixed(2)}
                        </p>
                        <p className="text-xs text-green-600">
                          Daily: +{dailyInterest.toFixed(8)} (${dailyInterestUsd.toFixed(4)})
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Referral Income Summary */}
        {Object.keys(referralSummary.currencyBreakdown).length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <Users className="h-5 w-5 text-blue-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">
                Referral Income Summary
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(referralSummary.currencyBreakdown).map(([currency, data]) => {
                const price = cryptoPrices[currency]?.usd || 1;

                return (
                  <div key={currency} className="bg-blue-50 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm font-medium text-gray-900">
                        {getCurrencySymbol(currency)}
                      </span>
                      <span className="text-sm text-gray-600">
                        {pricesLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          `$${price.toFixed(2)}`
                        )}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-lg font-bold text-blue-600">
                          {data.amount.toFixed(6)} {getCurrencySymbol(currency)}
                        </p>
                        <p className="text-sm text-gray-600">
                          ≈ ${data.usdValue.toLocaleString("en-US", {
                            maximumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}