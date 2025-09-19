'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, TrendingDown, Calendar, Filter, Search, Loader2, Wallet, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { TransactionType } from '@prisma/client';

interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  createdAt: string;
  walletId: string;
  wallet: {
    id: string;
    name: string;
    currency: string;
  };
}

interface CryptoPrice {
  [key: string]: {
    usd: number;
  };
}

export default function WithdrawalsPage() {
  const { user } = useUser();
  const [withdrawals, setWithdrawals] = useState<Transaction[]>([]);
  const [filteredWithdrawals, setFilteredWithdrawals] = useState<Transaction[]>([]);
  const [cryptoPrices, setCryptoPrices] = useState<CryptoPrice>({});
  const [loading, setLoading] = useState(true);
  const [pricesLoading, setPricesLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWallet, setSelectedWallet] = useState('all');
  const [dateRange, setDateRange] = useState('all');

  const fetchUserProfile = async () => {
    try {
      const response = await fetch('/api/users/profile');
      if (!response.ok) throw new Error('Failed to fetch profile');
      const data = await response.json();

      // Extract all withdrawal transactions with wallet info
      const allWithdrawals = data.user.wallets
        .flatMap((wallet: any) =>
          wallet.transactions
            .filter((tx: { type: TransactionType }) => tx.type === TransactionType.WITHDRAWAL)
            .map((tx: any) => ({
              ...tx,
              wallet: {
                id: wallet.id,
                name: wallet.name,
                currency: wallet.currency,
              },
            }))
        )
        .sort((a: any, b: any) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

      setWithdrawals(allWithdrawals);
      setFilteredWithdrawals(allWithdrawals);
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
    } finally {
      setLoading(false);
    }
  };

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
    if (user) {
      fetchUserProfile();
    }
  }, [user]);

  useEffect(() => {
    if (withdrawals.length > 0) {
      const currencies = [...new Set(withdrawals.map(withdrawal => withdrawal.wallet.currency))];
      fetchCryptoPrices(currencies);
    }
  }, [withdrawals]);

  // Filter withdrawals based on search and filters
  useEffect(() => {
    let filtered = withdrawals;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(withdrawal =>
        withdrawal.wallet.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        withdrawal.wallet.currency.toLowerCase().includes(searchTerm.toLowerCase()) ||
        withdrawal.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by wallet
    if (selectedWallet !== 'all') {
      filtered = filtered.filter(withdrawal => withdrawal.walletId === selectedWallet);
    }

    // Filter by date range
    if (dateRange !== 'all') {
      const now = new Date();
      const startDate = new Date();

      switch (dateRange) {
        case '7d':
          startDate.setDate(now.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(now.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(now.getDate() - 90);
          break;
      }

      filtered = filtered.filter(withdrawal => new Date(withdrawal.createdAt) >= startDate);
    }

    setFilteredWithdrawals(filtered);
  }, [withdrawals, searchTerm, selectedWallet, dateRange]);

  const calculateTotalStats = () => {
    const totalAmount = filteredWithdrawals.reduce((sum, withdrawal) => sum + withdrawal.amount, 0);
    const totalUsdValue = filteredWithdrawals.reduce((sum, withdrawal) => {
      const price = cryptoPrices[withdrawal.wallet.currency]?.usd || 0;
      return sum + (withdrawal.amount * price);
    }, 0);

    const groupedByCurrency = filteredWithdrawals.reduce((acc, withdrawal) => {
      const currency = withdrawal.wallet.currency;
      if (!acc[currency]) {
        acc[currency] = 0;
      }
      acc[currency] += withdrawal.amount;
      return acc;
    }, {} as Record<string, number>);

    // Calculate monthly breakdown
    const monthlyStats = filteredWithdrawals.reduce((acc, withdrawal) => {
      const date = new Date(withdrawal.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!acc[monthKey]) {
        acc[monthKey] = { amount: 0, count: 0, usdValue: 0 };
      }
      
      const price = cryptoPrices[withdrawal.wallet.currency]?.usd || 0;
      acc[monthKey].amount += withdrawal.amount;
      acc[monthKey].count += 1;
      acc[monthKey].usdValue += withdrawal.amount * price;
      
      return acc;
    }, {} as Record<string, { amount: number; count: number; usdValue: number }>);

    return { totalAmount, totalUsdValue, groupedByCurrency, monthlyStats };
  };

  const { totalUsdValue, groupedByCurrency, monthlyStats } = calculateTotalStats();
  const uniqueWallets = [...new Set(withdrawals.map(w => ({ id: w.walletId, name: w.wallet.name })))];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="text-gray-600">Loading withdrawals...</span>
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
              <h1 className="text-3xl font-bold text-gray-900">Withdrawals</h1>
              <p className="text-gray-600 mt-1">Track all your withdrawal transactions</p>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <TrendingDown className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Withdrawals (USD)</p>
                <p className="text-2xl font-bold text-gray-900">
                  {pricesLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    `${totalUsdValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Transactions</p>
                <p className="text-2xl font-bold text-gray-900">{filteredWithdrawals.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Wallet className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Currencies</p>
                <p className="text-2xl font-bold text-gray-900">{Object.keys(groupedByCurrency).length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search withdrawals..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-black border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <select
              value={selectedWallet}
              onChange={(e) => setSelectedWallet(e.target.value)}
              className="px-4 py-2 border text-black border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Wallets</option>
              {uniqueWallets.map(wallet => (
                <option key={wallet.id} value={wallet.id}>{wallet.name}</option>
              ))}
            </select>

            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-4 py-2 border text-black border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Time</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
          </div>
        </div>

        {/* Currency Breakdown */}
        {Object.keys(groupedByCurrency).length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Withdrawals by Currency</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(groupedByCurrency).map(([currency, amount]) => {
                const price = cryptoPrices[currency]?.usd || 0;
                const usdValue = amount * price;

                return (
                  <div key={currency} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-900 uppercase">{currency}</span>
                      <span className="text-sm text-gray-600">
                        {pricesLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          `${price.toFixed(2)}`
                        )}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-lg font-bold text-red-600">
                        -{amount.toFixed(4)} {currency.toUpperCase()}
                      </p>
                      <p className="text-sm text-gray-600">
                        ≈ ${usdValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Monthly Stats */}
        {Object.keys(monthlyStats).length > 1 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Withdrawal Summary</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Month</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Transactions</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">USD Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(monthlyStats)
                    .sort(([a], [b]) => b.localeCompare(a))
                    .slice(0, 6)
                    .map(([month, stats]) => (
                      <tr key={month} className="border-b border-gray-100">
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {new Date(month + '-01').toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'long' 
                          })}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">{stats.count}</td>
                        <td className="py-3 px-4 text-sm font-medium text-red-600">
                          -${stats.usdValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Withdrawals List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Withdrawal History</h3>
          </div>

          {filteredWithdrawals.length === 0 ? (
            <div className="text-center py-12">
              <TrendingDown className="h-24 w-24 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">No Withdrawals Found</h3>
              <p className="text-gray-600">No withdrawals match your current filters.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredWithdrawals.map(withdrawal => {
                const price = cryptoPrices[withdrawal.wallet.currency]?.usd || 0;
                const usdValue = withdrawal.amount * price;

                return (
                  <div key={withdrawal.id} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="p-2 bg-red-100 rounded-lg">
                          <TrendingDown className="h-5 w-5 text-red-600" />
                        </div>
                        <div className="ml-4">
                          <div className="flex items-center space-x-2">
                            <h4 className="text-sm font-medium text-gray-900">
                              Withdrawal from {withdrawal.wallet.name}
                            </h4>
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full uppercase">
                              {withdrawal.wallet.currency}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">
                            {new Date(withdrawal.createdAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                          <p className="text-xs text-gray-400 font-mono">{withdrawal.id}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-lg font-semibold text-red-600">
                          -{withdrawal.amount.toFixed(4)} {withdrawal.wallet.currency.toUpperCase()}
                        </p>
                        <p className="text-sm text-gray-600">
                          {pricesLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            `≈ ${usdValue.toFixed(2)}`
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Warning Message */}
        {filteredWithdrawals.length > 0 && (
          <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
              <p className="text-sm text-yellow-800">
                <strong>Important:</strong> Cryptocurrency withdrawals are irreversible. Always verify wallet addresses before confirming transactions.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}