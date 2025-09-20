//app/src/dashboard/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Wallet, TrendingUp, TrendingDown, Users, DollarSign, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';

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
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'REFERRAL_BONUS' | 'INTEREST' | 'ADMIN_ADJUSTMENT';
  amount: number;
  createdAt: string;
  walletId: string;
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

export default function UserDashboard() {
  const { user: clerkUser } = useUser();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [cryptoPrices, setCryptoPrices] = useState<CryptoPrice>({});
  const [loading, setLoading] = useState(true);
  const [pricesLoading, setPricesLoading] = useState(true);

  useEffect(() => {
    const ref = localStorage.getItem("referralCode");
    console.log("Referral code from localStorage:", ref);
    
    if (ref) {
      fetch("/api/check-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referralCode: ref }),
      }).then(() => {
        localStorage.removeItem("referralCode"); // cleanup
      });
    } else {
      fetch("/api/check-user", { method: "POST" }); // ensure user is in DB
    }
  }, []);

  // Fetch user profile data
  const fetchUserProfile = async () => {
    try {
      const response = await fetch('/api/users/profile');
      if (!response.ok) throw new Error('Failed to fetch profile');
      const data = await response.json();
      setUserProfile(data.user);
    } catch (error) {
      console.error('Error fetching user profile:', error);
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
        `https://api.coingecko.com/api/v3/simple/price?ids=${uniqueCurrencies.join(',')}&vs_currencies=usd`
      );
      
      if (!response.ok) throw new Error('Failed to fetch crypto prices');
      const prices = await response.json();
      setCryptoPrices(prices);
    } catch (error) {
      console.error('Error fetching crypto prices:', error);
    } finally {
      setPricesLoading(false);
    }
  };

  useEffect(() => {
    if (clerkUser) {
      fetchUserProfile();
    }
  }, [clerkUser]);

  useEffect(() => {
    if (userProfile?.wallets) {
      const currencies = userProfile.wallets.map(wallet => wallet.currency);
      fetchCryptoPrices(currencies);
    }
  }, [userProfile]);

  // Calculate totals
  const calculateTotals = () => {
    if (!userProfile || !userProfile.wallets || pricesLoading) {
      return {
        totalBalance: 0,
        totalDeposits: 0,
        totalWithdrawals: 0,
        totalIncome: 0,
      };
    }

    const totalBalance = userProfile.wallets.reduce((sum, wallet) => {
      const price = cryptoPrices[wallet.currency]?.usd || 0;
      return sum + (wallet.balance * price);
    }, 0);

    const transactions = userProfile.totalTransactions || [];
    
    const totalDeposits = transactions
      .filter(tx => tx.type === 'DEPOSIT')
      .reduce((sum, tx) => {
        const wallet = userProfile.wallets.find(w => w.id === tx.walletId);
        const price = wallet ? (cryptoPrices[wallet.currency]?.usd || 0) : 0;
        return sum + (tx.amount * price);
      }, 0);

    const totalWithdrawals = transactions
      .filter(tx => tx.type === 'WITHDRAWAL')
      .reduce((sum, tx) => {
        const wallet = userProfile.wallets.find(w => w.id === tx.walletId);
        const price = wallet ? (cryptoPrices[wallet.currency]?.usd || 0) : 0;
        return sum + (tx.amount * price);
      }, 0);

    const totalIncome = transactions
      .filter(tx => ['REFERRAL_BONUS', 'INTEREST'].includes(tx.type))
      .reduce((sum, tx) => {
        const wallet = userProfile.wallets.find(w => w.id === tx.walletId);
        const price = wallet ? (cryptoPrices[wallet.currency]?.usd || 0) : 0;
        return sum + (tx.amount * price);
      }, 0);

    return { totalBalance, totalDeposits, totalWithdrawals, totalIncome };
  };

  const { totalBalance, totalDeposits, totalWithdrawals, totalIncome } = calculateTotals();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="text-gray-600">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Profile Not Found</h2>
          <p className="text-gray-600">Unable to load your profile information.</p>
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
            Welcome back, {userProfile.firstName || 'User'}!
          </h1>
          <p className="text-gray-600 mt-2">
            Here's your financial overview
          </p>
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
                  <h3 className="ml-3 text-lg font-semibold text-gray-900">Wallets</h3>
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
                      `$${totalBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Active Wallets</span>
                  <span className="font-medium text-black">{userProfile.wallets.length}</span>
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
                  <h3 className="ml-3 text-lg font-semibold text-gray-900">Deposits</h3>
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
                      `$${totalDeposits.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Transactions</span>
                  <span className="font-medium text-black">
                    {userProfile.totalTransactions?.filter(tx => tx.type === 'DEPOSIT').length || 0}
                  </span>
                </div>
              </div>
            </div>
          </Link>

          {/* Total Income Card */}
          <Link href="/dashboard/income" className="group">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <DollarSign className="h-6 w-6 text-purple-600" />
                  </div>
                  <h3 className="ml-3 text-lg font-semibold text-gray-900">Total Income</h3>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Earnings</span>
                  <span className="font-medium text-purple-600">
                    {pricesLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      `$${totalIncome.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Sources</span>
                  <span className="font-medium text-black">Referrals & Interest</span>
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
                  <h3 className="ml-3 text-lg font-semibold text-gray-900">Withdrawals</h3>
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
                      `$${totalWithdrawals.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Transactions</span>
                  <span className="font-medium text-black">
                    {userProfile.totalTransactions?.filter(tx => tx.type === 'WITHDRAWAL').length || 0}
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
                  <h3 className="ml-3 text-lg font-semibold text-gray-900">Referrals</h3>
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
                    {userProfile.referralCode || 'Not Set'}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
            <div className="space-y-3">
              {userProfile.totalTransactions?.slice(0, 3).map((transaction, index) => {
                const wallet = userProfile.wallets.find(w => w.id === transaction.walletId);
                const price = wallet ? (cryptoPrices[wallet.currency]?.usd || 0) : 0;
                const usdValue = transaction.amount * price;
                
                return (
                  <div key={transaction.id} className="flex items-center justify-between py-2">
                    <div className="flex items-center">
                      <div className={`p-2 rounded-lg ${
                        transaction.type === 'DEPOSIT' ? 'bg-green-100' :
                        transaction.type === 'WITHDRAWAL' ? 'bg-red-100' :
                        'bg-blue-100'
                      }`}>
                        {transaction.type === 'DEPOSIT' ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : transaction.type === 'WITHDRAWAL' ? (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        ) : (
                          <DollarSign className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">
                          {transaction.type.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(transaction.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {transaction.amount} {wallet?.currency?.toUpperCase()}
                      </p>
                      <p className="text-xs text-gray-500">
                        ${usdValue.toFixed(2)}
                      </p>
                    </div>
                  </div>
                );
              })}
              
              {(!userProfile.totalTransactions || userProfile.totalTransactions.length === 0) && (
                <p className="text-gray-500 text-center py-4">No recent transactions</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Summary</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Member Since</span>
                <span className="font-medium text-black">
                  {new Date(userProfile.referralsReceived?.[0]?.createdAt || Date.now()).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Wallets</span>
                <span className="font-medium text-black">{userProfile.wallets.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Transactions</span>
                <span className="font-medium text-black">{userProfile.totalTransactions?.length || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Portfolio Value</span>
                <span className="font-medium text-blue-600">
                  {pricesLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    `$${totalBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
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