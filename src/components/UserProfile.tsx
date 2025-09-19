// src/components/UserProfile.tsx
'use client';

import { checkUser } from '@/lib/checkUser';
import { useUser, useAuth } from '@clerk/nextjs';
import { useState, useEffect } from 'react';

type PrismaUser = {
  id: string;
  email: string;
  referralCode: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  createdAt: string;
  wallets: Array<{
    id: string;
    name: string;
    balance: number;
    currency: string;
  }>;
};

export default async function UserProfile() {
  const userInfo = await checkUser();
  console.log(userInfo);
  const { user, isLoaded: userLoaded } = useUser();
  const { isLoaded: authLoaded, userId } = useAuth();
  const [prismaUser, setPrismaUser] = useState<PrismaUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserData() {
      if (!authLoaded || !userLoaded || !userId) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/user/profile');
        if (!response.ok) {
          throw new Error('Failed to fetch user data');
        }

        const userData = await response.json();
        setPrismaUser(userData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();
  }, [authLoaded, userLoaded, userId]);

  if (!authLoaded || !userLoaded || loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-4 bg-yellow-100 border border-yellow-400 rounded">
        <p className="text-yellow-800">Please sign in to view your profile.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-100 border border-red-400 rounded">
        <p className="text-red-800">Error: {error}</p>
      </div>
    );
  }

  if (!prismaUser) {
    return (
      <div className="p-4 bg-blue-100 border border-blue-400 rounded">
        <p className="text-blue-800">Setting up your account...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white shadow-lg rounded-lg">
      {/* Header with Clerk user info */}
      <div className="flex items-center space-x-4 mb-6">
        {user.imageUrl && (
          <img
            src={user.imageUrl}
            alt="Profile"
            className="w-16 h-16 rounded-full"
          />
        )}
        <div>
          <h1 className="text-2xl font-bold">
            {user.firstName} {user.lastName}
          </h1>
          <p className="text-gray-600">{user.emailAddresses[0]?.emailAddress}</p>
        </div>
      </div>

      {/* Prisma user data */}
      <div className="space-y-6">
        <div className="bg-gray-50 p-4 rounded">
          <h2 className="text-lg font-semibold mb-3">Account Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Referral Code
              </label>
              <p className="mt-1 font-mono bg-white px-3 py-2 border rounded">
                {prismaUser.referralCode}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Member Since
              </label>
              <p className="mt-1 px-3 py-2">
                {new Date(prismaUser.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Wallets */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Wallets</h2>
          {prismaUser.wallets.map((wallet) => (
            <div key={wallet.id} className="border rounded p-4 mb-2">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-medium">{wallet.name}</h3>
                  <p className="text-sm text-gray-600">{wallet.currency}</p>
                </div>
                <p className="text-lg font-semibold text-green-600">
                  ${wallet.balance.toFixed(2)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}