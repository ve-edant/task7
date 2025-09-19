"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft,
  DollarSign,
  Users,
  TrendingUp,
  Calendar,
  Filter,
  Search,
  Loader2,
  Gift,
} from "lucide-react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { TransactionType } from "@prisma/client";

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

export default function IncomePage() {
  const { user } = useUser();
  const [incomeTransactions, setIncomeTransactions] = useState<Transaction[]>(
    []
  );
  const [filteredTransactions, setFilteredTransactions] = useState<
    Transaction[]
  >([]);
  const [cryptoPrices, setCryptoPrices] = useState<CryptoPrice>({});
  const [loading, setLoading] = useState(true);
  const [pricesLoading, setPricesLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWallet, setSelectedWallet] = useState("all");
  const [incomeType, setIncomeType] = useState("all");
  const [dateRange, setDateRange] = useState("all");

  const fetchUserProfile = async () => {
    try {
      const response = await fetch("/api/users/profile");
      if (!response.ok) throw new Error("Failed to fetch profile");
      const data = await response.json();

      // Extract all income transactions (REFERRAL_BONUS and INTEREST)
      const allIncomeTransactions = data.user.wallets
        .flatMap((wallet: any) =>
          wallet.transactions
            .filter(
              (tx: { type: TransactionType }) =>
                tx.type === TransactionType.REFERRAL_BONUS ||
                tx.type === TransactionType.INTEREST ||
                tx.type === TransactionType.ADMIN_ADJUSTMENT
            )
            .map((tx: any) => ({
              ...tx,
              wallet: {
                id: wallet.id,
                name: wallet.name,
                currency: wallet.currency,
              },
            }))
        )
        .sort(
          (a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

      setIncomeTransactions(allIncomeTransactions);
      setFilteredTransactions(allIncomeTransactions);
    } catch (error) {
      console.error("Error fetching income transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCryptoPrices = async (currencies: string[]) => {
    if (currencies.length === 0) {
      setPricesLoading(false); // 👈 stop spinner if no currencies
      return;
    }

    setPricesLoading(true); // 👈 start spinner only during fetch
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
      setPricesLoading(false); // 👈 always stop spinner
    }
  };

  useEffect(() => {
    if (incomeTransactions.length > 0) {
      const currencies = [
        ...new Set(incomeTransactions.map((tx) => tx.wallet.currency)),
      ];
      fetchCryptoPrices(currencies);
    } else {
      setPricesLoading(false); // 👈 stop spinner if no income transactions
    }
  }, [incomeTransactions]);

  useEffect(() => {
    if (user) {
      fetchUserProfile();
    }
  }, [user]);

  // Filter transactions based on search and filters
  useEffect(() => {
    let filtered = incomeTransactions;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (tx) =>
          tx.wallet.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          tx.wallet.currency.toLowerCase().includes(searchTerm.toLowerCase()) ||
          tx.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by wallet
    if (selectedWallet !== "all") {
      filtered = filtered.filter((tx) => tx.walletId === selectedWallet);
    }

    // Filter by income type
    if (incomeType !== "all") {
      filtered = filtered.filter((tx) => tx.type === incomeType);
    }

    // Filter by date range
    if (dateRange !== "all") {
      const now = new Date();
      const startDate = new Date();

      switch (dateRange) {
        case "7d":
          startDate.setDate(now.getDate() - 7);
          break;
        case "30d":
          startDate.setDate(now.getDate() - 30);
          break;
        case "90d":
          startDate.setDate(now.getDate() - 90);
          break;
      }

      filtered = filtered.filter((tx) => new Date(tx.createdAt) >= startDate);
    }

    setFilteredTransactions(filtered);
  }, [incomeTransactions, searchTerm, selectedWallet, incomeType, dateRange]);

  const calculateTotalStats = () => {
    const totalUsdValue = filteredTransactions.reduce((sum, tx) => {
      const price = cryptoPrices[tx.wallet.currency]?.usd || 0;
      return sum + tx.amount * price;
    }, 0);

    const referralBonusUsd = filteredTransactions
      .filter((tx) => tx.type === "REFERRAL_BONUS")
      .reduce((sum, tx) => {
        const price = cryptoPrices[tx.wallet.currency]?.usd || 0;
        return sum + tx.amount * price;
      }, 0);

    const interestUsd = filteredTransactions
      .filter((tx) => tx.type === "INTEREST")
      .reduce((sum, tx) => {
        const price = cryptoPrices[tx.wallet.currency]?.usd || 0;
        return sum + tx.amount * price;
      }, 0);

    const adminAdjustmentUsd = filteredTransactions
      .filter((tx) => tx.type === "ADMIN_ADJUSTMENT")
      .reduce((sum, tx) => {
        const price = cryptoPrices[tx.wallet.currency]?.usd || 0;
        return sum + tx.amount * price;
      }, 0);

    const groupedByCurrency = filteredTransactions.reduce((acc, tx) => {
      const currency = tx.wallet.currency;
      if (!acc[currency]) {
        acc[currency] = { total: 0, referral: 0, interest: 0, admin: 0 };
      }
      acc[currency].total += tx.amount;

      if (tx.type === "REFERRAL_BONUS") acc[currency].referral += tx.amount;
      if (tx.type === "INTEREST") acc[currency].interest += tx.amount;
      if (tx.type === "ADMIN_ADJUSTMENT") acc[currency].admin += tx.amount;

      return acc;
    }, {} as Record<string, { total: number; referral: number; interest: number; admin: number }>);

    return {
      totalUsdValue,
      referralBonusUsd,
      interestUsd,
      adminAdjustmentUsd,
      groupedByCurrency,
    };
  };

  const {
    totalUsdValue,
    referralBonusUsd,
    interestUsd,
    adminAdjustmentUsd,
    groupedByCurrency,
  } = calculateTotalStats();
  const uniqueWallets = [
    ...new Set(
      incomeTransactions.map((tx) => ({
        id: tx.walletId,
        name: tx.wallet.name,
      }))
    ),
  ];

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "REFERRAL_BONUS":
        return <Users className="h-5 w-5 text-blue-600" />;
      case "INTEREST":
        return <TrendingUp className="h-5 w-5 text-green-600" />;
      case "ADMIN_ADJUSTMENT":
        return <Gift className="h-5 w-5 text-purple-600" />;
      default:
        return <DollarSign className="h-5 w-5 text-gray-600" />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case "REFERRAL_BONUS":
        return "bg-blue-100";
      case "INTEREST":
        return "bg-green-100";
      case "ADMIN_ADJUSTMENT":
        return "bg-purple-100";
      default:
        return "bg-gray-100";
    }
  };

  const formatTransactionType = (type: string) => {
    return type
      .replace("_", " ")
      .toLowerCase()
      .replace(/\b\w/g, (l) => l.toUpperCase());
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
              <h1 className="text-3xl font-bold text-gray-900">Income</h1>
              <p className="text-gray-600 mt-1">
                Track your referral bonuses and interest earnings
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
                  Referral Bonuses
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
                  Interest Earned
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
                  Total Transactions
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {filteredTransactions.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search income..."
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
              {uniqueWallets.map((wallet) => (
                <option key={wallet.id} value={wallet.id}>
                  {wallet.name}
                </option>
              ))}
            </select>

            <select
              value={incomeType}
              onChange={(e) => setIncomeType(e.target.value)}
              className="px-4 py-2 border text-black border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Income Types</option>
              <option value="REFERRAL_BONUS">Referral Bonuses</option>
              <option value="INTEREST">Interest</option>
              <option value="ADMIN_ADJUSTMENT">Admin Adjustments</option>
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
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Income by Currency
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(groupedByCurrency).map(([currency, amounts]) => {
                const price = cryptoPrices[currency]?.usd || 0;
                const totalUsdValue = amounts.total * price;

                return (
                  <div key={currency} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm font-medium text-gray-900 uppercase">
                        {currency}
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
                        <p className="text-lg font-bold text-gray-900">
                          {amounts.total.toFixed(4)} {currency.toUpperCase()}
                        </p>
                        <p className="text-sm text-gray-600">
                          ≈ $
                          {totalUsdValue.toLocaleString("en-US", {
                            maximumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                      <div className="text-xs space-y-1">
                        {amounts.referral > 0 && (
                          <p className="text-blue-600">
                            Referrals: {amounts.referral.toFixed(4)}
                          </p>
                        )}
                        {amounts.interest > 0 && (
                          <p className="text-green-600">
                            Interest: {amounts.interest.toFixed(4)}
                          </p>
                        )}
                        {amounts.admin > 0 && (
                          <p className="text-purple-600">
                            Admin: {amounts.admin.toFixed(4)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Income Transactions List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Income History
            </h3>
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="h-24 w-24 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">
                No Income Found
              </h3>
              <p className="text-gray-600">
                No income transactions match your current filters.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredTransactions.map((transaction) => {
                const price =
                  cryptoPrices[transaction.wallet.currency]?.usd || 0;
                const usdValue = transaction.amount * price;

                return (
                  <div
                    key={transaction.id}
                    className="px-6 py-4 hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div
                          className={`p-2 rounded-lg ${getTransactionColor(
                            transaction.type
                          )}`}
                        >
                          {getTransactionIcon(transaction.type)}
                        </div>
                        <div className="ml-4">
                          <div className="flex items-center space-x-2">
                            <h4 className="text-sm font-medium text-gray-900">
                              {formatTransactionType(transaction.type)} -{" "}
                              {transaction.wallet.name}
                            </h4>
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full uppercase">
                              {transaction.wallet.currency}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">
                            {new Date(transaction.createdAt).toLocaleDateString(
                              "en-US",
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </p>
                          <p className="text-xs text-gray-400 font-mono">
                            {transaction.id}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-lg font-semibold text-green-600">
                          +{transaction.amount.toFixed(4)}{" "}
                          {transaction.wallet.currency.toUpperCase()}
                        </p>
                        <p className="text-sm text-gray-600">
                          {pricesLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            `≈ $${usdValue.toFixed(2)}`
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
      </div>
    </div>
  );
}
