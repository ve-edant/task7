/*eslint-disable*/
"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft,
  TrendingUp,
  Calendar,
  Filter,
  Search,
  Loader2,
  Wallet,
  Plus,
  AlertCircle,
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

// Minimum deposit amount in USD
const MINIMUM_DEPOSIT_USD = 100;

export default function DepositsPage() {
  const { user } = useUser();
  const [deposits, setDeposits] = useState<Transaction[]>([]);
  const [filteredDeposits, setFilteredDeposits] = useState<Transaction[]>([]);
  const [cryptoPrices, setCryptoPrices] = useState<CryptoPrice>({});
  const [loading, setLoading] = useState(true);
  const [pricesLoading, setPricesLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWallet, setSelectedWallet] = useState("all");
  const [dateRange, setDateRange] = useState("all");

  // New state for deposit form
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [selectedDepositWallet, setSelectedDepositWallet] = useState("");
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositError, setDepositError] = useState("");
  const [userWallets, setUserWallets] = useState<any[]>([]);

  const fetchUserProfile = async () => {
    try {
      const response = await fetch("/api/users/profile");
      if (!response.ok) throw new Error("Failed to fetch profile");
      const data = await response.json();

      // Store user wallets for deposit form
      setUserWallets(data.user.wallets);

      // Extract all deposit transactions with wallet info
      const allDeposits = data.user.wallets
        .flatMap((wallet: any) =>
          wallet.transactions
            .filter(
              (tx: { type: TransactionType }) =>
                tx.type === TransactionType.DEPOSIT
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

      setDeposits(allDeposits);
      setFilteredDeposits(allDeposits);
    } catch (error) {
      console.error("Error fetching deposits:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCryptoPrices = async (currencies: string[]) => {
    if (currencies.length === 0) {
      setPricesLoading(false); // ✅ release loader
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
      setPricesLoading(false); // ✅ always release loader
    }
  };

  // Validate minimum deposit amount
  const validateDepositAmount = (
    amount: string,
    currency: string
  ): string | null => {
    const numAmount = parseFloat(amount);

    if (!numAmount || numAmount <= 0) {
      return "Please enter a valid amount";
    }

    const cryptoPrice = cryptoPrices[currency]?.usd || 0;
    if (cryptoPrice === 0) {
      return "Unable to fetch current price. Please try again.";
    }

    const usdValue = numAmount * cryptoPrice;
    if (usdValue < MINIMUM_DEPOSIT_USD) {
      const minCryptoAmount = MINIMUM_DEPOSIT_USD / cryptoPrice;
      return `Minimum deposit is $${MINIMUM_DEPOSIT_USD} USD (≈ ${minCryptoAmount.toFixed(
        6
      )} ${currency.toUpperCase()})`;
    }

    return null;
  };

  // Handle deposit submission
  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDepositError("");
    setDepositLoading(true);

    try {
      const selectedWallet = userWallets.find(
        (w) => w.id === selectedDepositWallet
      );
      if (!selectedWallet) {
        setDepositError("Please select a wallet");
        return;
      }

      // Validate minimum amount
      const validationError = validateDepositAmount(
        depositAmount,
        selectedWallet.currency
      );
      if (validationError) {
        setDepositError(validationError);
        return;
      }

      // Make API call to process deposit
      const response = await fetch("/api/transactions/deposit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletId: selectedDepositWallet,
          amount: parseFloat(depositAmount),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to process deposit");
      }

      // Reset form and refresh data
      setDepositAmount("");
      setSelectedDepositWallet("");
      setShowDepositForm(false);
      fetchUserProfile(); // Refresh the deposits list
    } catch (error) {
      console.error("Error processing deposit:", error);
      setDepositError(
        error instanceof Error ? error.message : "Failed to process deposit"
      );
    } finally {
      setDepositLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchUserProfile();
    }
  }, [user]);

  useEffect(() => {
    if (deposits.length > 0) {
      const currencies = [
        ...new Set(deposits.map((deposit) => deposit.wallet.currency)),
      ];
      fetchCryptoPrices(currencies);
    }
  }, [deposits]);

  useEffect(() => {
    if (userWallets.length > 0) {
      const currencies = [
        ...new Set(userWallets.map((wallet) => wallet.currency)),
      ];
      fetchCryptoPrices(currencies);
    }
  }, [userWallets]);

  // Filter deposits based on search and filters
  useEffect(() => {
    let filtered = deposits;

    if (searchTerm) {
      filtered = filtered.filter(
        (deposit) =>
          deposit.wallet.name
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          deposit.wallet.currency
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          deposit.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedWallet !== "all") {
      filtered = filtered.filter(
        (deposit) => deposit.walletId === selectedWallet
      );
    }

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

      filtered = filtered.filter(
        (deposit) => new Date(deposit.createdAt) >= startDate
      );
    }

    setFilteredDeposits(filtered);
  }, [deposits, searchTerm, selectedWallet, dateRange]);

  const calculateTotalStats = () => {
    const totalAmount = filteredDeposits.reduce(
      (sum, deposit) => sum + deposit.amount,
      0
    );
    const totalUsdValue = filteredDeposits.reduce((sum, deposit) => {
      const price = cryptoPrices[deposit.wallet.currency]?.usd || 0;
      return sum + deposit.amount * price;
    }, 0);

    const groupedByCurrency = filteredDeposits.reduce((acc, deposit) => {
      const currency = deposit.wallet.currency;
      if (!acc[currency]) {
        acc[currency] = 0;
      }
      acc[currency] += deposit.amount;
      return acc;
    }, {} as Record<string, number>);

    return { totalAmount, totalUsdValue, groupedByCurrency };
  };

  const { totalUsdValue, groupedByCurrency } = calculateTotalStats();
  const uniqueWallets = [
    ...new Set(deposits.map((d) => ({ id: d.walletId, name: d.wallet.name }))),
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="text-gray-600">Loading deposits...</span>
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
              <h1 className="text-3xl font-bold text-gray-900">Deposits</h1>
              <p className="text-gray-600 mt-1">
                Track all your deposit transactions
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowDepositForm(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-5 w-5 mr-2" />
            New Deposit
          </button>
        </div>

        {/* Deposit Form Modal */}
        {showDepositForm && (
          <div className="fixed inset-0 bg-black/10 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Make a Deposit
              </h3>

              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-yellow-800 font-medium">
                      Minimum Deposit Required
                    </p>
                    <p className="text-sm text-yellow-700 mt-1">
                      The minimum deposit amount is ${MINIMUM_DEPOSIT_USD} USD
                      equivalent.
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleDeposit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Wallet
                  </label>
                  <select
                    value={selectedDepositWallet}
                    onChange={(e) => setSelectedDepositWallet(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                    required
                  >
                    <option value="">Choose wallet...</option>
                    {userWallets.map((wallet) => (
                      <option key={wallet.id} value={wallet.id}>
                        {wallet.name} ({wallet.currency.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount
                    {selectedDepositWallet && (
                      <span className="text-gray-500 ml-2">
                        (Minimum: ${MINIMUM_DEPOSIT_USD} USD)
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                    placeholder="Enter amount..."
                    required
                  />
                  {selectedDepositWallet && depositAmount && cryptoPrices && (
                    <p className="text-sm text-gray-600 mt-1">
                      ≈ $
                      {(
                        parseFloat(depositAmount) *
                        (cryptoPrices[
                          userWallets.find(
                            (w) => w.id === selectedDepositWallet
                          )?.currency || ""
                        ]?.usd || 0)
                      ).toFixed(2)}{" "}
                      USD
                    </p>
                  )}
                </div>

                {depositError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{depositError}</p>
                  </div>
                )}

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDepositForm(false);
                      setDepositError("");
                      setDepositAmount("");
                      setSelectedDepositWallet("");
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={depositLoading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {depositLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Deposit"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Total Deposits (USD)
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {pricesLoading && deposits.length > 0 ? (
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
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Total Transactions
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {filteredDeposits.length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Wallet className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Active Currencies
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {Object.keys(groupedByCurrency).length}
                </p>
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
                placeholder="Search deposits..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 text-black py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              Deposits by Currency
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(groupedByCurrency).map(([currency, amount]) => {
                const price = cryptoPrices[currency]?.usd || 0;
                const usdValue = amount * price;

                return (
                  <div key={currency} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
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
                    <div className="space-y-1">
                      <p className="text-lg font-bold text-gray-900">
                        {amount.toFixed(4)} {currency.toUpperCase()}
                      </p>
                      <p className="text-sm text-gray-600">
                        ≈ $
                        {usdValue.toLocaleString("en-US", {
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Deposits List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Deposit History
            </h3>
          </div>

          {filteredDeposits.length === 0 ? (
            <div className="text-center py-12">
              <TrendingUp className="h-24 w-24 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">
                No Deposits Found
              </h3>
              <p className="text-gray-600">
                No deposits match your current filters.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredDeposits.map((deposit) => {
                const price = cryptoPrices[deposit.wallet.currency]?.usd || 0;
                const usdValue = deposit.amount * price;

                return (
                  <div key={deposit.id} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <TrendingUp className="h-5 w-5 text-green-600" />
                        </div>
                        <div className="ml-4">
                          <div className="flex items-center space-x-2">
                            <h4 className="text-sm font-medium text-gray-900">
                              Deposit to {deposit.wallet.name}
                            </h4>
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full uppercase">
                              {deposit.wallet.currency}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">
                            {new Date(deposit.createdAt).toLocaleDateString(
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
                            {deposit.id}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-lg font-semibold text-gray-900">
                          +{deposit.amount.toFixed(4)}{" "}
                          {deposit.wallet.currency.toUpperCase()}
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
