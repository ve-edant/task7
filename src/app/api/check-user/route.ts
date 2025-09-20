// src/app/api/check-user/route.ts
import { NextResponse } from "next/server";
import { checkUser } from "@/lib/checkUser";

export async function POST(req: Request) {
  const { referralCode } = await req.json().catch(() => ({}));
  const user = await checkUser(referralCode);
  return NextResponse.json(user);
}
