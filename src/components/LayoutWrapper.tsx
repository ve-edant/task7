"use client";

import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen mx-auto bg-[#1a1a1a]">
      {/* Header */}
      <header className="flex justify-end items-center p-4 gap-4 h-16 bg-black border-b border-gray-800">
        <SignedOut>
          <SignInButton fallbackRedirectUrl="/dashboard" mode="modal">
            <button className="px-4 py-2 rounded-lg bg-[#49ff91] text-black font-medium hover:bg-[#3ee07a] transition-colors">
              Sign In
            </button>
          </SignInButton>
          <SignUpButton fallbackRedirectUrl="/dashboard" mode="modal">
            <button className="px-4 py-2 rounded-lg bg-gray-700 text-white font-medium hover:bg-gray-600 transition-colors">
              Sign Up
            </button>
          </SignUpButton>
        </SignedOut>
        <SignedIn>
          <UserButton fallback="/" />
        </SignedIn>
      </header>

      {/* Page content */}
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
