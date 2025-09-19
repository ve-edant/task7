'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Wallet, TrendingUp, TrendingDown, Plus, Eye, EyeOff, Loader2, Copy, Check } from 'lucide-react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';

interface Wallet {
  id: string;
  name: string;
  balance: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  transactions: Transaction[];
}

interface Transaction {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'REFERRAL_BONUS' | 'INTEREST' | 'ADMIN_ADJUSTMENT';
  amount: number;
  createdAt: string;
}

interface CryptoPrice {
  [key: string]: {
    usd: number;
    usd_24h_change: number;
  };
}

export default function WalletsPage() {
  const { user } = useUser();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [cryptoPrices, setCryptoPrices] = useState<CryptoPrice>({});
  const [loading, setLoading] = useState(true);
  const [pricesLoading, setPricesLoading] = useState(true);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [copiedWallet, setCopiedWallet] = useState<string | null>(null);

  const fetchUserProfile = async () => {
    try {
      const response = await fetch('/api/users/profile');
      if (!response.ok) throw new Error('Failed to fetch profile');
      const data = await response.json();
      setWallets(data.user.wallets || []);
    } catch (error) {
      console.error('Error fetching wallets:', error);
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
        `https://api.coingecko.com/api/v3/simple/price?ids=${uniqueCurrencies.join(',')}&vs_currencies=usd&include_24hr_change=true`
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
    if (wallets.length > 0) {
      const currencies = wallets.map(wallet => wallet.currency);
      fetchCryptoPrices(currencies);
    }
  }, [wallets]);

  const copyWalletId = async (walletId: string) => {
    try {
      await navigator.clipboard.writeText(walletId);
      setCopiedWallet(walletId);
      setTimeout(() => setCopiedWallet(null), 2000);
    } catch (error) {
      console.error('Failed to copy wallet ID:', error);
    }
  };

  const calculateWalletStats = (wallet: Wallet) => {
    const price = cryptoPrices[wallet.currency]?.usd || 0;
    const priceChange = cryptoPrices[wallet.currency]?.usd_24h_change || 0;
    const usdValue = wallet.balance * price;
    
    const deposits = wallet.transactions
      .filter(tx => tx.type === 'DEPOSIT')
      .reduce((sum, tx) => sum + tx.amount, 0);
    
    const withdrawals = wallet.transactions
      .filter(tx => tx.type === 'WITHDRAWAL')
      .reduce((sum, tx) => sum + tx.amount, 0);
    
    const income = wallet.transactions
      .filter(tx => ['REFERRAL_BONUS', 'INTEREST'].includes(tx.type))
      .reduce((sum, tx) => sum + tx.amount, 0);

    return {
      usdValue,
      priceChange,
      deposits,
      withdrawals,
      income,
      transactionCount: wallet.transactions.length
    };
  };

  const totalPortfolioValue = wallets.reduce((sum, wallet) => {
    const price = cryptoPrices[wallet.currency]?.usd || 0;
    return sum + (wallet.balance * price);
  }, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="text-gray-600">Loading wallets...</span>
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
              <h1 className="text-3xl font-bold text-gray-900">My Wallets</h1>
              <p className="text-gray-600 mt-1">Manage your cryptocurrency wallets</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setBalanceVisible(!balanceVisible)}
              className="flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              {balanceVisible ? (
                <>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Hide Balances
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Show Balances
                </>
              )}
            </button>
          </div>
        </div>

        {/* Portfolio Overview */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center md:text-left">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
                Total Portfolio Value
              </h3>
              <p className="text-3xl font-bold text-gray-900">
                {balanceVisible ? (
                  pricesLoading ? (
                    <Loader2 className="h-8 w-8 animate-spin mx-auto md:mx-0" />
                  ) : (
                    `${totalPortfolioValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
                  )
                ) : (
                  '****'
                )}
              </p>
            </div>
            
            <div className="text-center">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
                Active Wallets
              </h3>
              <p className="text-3xl font-bold text-blue-600">{wallets.length}</p>
            </div>
            
            <div className="text-center md:text-right">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
                Total Transactions
              </h3>
              <p className="text-3xl font-bold text-green-600">
                {wallets.reduce((sum, wallet) => sum + wallet.transactions.length, 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Wallets Grid */}
        {wallets.length === 0 ? (
          <div className="text-center py-12">
            <Wallet className="h-24 w-24 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">No Wallets Found</h3>
            <p className="text-gray-600 mb-6">You don't have any wallets set up yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {wallets.map((wallet) => {
              const stats = calculateWalletStats(wallet);
              const recentTransactions = wallet.transactions.slice(0, 3);
              
              return (
                <div key={wallet.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  {/* Wallet Header */}
                  <div className="p-6 border-b border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Wallet className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="ml-3">
                          <h3 className="text-lg font-semibold text-gray-900">{wallet.name}</h3>
                          <p className="text-sm text-gray-500 uppercase">{wallet.currency}</p>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => copyWalletId(wallet.id)}
                        className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Copy Wallet ID"
                      >
                        {copiedWallet === wallet.id ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    
                    {/* Balance */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Balance</span>
                        <span className="font-mono font-medium">
                          {balanceVisible ? `${wallet.balance} ${wallet.currency.toUpperCase()}` : '****'}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">USD Value</span>
                        <div className="text-right">
                          <span className="font-medium">
                            {balanceVisible ? (
                              pricesLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                `${stats.usdValue.toFixed(2)}`
                              )
                            ) : (
                              '****'
                            )}
                          </span>
                          {!pricesLoading && stats.priceChange !== 0 && (
                            <div className={`text-xs flex items-center justify-end mt-1 ${
                              stats.priceChange >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {stats.priceChange >= 0 ? (
                                <TrendingUp className="h-3 w-3 mr-1" />
                              ) : (
                                <TrendingDown className="h-3 w-3 mr-1" />
                              )}
                              {Math.abs(stats.priceChange).toFixed(2)}%
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Wallet Stats */}
                  <div className="p-6 border-b border-gray-100">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Total Deposits</p>
                        <p className="font-medium text-green-600">
                          {balanceVisible ? `${stats.deposits.toFixed(4)} ${wallet.currency.toUpperCase()}` : '****'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Total Withdrawals</p>
                        <p className="font-medium text-red-600">
                          {balanceVisible ? `${stats.withdrawals.toFixed(4)} ${wallet.currency.toUpperCase()}` : '****'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Income Earned</p>
                        <p className="font-medium text-purple-600">
                          {balanceVisible ? `${stats.income.toFixed(4)} ${wallet.currency.toUpperCase()}` : '****'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Transactions</p>
                        <p className="font-medium text-gray-900">{stats.transactionCount}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Recent Transactions */}
                  <div className="p-6">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Recent Transactions</h4>
                    {recentTransactions.length === 0 ? (
                      <p className="text-sm text-gray-500">No transactions yet</p>
                    ) : (
                      <div className="space-y-3">
                        {recentTransactions.map((transaction, index) => (
                          <div key={transaction.id} className="flex items-center justify-between">
                            <div className="flex items-center">
                              <div className={`p-1.5 rounded-lg ${
                                transaction.type === 'DEPOSIT' ? 'bg-green-100' :
                                transaction.type === 'WITHDRAWAL' ? 'bg-red-100' :
                                'bg-blue-100'
                              }`}>
                                {transaction.type === 'DEPOSIT' ? (
                                  <TrendingUp className="h-3 w-3 text-green-600" />
                                ) : transaction.type === 'WITHDRAWAL' ? (
                                  <TrendingDown className="h-3 w-3 text-red-600" />
                                ) : (
                                  <Plus className="h-3 w-3 text-blue-600" />
                                )}
                              </div>
                              <div className="ml-2">
                                <p className="text-xs font-medium">
                                  {transaction.type.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {new Date(transaction.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-medium">
                                {balanceVisible ? 
                                  `${transaction.amount.toFixed(4)} ${wallet.currency.toUpperCase()}` : 
                                  '****'
                                }
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {wallet.transactions.length > 3 && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <Link 
                          href={`/dashboard/wallets/${wallet.id}`}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          View all {wallet.transactions.length} transactions →
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}