//app/src/dashboard/referrals/page.tsx

"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Users,
  Share2,
  Gift,
  Calendar,
  Loader2,
  Copy,
  Check,
  UserPlus,
  DollarSign,
} from "lucide-react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";

interface Referral {
  id: string;
  createdAt: string;
  referee: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    createdAt: string;
  };
}

interface Transaction {
  id: string;
  type: "REFERRAL_BONUS";
  amount: number;
  createdAt: string;
  walletId: string;
  wallet: {
    currency: string;
    name: string;
  };
}

interface UserProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  referralCode: string | null;
  referralsGiven: Referral[];
  totalTransactions: Transaction[];
}

interface CryptoPrice {
  [key: string]: {
    usd: number;
  };
}

export default function ReferralsPage() {
  const { user } = useUser();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [referralBonuses, setReferralBonuses] = useState<Transaction[]>([]);
  const [cryptoPrices, setCryptoPrices] = useState<CryptoPrice>({});
  const [loading, setLoading] = useState(true);
  const [pricesLoading, setPricesLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [newReferralCode, setNewReferralCode] = useState("");
  const [updatingCode, setUpdatingCode] = useState(false);

  const fetchUserProfile = async () => {
    try {
      const response = await fetch("/api/users/profile");
      if (!response.ok) throw new Error("Failed to fetch profile");
      const data = await response.json();

      setUserProfile(data.user);

      const referralTransactions =
        data.user.totalTransactions?.filter(
          (tx: Transaction) => tx.type === "REFERRAL_BONUS"
        ) || [];

      setReferralBonuses(referralTransactions);
    } catch (error) {
      console.error("Error fetching user profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCryptoPrices = async (currencies: string[]) => {
    if (currencies.length === 0) {
      setPricesLoading(false);
      return;
    }

    setPricesLoading(true); // ensure spinner only runs while fetching

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
      setPricesLoading(false); // stop spinner no matter what
    }
  };

  useEffect(() => {
    if (referralBonuses.length > 0) {
      const currencies = [
        ...new Set(referralBonuses.map((tx) => tx.wallet.currency)),
      ];
      fetchCryptoPrices(currencies);
    } else {
      setPricesLoading(false); // 👈 stop spinner if no bonuses
    }
  }, [referralBonuses]);

  useEffect(() => {
    if (user) {
      fetchUserProfile();
    }
  }, [user]);

  const updateReferralCode = async () => {
    if (!newReferralCode.trim()) return;

    setUpdatingCode(true);
    try {
      const response = await fetch("/api/users/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referralCode: newReferralCode.trim() }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || "Failed to update referral code");
        return;
      }

      await fetchUserProfile();
      setNewReferralCode("");
      alert("Referral code updated successfully!");
    } catch (error) {
      console.error("Error updating referral code:", error);
      alert("Failed to update referral code");
    } finally {
      setUpdatingCode(false);
    }
  };

  const copyReferralCode = async () => {
    if (!userProfile?.referralCode) return;

    try {
      await navigator.clipboard.writeText(userProfile.referralCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (error) {
      console.error("Failed to copy referral code:", error);
    }
  };

  const copyReferralLink = async () => {
    if (!userProfile?.referralCode) return;

    const referralLink = `${window.location.origin}/referral/sign-up?ref=${userProfile.referralCode}`;

    try {
      await navigator.clipboard.writeText(referralLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (error) {
      console.error("Failed to copy referral link:", error);
    }
  };

  const totalReferralBonus = referralBonuses.reduce((sum, tx) => {
    const price = cryptoPrices[tx.wallet.currency]?.usd || 0;
    return sum + tx.amount * price;
  }, 0);

  const referralStats = {
    totalReferrals: userProfile?.referralsGiven?.length || 0,
    totalBonus: totalReferralBonus,
    thisMonth:
      userProfile?.referralsGiven?.filter((ref) => {
        const date = new Date(ref.createdAt);
        const now = new Date();
        return (
          date.getMonth() === now.getMonth() &&
          date.getFullYear() === now.getFullYear()
        );
      }).length || 0,
    thisWeek:
      userProfile?.referralsGiven?.filter((ref) => {
        const date = new Date(ref.createdAt);
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return date >= weekAgo;
      }).length || 0,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="text-gray-600">Loading referrals...</span>
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
              <h1 className="text-3xl font-bold text-gray-900">Referrals</h1>
              <p className="text-gray-600 mt-1">
                Invite friends and earn rewards
              </p>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Stat Cards */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Total Referrals
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {referralStats.totalReferrals}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Total Earned (USD)
                </p>
                <p className="text-2xl font-bold text-green-600">
                  {pricesLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    `$${referralStats.totalBonus.toLocaleString("en-US", {
                      maximumFractionDigits: 2,
                    })}`
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Calendar className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">This Month</p>
                <p className="text-2xl font-bold text-purple-600">
                  {referralStats.thisMonth}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <UserPlus className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">This Week</p>
                <p className="text-2xl font-bold text-orange-600">
                  {referralStats.thisWeek}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Referral Code Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Your Referral Information
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Current Code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Referral Code
              </label>
              {userProfile?.referralCode ? (
                <div className="flex items-center space-x-2">
                  <div className="flex-1 text-black px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg font-mono text-lg">
                    {userProfile.referralCode}
                  </div>
                  <button
                    onClick={copyReferralCode}
                    className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                  >
                    {copiedCode ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              ) : (
                <div className="px-4 py-3 bg-yellow-50 border border-yellow-300 rounded-lg text-yellow-800">
                  No referral code set yet
                </div>
              )}
            </div>

            {/* Update Code */}
            {/* <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {userProfile?.referralCode ? 'Update Referral Code' : 'Set Referral Code'}
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={newReferralCode}
                  onChange={(e) => setNewReferralCode(e.target.value)}
                  placeholder="Enter new referral code"
                  className="flex-1 px-4 py-3 text-black border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={updateReferralCode}
                  disabled={!newReferralCode.trim() || updatingCode}
                  className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center"
                >
                  {updatingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update'}
                </button>
              </div>
            </div> */}
          </div>

          {/* Referral Link */}
          {userProfile?.referralCode && (
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Referral Link
              </label>
              <div className="flex items-center space-x-2">
                <div className="flex-1 text-black px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-sm break-all">
                  {`${window.location.origin}/referral/sign-up?ref=${userProfile.referralCode}`}
                </div>
                <button
                  onClick={copyReferralLink}
                  className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center"
                >
                  {copiedLink ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Share2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Referral Bonuses */}
        {referralBonuses.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Referral Bonuses Earned
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {referralBonuses.slice(0, 6).map((bonus) => {
                const price = cryptoPrices[bonus.wallet.currency]?.usd || 0;
                const usdValue = bonus.amount * price;

                return (
                  <div key={bonus.id} className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <Gift className="h-4 w-4 text-green-600" />
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(bonus.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-green-800">
                        +{bonus.amount.toFixed(4)}{" "}
                        {bonus.wallet.currency.toUpperCase()}
                      </p>
                      <p className="text-sm text-green-600">
                        ≈ ${usdValue.toFixed(2)} USD
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {bonus.wallet.name}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Referrals List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Your Referrals
          </h3>
          {userProfile?.referralsGiven?.length === 0 ? (
            <p className="text-gray-600">You haven’t referred anyone yet.</p>
          ) : (
            <table className="w-full text-sm border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 text-black text-left">Name</th>
                  <th className="p-2 text-black text-left">Email</th>
                  <th className="p-2 text-black text-left">Joined</th>
                </tr>
              </thead>
              <tbody>
                {userProfile?.referralsGiven.map((ref) => (
                  <tr key={ref.id} className="border-t">
                    <td className="p-2  text-black">
                      {ref.referee.firstName} {ref.referee.lastName}
                    </td>
                    <td className="p-2 text-black">{ref.referee.email}</td>
                    <td className="p-2 text-black">
                      {new Date(ref.referee.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
