"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  createdAt: string;
}

interface Wallet {
  id: string;
  name: string;
  balance: number;
  currency: string;
  transactions: Transaction[];
}

interface Referral {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}

interface User {
  id: string;
  email: string;
  referralCode?: string;
  createdAt: string;
  updatedAt: string;
  clerkUserId: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
  isAdmin: boolean;
  wallets: Wallet[];
  referralsGiven: Referral[];
  referralsReceived: Referral[];
}

export default function AdminUserDetails() {
  const { id } = useParams();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [newWallet, setNewWallet] = useState({ name: "", currency: "" });
  const [isAdding, setIsAdding] = useState(false);

  const [transactionInput, setTransactionInput] = useState<{
    [walletId: string]: { type: "DEPOSIT" | "WITHDRAWAL" | "REFERRAL_BONUS" | "INTEREST" | "ADMIN_ADJUSTMENT"; amount: string };
  }>({});

  const fetchUser = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`);
      const data = await res.json();
      setUser(data.user);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, [id]);

  const addWallet = async () => {
    if (!newWallet.name || !newWallet.currency) return;
    setIsAdding(true);
    try {
      const res = await fetch(`/api/admin/users/${id}/wallets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newWallet),
      });
      if (res.ok) {
        setNewWallet({ name: "", currency: "" });
        fetchUser();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAdding(false);
    }
  };

  const addTransaction = async (walletId: string) => {
    const input = transactionInput[walletId];

    if (!input || !input.type || !input.amount) {
      console.log("Transaction input not set yet"); // DEBUG
      return;
    }

    console.log("clicked"); // This will now always log

    try {
      const res = await fetch(`/api/admin/wallets/${walletId}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: input.type,
          amount: parseFloat(input.amount),
        }),
      });

      if (res.ok) {
        setTransactionInput((prev) => ({
          ...prev,
          [walletId]: { type: "DEPOSIT", amount: "" },
        }));
        fetchUser();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const deleteTransaction = async (walletId: string, txId: string) => {
    try {
      const res = await fetch(
        `/api/admin/wallets/${walletId}/transactions/${txId}`,
        {
          method: "DELETE",
        }
      );
      if (res.ok) fetchUser();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <p>Loading...</p>;
  if (!user) return <p>User not found</p>;

  return (
    <div className="p-6 space-y-6">
      {/* User info omitted for brevity */}
      {/* User Info */}
      <div className="border p-4 rounded">
        <h1 className="text-2xl font-bold">{user.email}</h1>
        {user.imageUrl && (
          <img
            src={user.imageUrl}
            alt="User Avatar"
            className="w-20 h-20 rounded-full mt-2"
          />
        )}
        <p>
          Name: {user.firstName || "-"} {user.lastName || "-"}
        </p>
        <p>Clerk User ID: {user.clerkUserId}</p>
        <p>Referral Code: {user.referralCode || "-"}</p>
        <p>Admin: {user.isAdmin ? "Yes" : "No"}</p>
        <p>Created At: {new Date(user.createdAt).toLocaleString()}</p>
        <p>Updated At: {new Date(user.updatedAt).toLocaleString()}</p>

        {/* Referrals */}
        <div className="mt-2">
          <h3 className="font-semibold">Referrals Given:</h3>
          {user.referralsGiven.length > 0 ? (
            <ul className="list-disc list-inside">
              {user.referralsGiven.map((ref) => (
                <li key={ref.id}>
                  {ref.firstName || ""} {ref.lastName || ""} ({ref.email || "-"}
                  )
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">None</p>
          )}
        </div>

        <div className="mt-2">
          <h3 className="font-semibold">Referrals Received:</h3>
          {user.referralsReceived.length > 0 ? (
            <ul className="list-disc list-inside">
              {user.referralsReceived.map((ref) => (
                <li key={ref.id}>
                  {ref.firstName || ""} {ref.lastName || ""} ({ref.email || "-"}
                  )
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">None</p>
          )}
        </div>
      </div>

      {/* Add Wallet */}
      <div className="mt-4 border p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">Add Wallet</h2>
        <input
          type="text"
          placeholder="Wallet name"
          value={newWallet.name}
          onChange={(e) => setNewWallet({ ...newWallet, name: e.target.value })}
          className="border p-2 mr-2 rounded"
        />
        <input
          type="text"
          placeholder="Currency (e.g., USD)"
          value={newWallet.currency}
          onChange={(e) =>
            setNewWallet({ ...newWallet, currency: e.target.value })
          }
          className="border p-2 mr-2 rounded"
        />
        <button
          onClick={addWallet}
          disabled={isAdding}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {isAdding ? "Adding..." : "Add Wallet"}
        </button>
      </div>
      {/* Wallets + Transactions */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Wallets</h2>
        {user.wallets.length === 0 ? (
          <p>No wallets yet.</p>
        ) : (
          user.wallets.map((wallet) => (
            <div key={wallet.id} className="mb-6 border p-4 rounded">
              <h3 className="text-lg font-semibold">
                {wallet.name} - {wallet.balance} {wallet.currency}
              </h3>

              {/* Add transaction form */}
              <div className="mt-2 flex items-center gap-2">
                <select
                  value={transactionInput[wallet.id]?.type || "DEPOSIT"}
                  onChange={(e) =>
                    setTransactionInput((prev) => ({
                      ...prev,
                      [wallet.id]: {
                        type: e.target.value as "DEPOSIT" | "WITHDRAWAL",
                        amount: prev[wallet.id]?.amount || "", // keep existing amount or empty
                      },
                    }))
                  }
                  className="border p-2 bg-white rounded text-black"
                >
                  <option value="DEPOSIT">DEPOSIT</option>
                  <option value="WITHDRAWAL">WITHDRAWAL</option>
                  <option value="REFERRAL_BONUS">REFERRAL_BONUS</option>
                  <option value="INTEREST">INTEREST</option>
                </select>

                <input
                  type="number"
                  placeholder="Amount"
                  value={transactionInput[wallet.id]?.amount || ""}
                  onChange={(e) =>
                    setTransactionInput((prev) => ({
                      ...prev,
                      [wallet.id]: {
                        type: prev[wallet.id]?.type || "DEPOSIT", // keep existing type
                        amount: e.target.value,
                      },
                    }))
                  }
                  className="border p-2 rounded"
                />
                <button
                  onClick={() => addTransaction(wallet.id)}
                  className="bg-green-600 text-white px-4 py-2 rounded"
                >
                  Add Transaction
                </button>
              </div>

              {/* Transaction table */}
              <h4 className="mt-4 font-medium">Transactions</h4>
              {wallet.transactions.length === 0 ? (
                <p className="text-sm text-gray-500">No transactions yet.</p>
              ) : (
                <table className="w-full text-sm border mt-2">
                  <thead>
                    <tr className="bg-gray-100 text-black">
                      <th className="p-2 text-left">Type</th>
                      <th className="p-2 text-left">Amount</th>
                      <th className="p-2 text-left">Date</th>
                      <th className="p-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wallet.transactions.map((tx) => (
                      <tr key={tx.id} className="border-t">
                        <td className="p-2">{tx.type}</td>
                        <td className="p-2">{tx.amount}</td>
                        <td className="p-2">
                          {new Date(tx.createdAt).toLocaleString()}
                        </td>
                        <td className="p-2">
                          <button
                            onClick={() => deleteTransaction(wallet.id, tx.id)}
                            className="text-red-600 hover:underline"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
