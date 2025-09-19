// src/lib/adminAuth.ts
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

export interface AdminTokenPayload {
  adminId: string;
  email: string;
  iat?: number;
  exp?: number;
}

export function verifyAdminToken(token: string): AdminTokenPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AdminTokenPayload;
    return decoded;
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
}

export function getAdminFromRequest(request: NextRequest): AdminTokenPayload {
  const token = request.cookies.get("admin-token")?.value;
  
  if (!token) {
    throw new Error("No authentication token provided");
  }
  
  return verifyAdminToken(token);
}

export function generateAdminToken(adminId: string, email: string): string {
  return jwt.sign(
    { adminId, email },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
}