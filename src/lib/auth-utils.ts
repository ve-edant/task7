// src/lib/auth-utils.ts
import { auth } from '@clerk/nextjs/server';
import { prisma } from './prisma';

export async function getCurrentUser() {
  const { userId } = await auth();
  
  if (!userId) {
    return null;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      include: {
        wallets: {
          orderBy: { createdAt: 'asc' }
        },
        referralsGiven: {
          include: {
            referee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                createdAt: true
              }
            }
          }
        },
        referralsReceived: {
          include: {
            referrer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                createdAt: true
              }
            }
          }
        }
      }
    });

    return user;
  } catch (error) {
    console.error('Error fetching current user:', error);
    return null;
  }
}

/**
 * Get current user's ID (Clerk ID)
 * Use this for quick checks in Server Components
 */
export async function getCurrentUserId() {
  const { userId } = await auth();
  return userId;
}

/**
 * Check if current user is authenticated
 * Use this for auth guards in Server Components
 */
export async function isAuthenticated() {
  const { userId } = await auth();
  return !!userId;
}

/**
 * Require authentication - throws if not authenticated
 * Use this in Server Components that require auth
 */
export async function requireAuth() {
  const { userId } = await auth();

  if (!userId) {
    throw new Error('Authentication required');
  }
  
  return userId;
}

/**
 * Get user by Clerk userId
 * Useful for API routes when you have the Clerk userId
 */
export async function getUserByClerkId(clerkUserId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      include: {
        wallets: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    return user;
  } catch (error) {
    console.error('Error fetching user by Clerk ID:', error);
    return null;
  }
}

/**
 * Get user's main wallet
 * Most users will have a main wallet created automatically
 */
export async function getUserMainWallet(clerkUserId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      include: {
        wallets: {
          orderBy: { createdAt: 'asc' },
          take: 1
        }
      }
    });

    return user?.wallets[0] || null;
  } catch (error) {
    console.error('Error fetching user main wallet:', error);
    return null;
  }
}

/**
 * Get current user's session claims (includes custom metadata)
 * Use this to check user roles, permissions, etc.
 */
export async function getCurrentUserClaims() {
  const { sessionClaims } = await auth();
  return sessionClaims;
}