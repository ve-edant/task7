/* eslint-disable */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";

interface AdminPayload {
  adminId: string;
  email: string;
}

function verifyAdminToken(token: string): AdminPayload | null {
  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key"
    ) as AdminPayload;
    return payload;
  } catch (error) {
    console.log("JWT verification failed:", error);
    return null;
  }
}

function getAdminFromRequest(request: NextRequest): AdminPayload | null {
  const token = request.cookies.get("admin-token")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

// GET - Get specific user details with wallets, transactions & referrals
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = id;
    console.log("GET request for user ID:", userId);

    // Verify admin authentication
    const admin = getAdminFromRequest(request);
    if (!admin) {
      console.log("Unauthorized admin access attempt");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Admin authenticated:", admin.email);

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        wallets: {
          include: {
            transactions: true,
          },
        },
        referralsGiven: {
          include: {
            referee: {
              select: { id: true, email: true, firstName: true, lastName: true },
            },
          },
        },
        referralsReceived: {
          include: {
            referrer: {
              select: { id: true, email: true, firstName: true, lastName: true },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error: unknown) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details:
          process.env.NODE_ENV === "development"
            ? (error as Error).message
            : undefined,
      },
      { status: 500 }
    );
  }
}
