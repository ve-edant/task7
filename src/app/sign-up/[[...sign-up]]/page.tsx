'use client';

import { SignUp } from "@clerk/nextjs";
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2, Users, CheckCircle, XCircle } from 'lucide-react';

export default function Page() {
  const searchParams = useSearchParams();
  const [referralCode, setReferralCode] = useState('');
  const [referralValid, setReferralValid] = useState<boolean | null>(null);
  const [referrerName, setReferrerName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      setReferralCode(refCode);
      validateReferralCode(refCode);
    }
  }, [searchParams]);

  const validateReferralCode = async (code: string) => {
    if (!code.trim()) {
      setReferralValid(null);
      setReferrerName('');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/referrals/validate?code=${encodeURIComponent(code.trim())}`);
      const data = await response.json();
      
      if (data.valid) {
        setReferralValid(true);
        setReferrerName(data.referrer.name);
      } else {
        setReferralValid(false);
        setReferrerName('');
      }
    } catch (error) {
      console.error('Error validating referral code:', error);
      setReferralValid(false);
      setReferrerName('');
    } finally {
      setLoading(false);
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
    <div className="min-h-screen bg-[#1b1b1b] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        
        {/* Referral Code Section */}
        <div className="bg-white rounded-lg p-6 shadow-lg">
          <div className="flex items-center mb-4">
            <Users className="h-5 w-5 text-gray-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Referral Code</h3>
          </div>
          
          <div className="space-y-3">
            <div className="relative">
              <input
                type="text"
                value={referralCode}
                onChange={handleReferralCodeChange}
                placeholder="Enter referral code (optional)"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
              />
              
              {loading && (
                <div className="absolute right-3 top-3">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              )}
              
              {!loading && referralValid === true && (
                <div className="absolute right-3 top-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
              )}
              
              {!loading && referralValid === false && referralCode.trim() && (
                <div className="absolute right-3 top-3">
                  <XCircle className="h-5 w-5 text-red-500" />
                </div>
              )}
            </div>

            {/* Validation Messages */}
            {referralValid === true && referrerName && (
              <div className="flex items-center text-sm text-green-600 bg-green-50 p-3 rounded-md">
                <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                <span>Valid referral code from <strong>{referrerName}</strong></span>
              </div>
            )}
            
            {referralValid === false && referralCode.trim() && (
              <div className="flex items-center text-sm text-red-600 bg-red-50 p-3 rounded-md">
                <XCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                <span>Invalid referral code</span>
              </div>
            )}
            
            {!referralCode.trim() && (
              <p className="text-sm text-gray-500">
                Have a referral code? Enter it above to get connected with your referrer.
              </p>
            )}
          </div>
        </div>

        {/* Clerk Sign Up Component */}
        <div className="flex justify-center">
          <SignUp 
            unsafeMetadata={{
              ...(referralCode.trim() && { referralCode: referralCode.trim() })
            }}
            appearance={{
              elements: {
                rootBox: "mx-auto",
                card: "shadow-lg"
              }
            }}
          />
        </div>

        {/* Info Section */}
        {referralCode.trim() && referralValid === true && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <Users className="h-5 w-5 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="text-blue-800 font-medium mb-1">
                  You're signing up with {referrerName}'s referral!
                </p>
                <p className="text-blue-600">
                  When you complete your registration, they'll receive a bonus based on their current portfolio value.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}