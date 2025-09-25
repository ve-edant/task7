"use client";
import { useState, useEffect } from "react";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  ArrowRight,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";

interface Wallet {
  id: string;
  name: string;
  balance: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

interface Transaction {
  id: string;
  type:
    | "DEPOSIT"
    | "WITHDRAWAL"
    | "REFERRAL_BONUS"
    | "INTEREST"
    | "ADMIN_ADJUSTMENT";
  amount: number;
  createdAt: string;
  walletId: string;
  wallet?: {
    id: string;
    name: string;
    currency: string;
  };
}

interface UserProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  referralCode: string | null;
  wallets: Wallet[];
  referralsGiven: Array<{ id: string; createdAt: string }>;
  referralsReceived: Array<{ id: string; createdAt: string }>;
  totalTransactions: Transaction[];
}

interface CryptoPrice {
  [key: string]: {
    usd: number;
  };
}

interface DailyInterest {
  date: string;
  totalInterestAmount: number;
  totalUsdValue: number;
}

export default function UserDashboard() {
  const { user: clerkUser, isLoaded: isClerkLoaded, isSignedIn } = useUser();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [cryptoPrices, setCryptoPrices] = useState<CryptoPrice>({});
  const [loading, setLoading] = useState(true);
  const [pricesLoading, setPricesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Interest calculation settings (same as income page)
  const DAILY_INTEREST_RATE = 0.001; // 0.1% daily interest
  const MIN_BALANCE_FOR_INTEREST = 0.0001; // Minimum balance to earn interest
  const DEFAULT_CALCULATION_DAYS = 30; // Default to 30 days for dashboard

  // Handle referral code and user creation
  useEffect(() => {
    if (!isClerkLoaded || !isSignedIn) return;
    
    const handleUserSetup = async () => {
      try {
        const ref = localStorage.getItem("referralCode");
        console.log("Referral code from localStorage:", ref);
        if (ref) {
          await fetch("/api/check-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ referralCode: ref }),
          });
          localStorage.removeItem("referralCode");
        } else {
          await fetch("/api/check-user", { method: "POST" });
        }
      } catch (error) {
        console.error("Error in user setup:", error);
      }
    };
    
    handleUserSetup();
  }, [isClerkLoaded, isSignedIn]);

  // Fetch user profile data
  const fetchUserProfile = async () => {
    try {
      setError(null);
      const response = await fetch("/api/users/profile");
      if (!response.ok) {
        throw new Error(
          `Failed to fetch profile: ${response.status} ${response.statusText}`
        );
      }
      const data = await response.json();
      setUserProfile(data.user);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      setError(
        error instanceof Error ? error.message : "Failed to fetch profile"
      );
    } finally {
      setLoading(false);
    }
  };

  // Fetch crypto prices from CoinGecko
  const fetchCryptoPrices = async (currencies: string[]) => {
    if (currencies.length === 0) {
      setPricesLoading(false);
      return;
    }
    try {
      const uniqueCurrencies = [...new Set(currencies)];
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${uniqueCurrencies.join(
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

  // Calculate theoretical daily interest (same logic as income page)
  const calculateTheoreticalInterest = (wallets: Wallet[]) => {
    if (!wallets || wallets.length === 0) return 0;
    
    const today = new Date();
    let totalInterestUsd = 0;

    // Calculate interest for the last 30 days
    for (let i = 0; i < DEFAULT_CALCULATION_DAYS; i++) {
      const currentDate = new Date(today);
      currentDate.setDate(today.getDate() - i);

      wallets.forEach(wallet => {
        if (wallet.balance >= MIN_BALANCE_FOR_INTEREST) {
          // Check if wallet existed on this date
          const walletCreatedDate = new Date(wallet.createdAt);
          if (currentDate >= walletCreatedDate) {
            const dailyInterest = wallet.balance * DAILY_INTEREST_RATE;
            const price = cryptoPrices[wallet.currency]?.usd || 0;
            const usdValue = dailyInterest * price;
            totalInterestUsd += usdValue;
          }
        }
      });
    }

    return totalInterestUsd;
  };

  // Calculate referral income (exact same logic as referrals page)
  const calculateReferralIncome = (transactions: Transaction[]) => {
    if (!transactions) return 0;
    
    const referralBonuses = transactions.filter(tx => tx.type === "REFERRAL_BONUS");
    
    return referralBonuses.reduce((sum, tx) => {
      const wallet = userProfile?.wallets.find(w => w.id === tx.walletId);
      const currency = wallet?.currency || tx.wallet?.currency;
      const price = currency ? cryptoPrices[currency]?.usd || 0 : 0;
      return sum + tx.amount * price;
    }, 0);
  };

  // Calculate admin adjustments
  const calculateAdminAdjustments = (transactions: Transaction[]) => {
    if (!transactions) return 0;
    
    return transactions
      .filter(tx => tx.type === "ADMIN_ADJUSTMENT")
      .reduce((sum, tx) => {
        const wallet = userProfile?.wallets.find(w => w.id === tx.walletId);
        const currency = wallet?.currency || tx.wallet?.currency;
        const price = currency ? cryptoPrices[currency]?.usd || 0 : 0;
        return sum + tx.amount * price;
      }, 0);
  };

  // Calculate totals with enhanced income logic
  const calculateTotals = () => {
    if (!userProfile || !userProfile.wallets || pricesLoading) {
      return {
        totalBalance: 0,
        totalDeposits: 0,
        totalWithdrawals: 0,
        totalIncome: 0,
        theoreticalInterest: 0,
        referralIncome: 0,
        adminAdjustments: 0,
      };
    }

    const totalBalance = userProfile.wallets.reduce((sum, wallet) => {
      const price = cryptoPrices[wallet.currency]?.usd || 0;
      return sum + wallet.balance * price;
    }, 0);

    const transactions = userProfile.totalTransactions || [];

    const totalDeposits = transactions
      .filter((tx) => tx.type === "DEPOSIT")
      .reduce((sum, tx) => {
        const wallet = userProfile.wallets.find((w) => w.id === tx.walletId);
        const price = wallet ? cryptoPrices[wallet.currency]?.usd || 0 : 0;
        return sum + tx.amount * price;
      }, 0);

    const totalWithdrawals = transactions
      .filter((tx) => tx.type === "WITHDRAWAL")
      .reduce((sum, tx) => {
        const wallet = userProfile.wallets.find((w) => w.id === tx.walletId);
        const price = wallet ? cryptoPrices[wallet.currency]?.usd || 0 : 0;
        return sum + tx.amount * price;
      }, 0);

    // Enhanced income calculation (same as income page)
    const theoreticalInterest = calculateTheoreticalInterest(userProfile.wallets);
    const referralIncome = calculateReferralIncome(transactions);
    const adminAdjustments = calculateAdminAdjustments(transactions);
    const totalIncome = theoreticalInterest + referralIncome + adminAdjustments;

    return { 
      totalBalance, 
      totalDeposits, 
      totalWithdrawals, 
      totalIncome,
      theoreticalInterest,
      referralIncome,
      adminAdjustments,
    };
  };

  // Fetch profile when Clerk user is ready
  useEffect(() => {
    if (isClerkLoaded && isSignedIn && clerkUser) {
      fetchUserProfile();
    } else if (isClerkLoaded && !isSignedIn) {
      setLoading(false);
      setError("User not signed in");
    }
  }, [isClerkLoaded, isSignedIn, clerkUser]);

  // Fetch crypto prices when profile is loaded
  useEffect(() => {
    if (userProfile?.wallets) {
      const currencies = userProfile.wallets.map((wallet) => wallet.currency);
      fetchCryptoPrices(currencies);
    }
  }, [userProfile]);

  const { 
    totalBalance, 
    totalDeposits, 
    totalWithdrawals, 
    totalIncome,
    theoreticalInterest,
    referralIncome,
    adminAdjustments,
  } = calculateTotals();

  // Loading state
  if (!isClerkLoaded || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="text-gray-600">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !isSignedIn) {
    setError(null);
    setLoading(true);
    fetchUserProfile();
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Unable to Load Dashboard
          </h2>
          <p className="text-gray-600 mb-4">
            {error || "Please sign in to view your dashboard."}
          </p>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              fetchUserProfile();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Profile not found state
  if (!userProfile) {
    setLoading(true);
    fetchUserProfile();
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Profile Not Found
          </h2>
          <p className="text-gray-600 mb-4">
            Unable to load your profile information.
          </p>
          <button
            onClick={() => {
              setLoading(true);
              fetchUserProfile();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {userProfile.firstName || "User"}!
          </h1>
          <p className="text-gray-600 mt-2">Here's your financial overview</p>
        </div>

        {/* Enhanced Income Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <TrendingUp className="h-5 w-5 text-blue-600 mr-2" />
            <div>
              <p className="text-sm font-medium text-blue-800">
                Income includes theoretical daily interest ({(DAILY_INTEREST_RATE * 100).toFixed(1)}% daily on eligible balances) + actual referral bonuses
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Interest calculated for last {DEFAULT_CALCULATION_DAYS} days • Minimum balance: {MIN_BALANCE_FOR_INTEREST} tokens
              </p>
            </div>
          </div>
        </div>

        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Wallets Card */}
          <Link href="/dashboard/wallets" className="group">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Wallet className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="ml-3 text-lg font-semibold text-gray-900">
                    Wallets
                  </h3>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Balance</span>
                  <span className="font-medium text-black">
                    {pricesLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      `$${totalBalance.toLocaleString("en-US", {
                        maximumFractionDigits: 2,
                      })}`
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Active Wallets</span>
                  <span className="font-medium text-black">
                    {userProfile.wallets.length}
                  </span>
                </div>
              </div>
            </div>
          </Link>

          {/* Deposits Card */}
          <Link href="/dashboard/deposits" className="group">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                  <h3 className="ml-3 text-lg font-semibold text-gray-900">
                    Deposits
                  </h3>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Deposited</span>
                  <span className="font-medium text-green-600">
                    {pricesLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      `$${totalDeposits.toLocaleString("en-US", {
                        maximumFractionDigits: 2,
                      })}`
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Transactions</span>
                  <span className="font-medium text-black">
                    {userProfile.totalTransactions?.filter(
                      (tx) => tx.type === "DEPOSIT"
                    ).length || 0}
                  </span>
                </div>
              </div>
            </div>
          </Link>

          {/* Enhanced Total Income Card */}
          <Link href="/dashboard/income" className="group">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <DollarSign className="h-6 w-6 text-purple-600" />
                  </div>
                  <h3 className="ml-3 text-lg font-semibold text-gray-900">
                    Total Income
                  </h3>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Earnings</span>
                  <span className="font-medium text-purple-600">
                    {pricesLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      `$${totalIncome.toLocaleString("en-US", {
                        maximumFractionDigits: 2,
                      })}`
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Referrals</span>
                  <span className="font-medium text-blue-600">
                    {pricesLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      `$${referralIncome.toLocaleString("en-US", {
                        maximumFractionDigits: 2,
                      })}`
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Interest (30d)</span>
                  <span className="font-medium text-green-600">
                    {pricesLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      `$${theoreticalInterest.toLocaleString("en-US", {
                        maximumFractionDigits: 2,
                      })}`
                    )}
                  </span>
                </div>
              </div>
            </div>
          </Link>

          {/* Withdrawals Card */}
          <Link href="/dashboard/withdrawals" className="group">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <TrendingDown className="h-6 w-6 text-red-600" />
                  </div>
                  <h3 className="ml-3 text-lg font-semibold text-gray-900">
                    Withdrawals
                  </h3>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Withdrawn</span>
                  <span className="font-medium text-red-600">
                    {pricesLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      `$${totalWithdrawals.toLocaleString("en-US", {
                        maximumFractionDigits: 2,
                      })}`
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Transactions</span>
                  <span className="font-medium text-black">
                    {userProfile.totalTransactions?.filter(
                      (tx) => tx.type === "WITHDRAWAL"
                    ).length || 0}
                  </span>
                </div>
              </div>
            </div>
          </Link>

          {/* Referrals Card */}
          <Link href="/dashboard/referrals" className="group">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Users className="h-6 w-6 text-orange-600" />
                  </div>
                  <h3 className="ml-3 text-lg font-semibold text-gray-900">
                    Referrals
                  </h3>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Referred Users</span>
                  <span className="font-medium text-orange-600">
                    {userProfile.referralsGiven?.length || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Referral Code</span>
                  <span className="font-medium font-mono text-sm text-black">
                    {userProfile.referralCode || "Not Set"}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Recent Activity
            </h3>
            <div className="space-y-3">
              {userProfile.totalTransactions
                ?.slice(0, 3)
                .map((transaction, index) => {
                  const wallet = userProfile.wallets.find(
                    (w) => w.id === transaction.walletId
                  );
                  const currency = wallet?.currency || transaction.wallet?.currency;
                  const price = currency ? cryptoPrices[currency]?.usd || 0 : 0;
                  const usdValue = transaction.amount * price;
                  return (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between py-2"
                    >
                      <div className="flex items-center">
                        <div
                          className={`p-2 rounded-lg ${
                            transaction.type === "DEPOSIT"
                              ? "bg-green-100"
                              : transaction.type === "WITHDRAWAL"
                              ? "bg-red-100"
                              : "bg-blue-100"
                          }`}
                        >
                          {transaction.type === "DEPOSIT" ? (
                            <TrendingUp className="h-4 w-4 text-green-600" />
                          ) : transaction.type === "WITHDRAWAL" ? (
                            <TrendingDown className="h-4 w-4 text-red-600" />
                          ) : (
                            <DollarSign className="h-4 w-4 text-blue-600" />
                          )}
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900">
                            {transaction.type
                              .replace("_", " ")
                              .toLowerCase()
                              .replace(/\b\w/g, (l) => l.toUpperCase())}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(
                              transaction.createdAt
                            ).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {transaction.amount} {currency?.toUpperCase()}
                        </p>
                        <p className="text-xs text-gray-500">
                          ${usdValue.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              {(!userProfile.totalTransactions ||
                userProfile.totalTransactions.length === 0) && (
                <p className="text-gray-500 text-center py-4">
                  No recent transactions
                </p>
              )}
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Account Summary
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Member Since</span>
                <span className="font-medium text-black">
                  {new Date(
                    userProfile.referralsReceived?.[0]?.createdAt || Date.now()
                  ).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Wallets</span>
                <span className="font-medium text-black">
                  {userProfile.wallets.length}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Earning Wallets</span>
                <span className="font-medium text-green-600">
                  {userProfile.wallets.filter(w => w.balance >= MIN_BALANCE_FOR_INTEREST).length}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Transactions</span>
                <span className="font-medium text-black">
                  {userProfile.totalTransactions?.length || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Portfolio Value</span>
                <span className="font-medium text-blue-600">
                  {pricesLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    `$${totalBalance.toLocaleString("en-US", {
                      maximumFractionDigits: 2,
                    })}`
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}