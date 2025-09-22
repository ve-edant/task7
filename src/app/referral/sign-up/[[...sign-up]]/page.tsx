// src/app/referral/sign-up/[[...sign-up]]/page.tsx
"use client";

import { SignUp } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Check, X, User } from "lucide-react";

interface ReferrerInfo {
  name: string;
  code: string;
}

export default function ReferralSignUpPage() {
  const [referralCode, setReferralCode] = useState<string>("");
  const [referrerInfo, setReferrerInfo] = useState<ReferrerInfo | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<"valid" | "invalid" | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    const refParam = searchParams.get("ref");
    if (refParam) {
      setReferralCode(refParam);
      validateReferralCode(refParam);
    }
  }, [searchParams]);

  const validateReferralCode = async (code: string) => {
    if (!code.trim()) {
      setValidationStatus(null);
      setReferrerInfo(null);
      return;
    }

    setValidating(true);
    try {
      const response = await fetch(`/api/referrals/validate?code=${encodeURIComponent(code.trim())}`);
      const data = await response.json();

      if (data.valid) {
        setValidationStatus("valid");
        setReferrerInfo(data.referrer);
      } else {
        setValidationStatus("invalid");
        setReferrerInfo(null);
      }
    } catch (error) {
      console.error("Error validating referral code:", error);
      setValidationStatus("invalid");
      setReferrerInfo(null);
    } finally {
      setValidating(false);
    }
  };

  const handleReferralCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const code = e.target.value;
    setReferralCode(code);
    
    // Debounce validation
    const timeoutId = setTimeout(() => {
      validateReferralCode(code);
    }, 500);

    return () => clearTimeout(timeoutId);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#1b1b1b] p-4">
      <div className="w-full max-w-md">
        {/* Referral Code Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Join with Referral Code
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Referral Code (Optional)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={referralCode}
                  onChange={handleReferralCodeChange}
                  placeholder="Enter referral code"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 pr-10"
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  {validating ? (
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  ) : validationStatus === "valid" ? (
                    <Check className="h-5 w-5 text-green-500" />
                  ) : validationStatus === "invalid" ? (
                    <X className="h-5 w-5 text-red-500" />
                  ) : null}
                </div>
              </div>
            </div>

            {/* Referrer Info */}
            {validationStatus === "valid" && referrerInfo && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-100 rounded-full">
                    <User className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-green-900">
                      Referred by: {referrerInfo.name}
                    </p>
                    <p className="text-xs text-green-700">
                      You'll both earn rewards when you join!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Invalid Code Message */}
            {validationStatus === "invalid" && referralCode && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <X className="h-4 w-4 text-red-500" />
                  <p className="text-sm text-red-700">
                    Invalid referral code. Please check and try again.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Clerk Sign Up Component */}
        <div className="flex justify-center">
          <SignUp 
            redirectUrl={`/api/check-user${referralCode && validationStatus === "valid" ? `?referralCode=${encodeURIComponent(referralCode)}` : ""}`}
            afterSignUpUrl={`/api/check-user${referralCode && validationStatus === "valid" ? `?referralCode=${encodeURIComponent(referralCode)}` : ""}`}
          />
        </div>
      </div>
    </div>
  );
}