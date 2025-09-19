// src/app/api/admin/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

async function verifyAdminToken(request: NextRequest) {
  const token = request.cookies.get("admin-token")?.value;
  
  if (!token) {
    throw new Error("No token provided");
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { adminId: string; email: string };
    return decoded;
  } catch (error) {
    throw new Error("Invalid token");
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    await verifyAdminToken(request);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";

    const skip = (page - 1) * limit;

    // Build where clause for search
    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: "insensitive" as const } },
            { firstName: { contains: search, mode: "insensitive" as const } },
            { lastName: { contains: search, mode: "insensitive" as const } },
            { clerkUserId: { contains: search, mode: "insensitive" as const } }
          ]
        }
      : {};

    // Get users with pagination
    const [users, totalCount] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          wallets: {
            select: {
              id: true,
              name: true,
              balance: true,
              currency: true
            }
          },
          referralsGiven: {
            select: {
              id: true,
              createdAt: true
            }
          },
          referralsReceived: {
            select: {
              id: true,
              createdAt: true
            }
          }
        }
      }),
      prisma.user.count({ where })
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      users,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error("Get users error:", error);
    
    if (error instanceof Error && error.message.includes("token")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}