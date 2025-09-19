// app/api/admin/users/[id]/wallets/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const userId = id;
  try {
    const body = await req.json();
    const { name, currency } = body;

    if (!name || !currency) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const wallet = await prisma.wallet.create({
      data: {
        userId: userId,
        name,
        currency,
      },
    });

    return NextResponse.json(wallet, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create wallet" }, { status: 500 });
  }
}
