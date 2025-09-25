//app/api/admin/wallets/[walletId]/transactions/[txId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ walletId: string; txId: string }> }
) {
  try {
    const { walletId, txId } = await params;

    const tx = await prisma.transaction.findUnique({ where: { id: txId } });
    if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

    const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
    if (!wallet) return NextResponse.json({ error: "Wallet not found" }, { status: 404 });

    // Adjust balance based on transaction type
    let newBalance = wallet.balance;
    if (tx.type === "DEPOSIT" || tx.type === "REFERRAL_BONUS" || tx.type === "INTEREST" || tx.type === "ADMIN_ADJUSTMENT") {
      newBalance -= tx.amount; // Revert addition
    } else if (tx.type === "WITHDRAWAL") {
      newBalance += tx.amount; // Revert subtraction
    }

    await prisma.wallet.update({ where: { id: walletId }, data: { balance: newBalance } });
    await prisma.transaction.delete({ where: { id: txId } });

    return NextResponse.json({ message: "Transaction deleted" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
