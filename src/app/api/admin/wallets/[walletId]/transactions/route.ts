import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { walletId: string } }) {
  try {
    const { walletId } = params;
    const body = await req.json();
    const { type, amount } = body;

    const validTypes = ["DEPOSIT", "WITHDRAWAL", "REFERRAL_BONUS", "INTEREST", "ADMIN_ADJUSTMENT"] as const;
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json({ error: "Invalid transaction type" }, { status: 400 });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
    if (!wallet) return NextResponse.json({ error: "Wallet not found" }, { status: 404 });

    // Create transaction
    const transaction = await prisma.transaction.create({
      data: {
        type,
        amount: parsedAmount,
        walletId,
      },
    });

    // Update wallet balance
    let newBalance = wallet.balance;
    if (type === "DEPOSIT" || type === "REFERRAL_BONUS" || type === "INTEREST" || type === "ADMIN_ADJUSTMENT") {
      newBalance += parsedAmount;
    } else if (type === "WITHDRAWAL") {
      newBalance -= parsedAmount;
    }

    await prisma.wallet.update({
      where: { id: walletId },
      data: { balance: newBalance },
    });

    return NextResponse.json({ transaction });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
