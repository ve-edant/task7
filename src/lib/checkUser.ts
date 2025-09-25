// src/lib/checkUser.ts
import { currentUser } from "@clerk/nextjs/server";
import prisma from "./prisma";
import { nanoid } from "nanoid";

export const checkUser = async (referralCode?: string) => {
  const user = await currentUser();
  if (!user) return null;

  console.log(`Checking user: ${user.id}, referralCode: ${referralCode}`);

  // Check if user already exists in DB
  const existingUser = await prisma.user.findUnique({
    where: { clerkUserId: user.id },
    include: {
      wallets: true,
      referralsReceived: true,
    },
  });

  if (existingUser) {
    console.log(`Existing user found: ${existingUser.email}`);
    return existingUser;
  }

  // Generate unique referral code for this new user
  let newReferralCode = nanoid(8);
  let isUnique = false;
  while (!isUnique) {
    const found = await prisma.user.findUnique({
      where: { referralCode: newReferralCode },
    });
    if (!found) isUnique = true;
    else newReferralCode = nanoid(8);
  }

  console.log(`Generated new referral code: ${newReferralCode}`);

  // Create user in DB
  const newUser = await prisma.user.create({
    data: {
      clerkUserId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      imageUrl: user.imageUrl,
      email: user.emailAddresses[0].emailAddress,
      referralCode: newReferralCode,
    },
  });

  console.log(`New user created: ${newUser.email} (ID: ${newUser.id})`);

  // Handle referral if present - just create the referral record with balance 0
  if (referralCode && referralCode.trim()) {
    console.log("Processing referral code:", referralCode.trim());
    
    try {
      const referrer = await prisma.user.findUnique({
        where: { referralCode: referralCode.trim() },
      });

      if (referrer && referrer.id !== newUser.id) {
        console.log(`Found referrer: ${referrer.email} (ID: ${referrer.id})`);
        
        // Create referral record with 0 balance (bonus will be added when admin creates first transaction)
        const referralRecord = await prisma.referral.create({
          data: {
            referrerId: referrer.id,
            refereeId: newUser.id,
            balance: 0,
          },
        });

        console.log(
          `Referral relationship created: ${referrer.email} referred ${newUser.email} (Referral ID: ${referralRecord.id})`
        );
      } else if (!referrer) {
        console.log("Invalid referral code - referrer not found");
      } else {
        console.log("Self-referral attempted - ignored");
      }
    } catch (error) {
      console.error("Error processing referral:", error);
    }
  }

  return newUser;
};